const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.db');
let db;

function hasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function init() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      sender_name TEXT,
      sender_initials TEXT,
      category TEXT,
      date TEXT NOT NULL,
      size INTEGER,
      subject TEXT,
      "from" TEXT,
      snippet TEXT,
      full_text TEXT,
      label TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS attachment_index (
      id TEXT PRIMARY KEY,
      uid INTEGER NOT NULL,
      attachment_index INTEGER NOT NULL,
      label TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_status (
      key TEXT PRIMARY KEY,
      last_sync TEXT,
      total_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );
    CREATE TABLE IF NOT EXISTS document_tags (
      document_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (document_id, tag_id)
    );
  `);

  if (!hasColumn('documents', 'download_filename')) {
    db.exec('ALTER TABLE documents ADD COLUMN download_filename TEXT');
  }

  return db;
}

function insertDocuments(docs) {
  if (!db) throw new Error('DB not initialized');
  const upsert = db.prepare(`
    INSERT INTO documents
    (id, filename, sender_name, sender_initials, date, size, subject, "from", snippet, full_text, label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      sender_name = excluded.sender_name,
      sender_initials = excluded.sender_initials,
      date = excluded.date,
      size = excluded.size,
      subject = excluded.subject,
      "from" = excluded."from",
      snippet = excluded.snippet,
      full_text = excluded.full_text,
      label = excluded.label
  `);

  const transaction = db.transaction(() => {
    docs.forEach((doc) => {
      upsert.run(
        doc.id,
        doc.filename,
        doc.sender.name,
        doc.sender.initials,
        doc.date.toISOString(),
        doc.size,
        doc.email.subject,
        doc.email.from,
        doc.email.snippet,
        doc.email.full,
        doc.label
      );
    });
  });

  transaction();
}

function insertAttachmentIndex(index, label) {
  if (!db) throw new Error('DB not initialized');
  const insert = db.prepare(`
    INSERT OR REPLACE INTO attachment_index
    (id, uid, attachment_index, label)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    index.forEach((ref, id) => {
      insert.run(id, ref.uid, ref.attachmentIndex, label);
    });
  });

  transaction();
}

function getTagsForDocument(documentId) {
  return db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN document_tags dt ON dt.tag_id = t.id
       WHERE dt.document_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(documentId)
    .map((r) => r.name);
}

function getDocuments() {
  if (!db) throw new Error('DB not initialized');
  const docs = db.prepare('SELECT * FROM documents ORDER BY date DESC').all();
  return docs.map((row) => ({
    id: row.id,
    filename: row.filename,
    downloadFilename: row.download_filename || null,
    sender: { name: row.sender_name, initials: row.sender_initials },
    tags: getTagsForDocument(row.id),
    date: new Date(row.date),
    size: row.size,
    amount: null,
    email: {
      subject: row.subject,
      from: row['from'],
      date: new Date(row.date),
      snippet: row.snippet,
      full: row.full_text,
    },
    label: row.label,
  }));
}

function getAttachmentRef(id) {
  if (!db) throw new Error('DB not initialized');
  return db.prepare('SELECT uid, attachment_index FROM attachment_index WHERE id = ?').get(id);
}

function getDocumentMeta(id) {
  if (!db) throw new Error('DB not initialized');
  return db
    .prepare('SELECT id, filename, download_filename FROM documents WHERE id = ?')
    .get(id);
}

function setDownloadFilename(id, downloadFilename) {
  if (!db) throw new Error('DB not initialized');
  const value =
    downloadFilename == null || String(downloadFilename).trim() === ''
      ? null
      : String(downloadFilename).trim();
  const result = db
    .prepare('UPDATE documents SET download_filename = ? WHERE id = ?')
    .run(value, id);
  return result.changes > 0;
}

function listTags() {
  if (!db) throw new Error('DB not initialized');
  return db
    .prepare(
      `SELECT t.name AS name, COUNT(dt.document_id) AS count
       FROM tags t
       LEFT JOIN document_tags dt ON dt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE`
    )
    .all();
}

function ensureTag(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed);
  return db.prepare('SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE').get(trimmed);
}

function setDocumentTags(documentId, tagNames) {
  if (!db) throw new Error('DB not initialized');
  const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(documentId);
  if (!doc) return false;

  const names = Array.from(
    new Set(
      (tagNames || [])
        .map((t) => String(t || '').trim())
        .filter(Boolean)
    )
  );

  const clear = db.prepare('DELETE FROM document_tags WHERE document_id = ?');
  const link = db.prepare(
    'INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)'
  );

  const tx = db.transaction(() => {
    clear.run(documentId);
    for (const name of names) {
      const tag = ensureTag(name);
      if (tag) link.run(documentId, tag.id);
    }
  });
  tx();
  return true;
}

function clearDocuments() {
  if (!db) throw new Error('DB not initialized');
  db.exec('DELETE FROM documents; DELETE FROM attachment_index; DELETE FROM document_tags;');
}

function updateSyncStatus(lastScan, count) {
  if (!db) throw new Error('DB not initialized');
  // Support both schemas: last_sync (older) or last_scan if present
  const cols = db.prepare('PRAGMA table_info(sync_status)').all().map((c) => c.name);
  if (cols.includes('last_scan')) {
    db.prepare('INSERT OR REPLACE INTO sync_status (key, last_scan, total_count) VALUES (?, ?, ?)')
      .run('main', lastScan.toISOString(), count);
  } else {
    db.prepare('INSERT OR REPLACE INTO sync_status (key, last_sync, total_count) VALUES (?, ?, ?)')
      .run('main', lastScan.toISOString(), count);
  }
}

function getSyncStatus() {
  if (!db) throw new Error('DB not initialized');
  const row = db.prepare('SELECT * FROM sync_status WHERE key = ?').get('main');
  if (!row) return { lastScan: null, messageCount: 0 };
  const last = row.last_scan || row.last_sync;
  return { lastScan: last ? new Date(last) : null, messageCount: row.total_count || 0 };
}

function getLatestMessageDate() {
  if (!db) throw new Error('DB not initialized');
  const row = db.prepare('SELECT MAX(date) as maxDate FROM documents').get();
  return row?.maxDate ? new Date(row.maxDate) : null;
}

function getDb() {
  return db;
}

module.exports = {
  init,
  getDb,
  insertDocuments,
  insertAttachmentIndex,
  getDocuments,
  getAttachmentRef,
  getDocumentMeta,
  setDownloadFilename,
  listTags,
  setDocumentTags,
  clearDocuments,
  updateSyncStatus,
  getSyncStatus,
  getLatestMessageDate,
};
