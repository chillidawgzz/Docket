'use strict';

const EXT_MIME = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.jfif': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.log': 'text/plain',
  '.ics': 'text/calendar',
  '.eml': 'message/rfc822',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function extOf(filename) {
  const m = String(filename || '').toLowerCase().match(/(\.[a-z0-9]+)$/);
  return m ? m[1] : '';
}

function resolveContentType(filename, contentType) {
  let ct = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (!ct || ct === 'application/octet-stream') {
    ct = EXT_MIME[extOf(filename)] || ct || 'application/octet-stream';
  }
  // Mail clients sometimes send non-standard JPEG MIME types
  if (ct === 'image/jpg' || ct === 'image/pjpeg' || ct === 'image/x-jpeg') {
    ct = 'image/jpeg';
  }
  return ct;
}

function isPreviewable(filename, contentType) {
  const ct = resolveContentType(filename, contentType);
  const ext = extOf(filename);

  if (
    ct.startsWith('image/') ||
    ['.png', '.jpg', '.jpeg', '.jpe', '.jfif', '.gif', '.webp', '.bmp', '.svg'].includes(ext)
  ) return true;
  if (ct.startsWith('audio/')) return true;
  if (ct.startsWith('video/')) return true;
  if (ct.startsWith('text/')) return true;
  if (ct === 'application/pdf') return true;
  if (ct === 'application/json' || ct === 'application/xml') return true;
  if (ct === 'text/calendar' || ext === '.ics') return true;
  if (ct === 'message/rfc822' || ext === '.eml') return true;
  if (
    ct.includes('wordprocessingml.document') ||
    ext === '.docx'
  ) return true;
  if (
    ct.includes('spreadsheetml.sheet') ||
    ext === '.xlsx'
  ) return true;

  return false;
}

module.exports = { resolveContentType, isPreviewable, extOf };
