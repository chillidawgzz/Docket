const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data.db');
let db;

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
  `);

  return db;
}

function insertDocuments(docs) {
  if (!db) throw new Error('DB not initialized');
  const insertDoc = db.prepare(`
    INSERT OR REPLACE INTO documents
    (id, filename, sender_name, sender_initials, category, date, size, subject, "from", snippet, full_text, label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAttach = db.prepare(`
    INSERT OR REPLACE INTO attachment_index
    (id, uid, attachment_index, label)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    docs.forEach((doc) => {
      insertDoc.run(
        doc.id,
        doc.filename,
        doc.sender.name,
        doc.sender.initials,
        doc.category,
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

function getDocuments() {
  if (!db) throw new Error('DB not initialized');
  const docs = db.prepare('SELECT * FROM documents ORDER BY date DESC').all();
  return docs.map((row) => ({
    id: row.id,
    filename: row.filename,
    sender: { name: row.sender_name, initials: row.sender_initials },
    category: row.category,
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

function clearDocuments() {
  if (!db) throw new Error('DB not initialized');
  db.exec('DELETE FROM documents; DELETE FROM attachment_index;');
}

function updateSyncStatus(lastScan, count) {
  if (!db) throw new Error('DB not initialized');
  db.prepare('INSERT OR REPLACE INTO sync_status (key, last_scan, total_count) VALUES (?, ?, ?)')
    .run('main', lastScan.toISOString(), count);
}

function getSyncStatus() {
  if (!db) throw new Error('DB not initialized');
  const row = db.prepare('SELECT last_sync, total_count FROM sync_status WHERE key = ?').get('main');
  if (!row) return { lastScan: null, messageCount: 0 };
  return { lastScan: row.last_sync ? new Date(row.last_sync) : null, messageCount: row.total_count };
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
  clearDocuments,
  updateSyncStatus,
  getSyncStatus,
  getLatestMessageDate,
};
