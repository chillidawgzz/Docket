export type PreviewKind =
  | 'pdf'
  | 'image'
  | 'text'
  | 'audio'
  | 'video'
  | 'ics'
  | 'eml'
  | 'docx'
  | 'xlsx'
  | 'none'

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/(\.[a-z0-9]+)$/)
  return m ? m[1] : ''
}

export function detectPreviewKind(
  contentType: string,
  filename: string,
): PreviewKind {
  const ct = contentType.toLowerCase().split(';')[0].trim()
  const ext = extOf(filename)

  if (ct === 'application/pdf' || ext === '.pdf') return 'pdf'
  // Normalize non-standard JPEG MIME types from mail clients
  const isJpegMime =
    ct === 'image/jpeg' ||
    ct === 'image/jpg' ||
    ct === 'image/pjpeg' ||
    ct === 'image/x-jpeg'
  if (
    isJpegMime ||
    ct.startsWith('image/') ||
    ['.png', '.jpg', '.jpeg', '.jpe', '.jfif', '.gif', '.webp', '.bmp', '.svg'].includes(ext)
  )
    return 'image'
  if (ct.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext))
    return 'audio'
  if (ct.startsWith('video/') || ['.mp4', '.webm'].includes(ext)) return 'video'
  if (ct === 'text/calendar' || ext === '.ics') return 'ics'
  if (ct === 'message/rfc822' || ext === '.eml') return 'eml'
  if (ct.includes('wordprocessingml.document') || ext === '.docx') return 'docx'
  if (ct.includes('spreadsheetml.sheet') || ext === '.xlsx') return 'xlsx'
  if (
    ct.startsWith('text/') ||
    ct === 'application/json' ||
    ct === 'application/xml' ||
    ['.txt', '.md', '.csv', '.json', '.xml', '.log'].includes(ext)
  )
    return 'text'

  return 'none'
}
