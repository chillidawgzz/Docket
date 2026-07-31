const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('./db');
const attachmentCache = require('./attachmentCache');

const config = {
  host: process.env.IMAP_HOST || 'imap.gmail.com',
  port: Number(process.env.IMAP_PORT) || 993,
  labels: (process.env.IMAP_LABELS || 'INBOX').split(',').map((l) => l.trim()),
  sinceDays: Number(process.env.IMAP_SINCE_DAYS) || 730,
  maxMessages: Number(process.env.IMAP_MAX_MESSAGES) || 2000,
};

function isConfigured() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
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

// In-memory state (for current session only; DB is source of truth)
let attachmentIndex = new Map();
let status = { lastScan: null, messageCount: 0, error: null, scanning: false };
let progressCallback = null;
const inflightDownloads = new Map();

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

async function scan(onProgress) {
  if (!isConfigured()) {
    status = { lastScan: status.lastScan, messageCount: status.messageCount, error: 'not configured', scanning: false };
    return status;
  }
  progressCallback = onProgress;
  status.scanning = true;
  status.error = null;
  status.scanned = 0;
  status.scanTotal = 0;
  try {
    const newAttachmentIndex = new Map();
    let docCount = 0;

    const latestDate = db.getLatestMessageDate();
    const since = latestDate || new Date(Date.now() - config.sinceDays * 24 * 60 * 60 * 1000);

    for (const label of config.labels) {
      try {
        console.log(`[scan] Starting label: ${label}`);
        await withImapClient(async (client) => {
          const lock = await client.getMailboxLock(label);
          try {
            const uids = await client.search({ since }, { uid: true });
            const boundedUids = uids.slice(-config.maxMessages);
            console.log(`[scan] Found ${boundedUids.length} emails in ${label} since ${since.toISOString()}`);
            status.scanTotal += boundedUids.length;

            for (const uid of boundedUids) {
              status.scanned++;
              if (progressCallback) progressCallback({ scanned: status.scanned, total: status.scanTotal });

              try {
                const { content } = await client.download(String(uid), undefined, { uid: true });
                const parsed = await simpleParser(content);
                const attachments = (parsed.attachments || []).filter(isAttachmentWanted);

                const fromAddr = parsed.from && parsed.from.value[0] ? parsed.from.value[0].address : '';
                const fromName = parsed.from && parsed.from.value[0] ? (parsed.from.value[0].name || fromAddr) : 'Unknown';
                const subject = parsed.subject || '(no subject)';

                if (!attachments.length) {
                  console.log(`[scan:${label}:${uid}] ${fromAddr} | ${subject} | 0 attachments (skipped)`);
                  continue;
                }

                console.log(`[scan:${label}:${uid}] ${fromAddr} | ${subject} | ${attachments.length} attachment(s)`);

                attachments.forEach((att, idx) => {
                  const id = `doc-${uid}-${idx}`;
                  const size = (att.size || 0) / 1024;
                  console.log(`  ├─ [${idx}] ${att.filename || `attachment-${idx}`} (${size.toFixed(1)}KB)`);

                  const doc = {
                    id,
                    filename: att.filename || `attachment-${idx}`,
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

                  // Insert immediately (incremental persistence)
                  db.insertDocuments([doc]);
                  db.getDb().prepare('INSERT OR REPLACE INTO attachment_index (id, uid, attachment_index, label) VALUES (?, ?, ?, ?)')
                    .run(id, uid, idx, label);
                  newAttachmentIndex.set(id, { uid, attachmentIndex: idx });
                  docCount++;
                });
              } catch (emailErr) {
                console.warn(`[scan:${label}:${uid}] ERROR: ${emailErr.message}`);
              }
            }
          } finally {
            lock.release();
          }
        });
        console.log(`[scan] Completed label: ${label}`);
      } catch (labelErr) {
        console.warn(`[scan] ERROR label ${label}: ${labelErr.message}`);
        // Continue to next label on error (continue-on-error strategy)
      }
    }

    attachmentIndex = newAttachmentIndex;

    // Update sync status (documents + attachments already inserted incrementally)
    db.updateSyncStatus(new Date(), docCount);

    const dbStatus = db.getSyncStatus();
    status = { lastScan: dbStatus.lastScan, messageCount: dbStatus.messageCount, error: null, scanning: false };
  } catch (err) {
    status = { lastScan: status.lastScan, messageCount: status.messageCount, error: err.message, scanning: false };
  }
  progressCallback = null;
  return status;
}

function getDocuments() {
  return db.getDocuments();
}

function getStatus() {
  return { configured: isConfigured(), connected: !status.error && !!status.lastScan, ...status };
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
      (meta && meta.download_filename) ||
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
      const { content } = await client.download(String(ref.uid), undefined, { uid: true });
      const parsed = await simpleParser(content);
      const att = parsed.attachments[ref.attachment_index];
      if (!att) return null;
      const meta = db.getDocumentMeta(id);
      const sourceFilename =
        att.filename || (meta && meta.filename) || 'attachment';
      const filename =
        (meta && meta.download_filename) || sourceFilename;
      return {
        buffer: att.content,
        filename,
        sourceFilename,
        contentType: att.contentType || 'application/octet-stream',
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

module.exports = { scan, getDocuments, getStatus, downloadAttachment, downloadZipStream, isConfigured, rebuildAttachmentIndex };
