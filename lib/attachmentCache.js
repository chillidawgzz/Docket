const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'attachments');

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function pathsFor(id) {
  const key = safeId(id);
  return {
    data: path.join(CACHE_DIR, key),
    meta: path.join(CACHE_DIR, `${key}.meta.json`),
  };
}

/**
 * @returns {{ buffer: Buffer, contentType: string, sourceFilename: string, filename: string, size: number, mtimeMs: number } | null}
 */
function get(id) {
  const { data, meta } = pathsFor(id);
  if (!fs.existsSync(data) || !fs.existsSync(meta)) return null;
  try {
    const info = JSON.parse(fs.readFileSync(meta, 'utf8'));
    const buffer = fs.readFileSync(data);
    const st = fs.statSync(data);
    return {
      buffer,
      contentType: info.contentType || 'application/octet-stream',
      sourceFilename: info.sourceFilename || 'attachment',
      filename: info.filename || info.sourceFilename || 'attachment',
      size: buffer.length,
      mtimeMs: st.mtimeMs,
    };
  } catch (err) {
    console.warn(`[cache] Failed to read ${id}: ${err.message}`);
    return null;
  }
}

/**
 * @param {string} id
 * @param {{ buffer: Buffer, contentType: string, sourceFilename: string, filename: string }} file
 */
function put(id, file) {
  ensureDir();
  const { data, meta } = pathsFor(id);
  const tmpData = `${data}.tmp`;
  const tmpMeta = `${meta}.tmp`;
  try {
    fs.writeFileSync(tmpData, file.buffer);
    fs.writeFileSync(
      tmpMeta,
      JSON.stringify({
        contentType: file.contentType || 'application/octet-stream',
        sourceFilename: file.sourceFilename || 'attachment',
        filename: file.filename || file.sourceFilename || 'attachment',
      }),
    );
    fs.renameSync(tmpData, data);
    fs.renameSync(tmpMeta, meta);
  } catch (err) {
    console.warn(`[cache] Failed to write ${id}: ${err.message}`);
    try {
      fs.unlinkSync(tmpData);
    } catch (_) {}
    try {
      fs.unlinkSync(tmpMeta);
    } catch (_) {}
  }
}

function etagFor(id, size, mtimeMs) {
  return `"${safeId(id)}-${size}-${Math.floor(mtimeMs || 0)}"`;
}

module.exports = { get, put, etagFor, CACHE_DIR };
