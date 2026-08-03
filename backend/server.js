require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const express = require('express');
const imapClient = require('./lib/imapClient');
const db = require('./lib/db');
const { resolveContentType, isPreviewable } = require('./lib/previewTypes');
const attachmentCache = require('./lib/attachmentCache');

const ROOT = path.join(__dirname, '..');
const LOG_FILE = path.join(ROOT, 'sync.log');
const FRONTEND_DIST = path.join(ROOT, 'packages', 'frontend', 'dist');

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

// Capture all console.log/warn to file
const originalLog = console.log;
const originalWarn = console.warn;

console.log = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  fs.appendFileSync(LOG_FILE, msg + '\n');
  originalLog.apply(console, args);
};

console.warn = function(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  fs.appendFileSync(LOG_FILE, msg + '\n');
  originalWarn.apply(console, args);
};

const app = express();
const PORT = Number(process.env.PORT) || 8420;

app.use(express.json({ limit: '1mb' }));

app.get('/api/documents', (req, res) => {
  res.json(imapClient.getDocuments());
});

app.get('/api/tags', (req, res) => {
  res.json(db.listTags());
});

app.get('/api/sender-groups', (req, res) => {
  try {
    res.json(db.listSenderGroupsState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sender-groups', (req, res) => {
  try {
    const group = db.createSenderGroup(req.body?.name);
    if (!group) return res.status(400).json({ error: 'invalid name' });
    res.status(201).json(db.listSenderGroupsState());
  } catch (err) {
    if (err.code === 'DUPLICATE') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sender-groups/reorder', (req, res) => {
  try {
    res.json(db.reorderSenderGroups(req.body?.ids || []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sender-groups/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const group = db.updateSenderGroup(id, req.body || {});
    if (!group) return res.status(404).json({ error: 'not found' });
    res.json(db.listSenderGroupsState());
  } catch (err) {
    if (err.code === 'DUPLICATE' || err.code === 'INVALID') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sender-groups/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!db.deleteSenderGroup(id)) return res.status(404).json({ error: 'not found' });
    res.json(db.listSenderGroupsState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sender-groups/:id/members', (req, res) => {
  try {
    const id = Number(req.params.id);
    const group = db.setSenderGroupMembers(id, req.body?.senders || []);
    if (!group) return res.status(404).json({ error: 'not found' });
    res.json(db.listSenderGroupsState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sender-groups/:id/members', (req, res) => {
  try {
    const id = Number(req.params.id);
    const state = db.addSenderToGroup(id, req.body?.sender);
    if (!state) return res.status(404).json({ error: 'not found' });
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sender-groups/:id/members/:sender', (req, res) => {
  try {
    const id = Number(req.params.id);
    const sender = decodeURIComponent(req.params.sender);
    res.json(db.removeSenderFromGroup(id, sender));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hidden-senders/:sender', (req, res) => {
  try {
    const sender = decodeURIComponent(req.params.sender);
    res.json(db.setSenderHidden(sender, true));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/hidden-senders/:sender', (req, res) => {
  try {
    const sender = decodeURIComponent(req.params.sender);
    res.json(db.setSenderHidden(sender, false));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/hidden-senders', (req, res) => {
  try {
    res.json(db.setHiddenSenders(req.body?.senders || []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/documents/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { filename, tags } = req.body || {};
    let updated = false;

    if (filename !== undefined) {
      if (!db.setFilename(id, filename)) {
        return res.status(400).json({ error: 'invalid filename' });
      }
      updated = true;
    }
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'tags must be an array' });
      }
      if (!db.setDocumentTags(id, tags)) {
        return res.status(404).json({ error: 'not found' });
      }
      updated = true;
    }
    if (!updated) {
      return res.status(400).json({ error: 'no changes' });
    }
    const doc = imapClient.getDocuments().find((d) => d.id === id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const file = await imapClient.downloadAttachment(req.params.id);
    if (!file) return res.status(404).json({ error: 'not found' });
    const size = file.size || file.buffer.length;
    const etag = attachmentCache.etagFor(req.params.id, size, file.mtimeMs);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename.replace(/"/g, '')}"`);
    res.send(file.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/zip', async (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'no ids' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="documents.zip"');
  try {
    await imapClient.downloadZipStream(ids, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

app.get('/api/status', (req, res) => {
  res.json(imapClient.getStatus());
});

app.get('/api/sync/config', async (req, res) => {
  try {
    const config = imapClient.getSyncConfig();
    let mailboxes = [];
    try {
      mailboxes = await imapClient.listMailboxes();
    } catch (err) {
      console.warn('[sync/config] mailboxes:', err.message);
    }
    res.json({ ...config, mailboxes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync', (req, res) => {
  const options = {
    labels: req.body?.labels,
    sinceDays: req.body?.sinceDays,
    maxMessages: req.body?.maxMessages,
    fullRescan: req.body?.fullRescan,
  };
  const result = imapClient.startSyncJob(options);
  if (result.started) log('Sync started (background)');
  else if (result.alreadyRunning) log('Sync already running — client rejoining');
  else if (result.error) log(`Sync not started: ${result.error}`);
  res.json({ ...result, status: imapClient.getStatus() });
});

app.post('/api/sync/pause', (req, res) => {
  const result = imapClient.pauseSyncJob();
  if (result.ok) log('Sync paused');
  res.json({ ...result, status: imapClient.getStatus() });
});

app.post('/api/sync/resume', (req, res) => {
  const result = imapClient.resumeSyncJob();
  if (result.ok) log('Sync resumed');
  res.json({ ...result, status: imapClient.getStatus() });
});

app.post('/api/sync/cancel', (req, res) => {
  const result = imapClient.cancelSyncJob();
  if (result.ok) log('Sync cancel requested');
  res.json({ ...result, status: imapClient.getStatus() });
});

app.get('/api/sync/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      /* client gone */
    }
  };

  const unsubscribe = imapClient.subscribeSync(send);
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 15000);

  const cleanup = () => {
    clearInterval(ping);
    unsubscribe();
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
});

app.get('/api/documents/:id/preview', async (req, res) => {
  try {
    console.log(`[preview] Fetching ${req.params.id}`);
    const file = await imapClient.downloadAttachment(req.params.id);
    if (!file) {
      console.log(`[preview] File not found: ${req.params.id}`);
      return res.status(404).json({ error: 'not found' });
    }

    if (!isPreviewable(file.sourceFilename || file.filename, file.contentType)) {
      console.log(`[preview] Unsupported type: ${file.contentType} (${file.sourceFilename || file.filename})`);
      return res.status(415).json({
        error: 'preview not available',
        contentType: file.contentType,
        filename: file.sourceFilename || file.filename,
      });
    }

    const previewName = file.sourceFilename || file.filename;
    const contentType = resolveContentType(previewName, file.contentType);
    const size = file.size || file.buffer.length;
    const etag = attachmentCache.etagFor(req.params.id, size, file.mtimeMs);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    console.log(
      `[preview] Serving ${previewName} as ${contentType} (${size} bytes)` +
        (file.fromCache ? ' [cache]' : ' [imap]'),
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Filename', encodeURIComponent(previewName));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Disposition', `inline; filename="${previewName.replace(/"/g, '')}"`);
    res.send(file.buffer);
  } catch (err) {
    console.error(`[preview] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/locked', async (req, res) => {
  try {
    const file = await imapClient.downloadAttachment(req.params.id);
    if (!file) return res.status(404).json({ error: 'not found' });

    const contentType = file.contentType.toLowerCase();
    if (!contentType.includes('pdf')) {
      return res.json({ locked: false });
    }

    // Check if PDF is encrypted by looking for Encrypt dict
    const bufStr = file.buffer.toString('binary');
    const isLocked = /\/Encrypt\s+\d+\s+\d+\s+R/.test(bufStr);
    res.json({ locked: isLocked, filename: file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  log(`Frontend dist not found at ${FRONTEND_DIST} — run: npm run build`);
}

app.listen(PORT, '0.0.0.0', () => {
  log(`Docket server listening on 0.0.0.0:${PORT}`);
  db.init();
  log('Database initialized');
  imapClient.rebuildAttachmentIndex();
});
