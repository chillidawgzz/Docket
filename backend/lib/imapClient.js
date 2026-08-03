const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('./db');
const attachmentCache = require('./attachmentCache');

const SKIP_SPECIAL_USES = new Set(['\\Trash', '\\Junk', '\\Drafts']);
const SKIP_PATHS = new Set(['[Gmail]', '[Gmail]/Trash', '[Gmail]/Spam', '[Gmail]/Drafts']);

function parseLabelConfig() {
  // Prefer IMAP_LABELS; fall back to legacy IMAP_MAILBOX
  const raw = process.env.IMAP_LABELS || process.env.IMAP_MAILBOX || '*';
  return raw
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean);
}

const config = {
  host: process.env.IMAP_HOST || 'imap.gmail.com',
  port: Number(process.env.IMAP_PORT) || 993,
  labels: parseLabelConfig(),
  sinceDays: Number(process.env.IMAP_SINCE_DAYS) || 730,
  maxMessages: Number(process.env.IMAP_MAX_MESSAGES) || 10000,
};

function isConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function wantsAllLabels(labels) {
  return labels.length === 1 && ['*', 'ALL', 'all'].includes(labels[0]);
}

async function withImapClient(fn) {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/**
 * Resolve which mailboxes to scan.
 * labels=* → every selectable label (skip Trash/Spam/Drafts).
 * On Gmail, prefer [Gmail]/All Mail alone when present — it already
 * contains every labeled + archived message, without multi-label dupes.
 */
async function resolveLabels(client, labelSpec) {
  const labels = Array.isArray(labelSpec) ? labelSpec : parseLabelConfig();
  if (!wantsAllLabels(labels)) {
    return labels;
  }

  const boxes = await client.list();
  const allMail = boxes.find(
    (b) => b.specialUse === '\\All' || b.path === '[Gmail]/All Mail'
  );
  if (allMail) {
    console.log(`[scan] IMAP_LABELS=* → using ${allMail.path} (covers all labels)`);
    return [allMail.path];
  }

  const resolved = boxes
    .filter((b) => {
      if (b.flags && b.flags.has('\\Noselect')) return false;
      if (b.specialUse && SKIP_SPECIAL_USES.has(b.specialUse)) return false;
      if (SKIP_PATHS.has(b.path)) return false;
      return true;
    })
    .map((b) => b.path);

  console.log(`[scan] IMAP_LABELS=* → ${resolved.length} mailboxes: ${resolved.join(', ')}`);
  return resolved;
}

async function listMailboxes() {
  if (!isConfigured()) return [];
  return withImapClient(async (client) => {
    const boxes = await client.list();
    return boxes
      .filter((b) => !(b.flags && b.flags.has('\\Noselect')))
      .map((b) => ({
        path: b.path,
        specialUse: b.specialUse || null,
        selectable: !(b.flags && b.flags.has('\\Noselect')),
      }));
  });
}

function getSyncConfig() {
  const dbStatus = db.getSyncStatus();
  let documentCount = 0;
  try {
    documentCount = db.getDocuments().length;
  } catch {
    /* db may not be ready */
  }
  return {
    configured: isConfigured(),
    defaults: {
      labels: config.labels.join(','),
      sinceDays: config.sinceDays,
      maxMessages: config.maxMessages,
    },
    lastScan: dbStatus.lastScan ? dbStatus.lastScan.toISOString() : null,
    lastRunFound: dbStatus.messageCount || 0,
    documentCount,
    status: getStatus(),
  };
}

function emit(cb, event) {
  if (cb) cb(event);
}

// In-memory state (for current session only; DB is source of truth)
let attachmentIndex = new Map();
let status = { lastScan: null, messageCount: 0, error: null, scanning: false };
let progressCallback = null;
const inflightDownloads = new Map();

/** Live sync bus — survives client disconnect / page refresh */
const syncListeners = new Set();
const syncHistory = []; // meaningful events for replay
const SYNC_HISTORY_MAX = 250;
let lastProgressEvent = null;
let syncJob = null;
let syncControl = { cancelled: false, paused: false };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitWhilePaused() {
  if (!syncControl.paused || syncControl.cancelled) return;
  broadcastSyncEvent({ type: 'paused' });
  while (syncControl.paused && !syncControl.cancelled) {
    await sleep(250);
  }
  if (!syncControl.cancelled && status.scanning) {
    broadcastSyncEvent({ type: 'resumed' });
  }
}

function shouldStopScan() {
  return syncControl.cancelled;
}

function broadcastSyncEvent(event) {
  if (event && event.type === 'progress') {
    lastProgressEvent = event;
    status.scanned = event.scanned || status.scanned;
    status.scanTotal = event.total || status.scanTotal;
    if (event.found != null) status.found = event.found;
    if (event.skipped != null) status.skipped = event.skipped;
    if (event.errors != null) status.errors = event.errors;
  } else if (event && event.type !== 'snapshot') {
    syncHistory.push(event);
    while (syncHistory.length > SYNC_HISTORY_MAX) syncHistory.shift();
    if (event.type === 'found') {
      status.found = event.found;
      status.scanned = event.scanned || status.scanned;
      status.scanTotal = event.total || status.scanTotal;
      status.skipped = event.skipped;
      status.errors = event.errors;
    }
  }

  for (const listener of syncListeners) {
    try {
      listener(event);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function getSyncSnapshot() {
  return {
    type: 'snapshot',
    status: getStatus(),
    lastProgress: lastProgressEvent,
    history: syncHistory.slice(),
  };
}

function subscribeSync(listener) {
  syncListeners.add(listener);
  try {
    listener(getSyncSnapshot());
  } catch {
    /* ignore */
  }
  return () => syncListeners.delete(listener);
}

/**
 * Start a background sync that continues even if the browser disconnects.
 * Returns { started, alreadyRunning }.
 */
function startSyncJob(options = {}) {
  if (!isConfigured()) {
    return { started: false, alreadyRunning: false, error: 'not configured' };
  }
  if (status.scanning || syncJob) {
    return { started: false, alreadyRunning: true };
  }

  syncHistory.length = 0;
  lastProgressEvent = null;
  syncControl = { cancelled: false, paused: false };

  syncJob = scan(broadcastSyncEvent, options)
    .then((finalStatus) => {
      if (!finalStatus) return finalStatus;
      const alreadyTerminal = syncHistory.some(
        (e) => e.type === 'complete' || e.type === 'cancelled' || e.type === 'error'
      );
      if (!alreadyTerminal) {
        if (finalStatus.cancelled) {
          broadcastSyncEvent({ type: 'cancelled', status: finalStatus });
        } else {
          broadcastSyncEvent({ type: 'complete', status: finalStatus });
        }
      }
      return finalStatus;
    })
    .catch((err) => {
      broadcastSyncEvent({ type: 'error', error: err.message });
      return null;
    })
    .finally(() => {
      syncJob = null;
      syncControl.paused = false;
    });

  return { started: true, alreadyRunning: false };
}

function pauseSyncJob() {
  if (!status.scanning || syncControl.cancelled) {
    return { ok: false, error: 'no active sync' };
  }
  if (syncControl.paused) return { ok: true, paused: true };
  syncControl.paused = true;
  status.paused = true;
  return { ok: true, paused: true };
}

function resumeSyncJob() {
  if (!status.scanning || syncControl.cancelled) {
    return { ok: false, error: 'no active sync' };
  }
  if (!syncControl.paused) return { ok: true, paused: false };
  syncControl.paused = false;
  status.paused = false;
  return { ok: true, paused: false };
}

function cancelSyncJob() {
  if (!status.scanning && !syncJob) {
    return { ok: false, error: 'no active sync' };
  }
  syncControl.cancelled = true;
  syncControl.paused = false; // unblock pause wait
  status.paused = false;
  return { ok: true, cancelling: true };
}

function rebuildAttachmentIndex() {
  attachmentIndex.clear();
  const docs = db.getDocuments();
  docs.forEach((doc) => {
    const ref = db.getAttachmentRef(doc.id);
    if (ref) {
      attachmentIndex.set(doc.id, { uid: ref.uid, attachmentIndex: ref.attachment_index });
    }
  });
  console.log(`[init] Rebuilt attachment index: ${attachmentIndex.size} entries`);
}

function isAttachmentWanted(att) {
  if (att.contentDisposition === 'attachment') return true;
  return !!att.filename && att.size > 10 * 1024 && !att.cid;
}

/** Mirror isAttachmentWanted for ImapFlow bodyStructure nodes. */
function isStructurePartWanted(node) {
  const disposition = String(node.disposition || '').toLowerCase();
  const filename =
    (node.dispositionParameters && node.dispositionParameters.filename) ||
    (node.parameters && node.parameters.name) ||
    '';
  const size = Number(node.size) || 0;
  const cid = node.id || '';
  if (disposition === 'attachment') return true;
  return !!filename && size > 10 * 1024 && !cid;
}

function listWantedAttachmentParts(node, out = []) {
  if (!node) return out;
  const type = String(node.type || '').toLowerCase();
  const topType = type.split('/')[0];
  if (topType !== 'multipart' && isStructurePartWanted(node)) {
    out.push({
      part: node.part || '1',
      contentType: type || 'application/octet-stream',
      filename:
        (node.dispositionParameters && node.dispositionParameters.filename) ||
        (node.parameters && node.parameters.name) ||
        'attachment',
      size: Number(node.size) || 0,
    });
  }
  if (node.childNodes) {
    for (const child of node.childNodes) listWantedAttachmentParts(child, out);
  }
  return out;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Prefer downloading only the MIME part (fast for small attachments in large
 * emails). Fall back to full-message parse if structure/index doesn't line up.
 */
async function fetchAttachmentFromImap(client, doc, ref) {
  const uid = String(ref.uid);
  const index = Number(ref.attachment_index);

  try {
    const message = await client.fetchOne(
      uid,
      { bodyStructure: true },
      { uid: true },
    );
    const parts = listWantedAttachmentParts(
      message && message.bodyStructure,
    );
    const part = parts[index];
    if (part && part.part) {
      const { meta, content } = await client.download(uid, part.part, {
        uid: true,
      });
      const buffer = await streamToBuffer(content);
      const sourceFilename =
        (meta && meta.filename) || part.filename || 'attachment';
      console.log(
        `[download] Part fetch ${doc.id} part=${part.part} (${buffer.length} bytes)`,
      );
      return {
        buffer,
        sourceFilename,
        contentType:
          (meta && meta.contentType) ||
          part.contentType ||
          'application/octet-stream',
      };
    }
    console.warn(
      `[download] No structure part for ${doc.id} index=${index} (found ${parts.length}); falling back`,
    );
  } catch (err) {
    console.warn(
      `[download] Part fetch failed for ${doc.id}: ${err.message}; falling back`,
    );
  }

  const { content } = await client.download(uid, undefined, { uid: true });
  const parsed = await simpleParser(content);
  const att = parsed.attachments[index];
  if (!att) return null;
  return {
    buffer: att.content,
    sourceFilename: att.filename || 'attachment',
    contentType: att.contentType || 'application/octet-stream',
  };
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join('').toUpperCase();
}

function snippetOf(text) {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 220 ? flat.slice(0, 220) + '…' : flat;
}

/** Stable doc id; INBOX keeps legacy `doc-{uid}-{idx}` shape. */
function makeDocId(label, uid, idx) {
  if (label === 'INBOX') return `doc-${uid}-${idx}`;
  const safe = String(label)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `doc-${safe}-${uid}-${idx}`;
}

async function scan(onProgress, options = {}) {
  if (!isConfigured()) {
    status = { lastScan: status.lastScan, messageCount: status.messageCount, error: 'not configured', scanning: false };
    return status;
  }
  if (status.scanning) {
    status.error = 'sync already running';
    return status;
  }

  progressCallback = onProgress;
  status.scanning = true;
  status.paused = false;
  status.cancelled = false;
  status.error = null;
  status.scanned = 0;
  status.scanTotal = 0;

  const sinceDays = Number(options.sinceDays) > 0 ? Number(options.sinceDays) : config.sinceDays;
  const maxMessages = Number(options.maxMessages) > 0 ? Number(options.maxMessages) : config.maxMessages;
  const fullRescan = Boolean(options.fullRescan);
  const labelInput = options.labels
    ? String(options.labels)
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)
    : config.labels;

  try {
    let docCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let cancelled = false;
    const sinceFallback = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const labels = await withImapClient(async (client) => resolveLabels(client, labelInput));
    if (shouldStopScan()) {
      cancelled = true;
    } else {
    emit(progressCallback, {
      type: 'start',
      labels,
      sinceDays,
      maxMessages,
      fullRescan,
      sinceFallback: sinceFallback.toISOString(),
    });

    labelLoop: for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
      await waitWhilePaused();
      if (shouldStopScan()) {
        cancelled = true;
        break labelLoop;
      }

      const label = labels[labelIndex];
      try {
        const latestDate = fullRescan ? null : db.getLatestMessageDateForLabel(label);
        const since = latestDate || sinceFallback;

        emit(progressCallback, {
          type: 'label_start',
          label,
          labelIndex: labelIndex + 1,
          labelTotal: labels.length,
          since: since.toISOString(),
          incremental: Boolean(latestDate),
        });
        console.log(`[scan] Starting label: ${label}`);

        await withImapClient(async (client) => {
          const lock = await client.getMailboxLock(label);
          try {
            if (shouldStopScan()) {
              cancelled = true;
              return;
            }
            const uids = await client.search({ since }, { uid: true });
            const boundedUids = uids.slice(-maxMessages);
            const truncated = uids.length > boundedUids.length;
            console.log(`[scan] Found ${boundedUids.length} emails in ${label} since ${since.toISOString()}`);
            status.scanTotal += boundedUids.length;

            emit(progressCallback, {
              type: 'label_search',
              label,
              matched: uids.length,
              scanning: boundedUids.length,
              truncated,
              since: since.toISOString(),
              scanned: status.scanned,
              total: status.scanTotal,
              found: docCount,
              skipped: skippedCount,
              errors: errorCount,
            });

            for (const uid of boundedUids) {
              await waitWhilePaused();
              if (shouldStopScan()) {
                cancelled = true;
                console.log(`[scan] Cancelled during ${label}`);
                return;
              }

              status.scanned++;
              emit(progressCallback, {
                type: 'progress',
                scanned: status.scanned,
                total: status.scanTotal,
                label,
                found: docCount,
                skipped: skippedCount,
                errors: errorCount,
              });

              try {
                const { content } = await client.download(String(uid), undefined, { uid: true });
                const parsed = await simpleParser(content);
                const attachments = (parsed.attachments || []).filter(isAttachmentWanted);

                const fromAddr = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address : '';
                const fromName = parsed.from && parsed.from.value[0] ? (parsed.from.value[0].name || fromAddr) : 'Unknown';
                const subject = parsed.subject || '(no subject)';

                if (!attachments.length) {
                  skippedCount++;
                  console.log(`[scan:${label}:${uid}] ${fromAddr} | ${subject} | 0 attachments (skipped)`);
                  continue;
                }

                console.log(`[scan:${label}:${uid}] ${fromAddr} | ${subject} | ${attachments.length} attachment(s)`);

                const filenames = [];
                attachments.forEach((att, idx) => {
                  const id = makeDocId(label, uid, idx);
                  const size = (att.size || 0) / 1024;
                  const filename = att.filename || `attachment-${idx}`;
                  filenames.push(filename);
                  console.log(`  ├─ [${idx}] ${filename} (${size.toFixed(1)}KB)`);

                  const doc = {
                    id,
                    filename,
                    sender: { name: fromName, initials: initials(fromName) },
                    date: parsed.date || new Date(),
                    size: att.size || 0,
                    amount: null,
                    email: {
                      subject: subject,
                      from: fromAddr,
                      date: parsed.date || new Date(),
                      snippet: snippetOf(parsed.text),
                      full: parsed.text || '',
                    },
                    label,
                  };

                  db.insertDocuments([doc]);
                  db.getDb().prepare('INSERT OR REPLACE INTO attachment_index (id, uid, attachment_index, label) VALUES (?, ?, ?, ?)')
                    .run(id, uid, idx, label);
                  docCount++;
                });

                emit(progressCallback, {
                  type: 'found',
                  label,
                  uid,
                  from: fromAddr,
                  subject,
                  attachments: filenames,
                  found: docCount,
                  scanned: status.scanned,
                  total: status.scanTotal,
                  skipped: skippedCount,
                  errors: errorCount,
                });
              } catch (emailErr) {
                errorCount++;
                console.warn(`[scan:${label}:${uid}] ERROR: ${emailErr.message}`);
                emit(progressCallback, {
                  type: 'message_error',
                  label,
                  uid,
                  error: emailErr.message,
                  errors: errorCount,
                });
              }
            }
          } finally {
            lock.release();
          }
        });

        if (cancelled || shouldStopScan()) {
          cancelled = true;
          break labelLoop;
        }

        emit(progressCallback, {
          type: 'label_done',
          label,
          found: docCount,
          skipped: skippedCount,
          errors: errorCount,
        });
        console.log(`[scan] Completed label: ${label}`);
      } catch (labelErr) {
        errorCount++;
        console.warn(`[scan] ERROR label ${label}: ${labelErr.message}`);
        emit(progressCallback, {
          type: 'label_error',
          label,
          error: labelErr.message,
          errors: errorCount,
        });
      }
    }
    } // end !cancelled early

    rebuildAttachmentIndex();
    db.updateSyncStatus(new Date(), docCount);

    const dbStatus = db.getSyncStatus();
    status = {
      lastScan: dbStatus.lastScan,
      messageCount: dbStatus.messageCount,
      error: null,
      scanning: false,
      paused: false,
      cancelled,
      found: docCount,
      skipped: skippedCount,
      errors: errorCount,
      scanned: status.scanned,
      scanTotal: status.scanTotal,
    };
  } catch (err) {
    status = {
      lastScan: status.lastScan,
      messageCount: status.messageCount,
      error: err.message,
      scanning: false,
      paused: false,
      cancelled: syncControl.cancelled,
    };
  }
  progressCallback = null;
  return status;
}

function getDocuments() {
  return db.getDocuments();
}

function getStatus() {
  return {
    configured: isConfigured(),
    connected: !status.error && !!status.lastScan,
    scanning: Boolean(status.scanning),
    paused: Boolean(status.paused || syncControl.paused),
    cancelled: Boolean(status.cancelled),
    lastScan: status.lastScan || null,
    messageCount: status.messageCount || 0,
    error: status.error || null,
    scanned: status.scanned || 0,
    scanTotal: status.scanTotal || 0,
    found: status.found || 0,
    skipped: status.skipped || 0,
    errors: status.errors || 0,
  };
}

async function downloadAttachment(id) {
  if (inflightDownloads.has(id)) {
    return inflightDownloads.get(id);
  }

  const promise = downloadAttachmentUncached(id).finally(() => {
    inflightDownloads.delete(id);
  });
  inflightDownloads.set(id, promise);
  return promise;
}

async function downloadAttachmentUncached(id) {
  const cached = attachmentCache.get(id);
  if (cached) {
    const meta = db.getDocumentMeta(id);
    const filename =
      (meta && meta.filename) ||
      cached.filename ||
      cached.sourceFilename;
    console.log(`[download] Cache hit ${id} (${cached.buffer.length} bytes)`);
    return {
      buffer: cached.buffer,
      filename,
      sourceFilename: cached.sourceFilename,
      contentType: cached.contentType,
      size: cached.size,
      mtimeMs: cached.mtimeMs,
      fromCache: true,
    };
  }

  const ref = db.getAttachmentRef(id);
  if (!ref) {
    console.warn(`[download] No attachment ref for ${id}`);
    return null;
  }

  const doc = db.getDocuments().find((d) => d.id === id);
  if (!doc) {
    console.warn(`[download] Document not found: ${id}`);
    return null;
  }

  console.log(`[download] Cache miss ${id} — fetching via IMAP`);
  const file = await withImapClient(async (client) => {
    const lock = await client.getMailboxLock(doc.label || 'INBOX');
    try {
      const fetched = await fetchAttachmentFromImap(client, doc, ref);
      if (!fetched) return null;
      const meta = db.getDocumentMeta(id);
      const sourceFilename = fetched.sourceFilename || 'attachment';
      const filename = (meta && meta.filename) || sourceFilename;
      return {
        buffer: fetched.buffer,
        filename,
        sourceFilename,
        contentType: fetched.contentType || 'application/octet-stream',
      };
    } finally {
      lock.release();
    }
  });

  if (file) {
    attachmentCache.put(id, file);
    return {
      ...file,
      size: file.buffer.length,
      mtimeMs: Date.now(),
      fromCache: false,
    };
  }
  return null;
}

async function downloadZipStream(ids, res) {
  const archiver = require('archiver');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  for (const id of ids) {
    try {
      const file = await downloadAttachment(id);
      if (!file) continue;
      archive.append(file.buffer, { name: file.filename || id });
    } catch (err) {
      console.warn(`Failed to download zip entry ${id}:`, err.message);
    }
  }

  await archive.finalize();
}

module.exports = {
  scan,
  startSyncJob,
  pauseSyncJob,
  resumeSyncJob,
  cancelSyncJob,
  subscribeSync,
  getSyncSnapshot,
  getDocuments,
  getStatus,
  getSyncConfig,
  listMailboxes,
  downloadAttachment,
  downloadZipStream,
  isConfigured,
  rebuildAttachmentIndex,
};
