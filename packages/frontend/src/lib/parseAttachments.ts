export interface IcsEvent {
  summary: string
  start: string
  end: string
  location: string
  description: string
  organizer: string
}

function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function field(block: string, name: string): string {
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'im')
  const m = block.match(re)
  return m ? m[1].trim().replace(/\\n/g, '\n').replace(/\\,/g, ',') : ''
}

function formatIcsDate(raw: string): string {
  if (!raw) return ''
  // VALUE=DATE:20260719 or 20260719T180000Z
  const cleaned = raw.replace(/^.*:/, '').trim()
  const m = cleaned.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/,
  )
  if (!m) return raw
  const [, y, mo, d, h, mi] = m
  if (h != null) {
    return `${y}-${mo}-${d} ${h}:${mi}`
  }
  return `${y}-${mo}-${d}`
}

export function parseIcs(text: string): IcsEvent | null {
  const unfolded = unfold(text)
  const match = unfolded.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/i)
  if (!match) return null
  const block = match[1]
  return {
    summary: field(block, 'SUMMARY') || '(no title)',
    start: formatIcsDate(field(block, 'DTSTART')),
    end: formatIcsDate(field(block, 'DTEND')),
    location: field(block, 'LOCATION'),
    description: field(block, 'DESCRIPTION'),
    organizer: field(block, 'ORGANIZER').replace(/^MAILTO:/i, ''),
  }
}

export interface EmlSummary {
  from: string
  to: string
  subject: string
  date: string
  body: string
}

export function parseEml(text: string): EmlSummary {
  const split = text.indexOf('\r\n\r\n')
  const splitN = text.indexOf('\n\n')
  let headerEnd = -1
  if (split >= 0 && (splitN < 0 || split <= splitN)) headerEnd = split + 4
  else if (splitN >= 0) headerEnd = splitN + 2

  const headerPart = headerEnd >= 0 ? text.slice(0, headerEnd) : text
  const bodyPart = headerEnd >= 0 ? text.slice(headerEnd) : ''

  const headers: Record<string, string> = {}
  let current = ''
  for (const line of headerPart.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && current) {
      headers[current] += ' ' + line.trim()
      continue
    }
    const m = line.match(/^([^:]+):\s*(.*)$/)
    if (m) {
      current = m[1].toLowerCase()
      headers[current] = m[2]
    }
  }

  // Strip simple quoted-printable / base64 bodies poorly — show raw truncated text
  let body = bodyPart
  // If multipart, try to find text/plain part crudely
  const plain = bodyPart.match(
    /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|\r?\nContent-Type:|$)/i,
  )
  if (plain) body = plain[1]

  body = body
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .trim()

  if (body.length > 8000) body = body.slice(0, 8000) + '\n…'

  return {
    from: headers.from || '',
    to: headers.to || '',
    subject: headers.subject || '(no subject)',
    date: headers.date || '',
    body: body || '(empty body)',
  }
}
