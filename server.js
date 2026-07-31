require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const imapClient = require('./lib/imapClient');
const db = require('./lib/db');
const { resolveContentType, isPreviewable } = require('./lib/previewTypes');

const LOG_FILE = path.join(__dirname, 'sync.log');
const FRONTEND_DIST = path.join(__dirname, 'packages', 'frontend', 'dist');

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

app.patch('/api/documents/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { downloadFilename, tags } = req.body || {};
    let updated = false;

    if (downloadFilename !== undefined) {
      if (!db.setDownloadFilename(id, downloadFilename)) {
        return res.status(404).json({ error: 'not found' });
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
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/download', async (req, res) => {
  try {
    const file = await imapClient.downloadAttachment(req.params.id);
    if (!file) return res.status(404).json({ error: 'not found' });
    res.setHeader('Content-Type', file.contentType);
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

app.post('/api/sync', async (req, res) => {
  log('Sync started');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (data) => {
    const event = typeof data === 'object' && !data.type ? { type: 'progress', ...data } : data;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const status = await imapClient.scan(sendEvent);
    log(`Sync complete: ${status.messageCount} documents, error: ${status.error || 'none'}`);
    sendEvent({ type: 'complete', status });
    res.end();
  } catch (err) {
    log(`Sync error: ${err.message}`);
    sendEvent({ type: 'error', error: err.message });
    res.end();
  }
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
    console.log(`[preview] Serving ${previewName} as ${contentType} (${file.buffer.length} bytes)`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Filename', encodeURIComponent(previewName));
    res.setHeader('Cache-Control', 'private, max-age=300');
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
