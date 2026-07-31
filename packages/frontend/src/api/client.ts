import type { Document, DocumentDTO, SyncEvent, SyncStatus, TagInfo } from './types'

function normalizeDoc(d: DocumentDTO): Document {
  return {
    id: d.id,
    filename: d.filename,
    downloadFilename: d.downloadFilename ?? null,
    sender: d.sender,
    tags: Array.isArray(d.tags) ? d.tags : [],
    date: new Date(d.date),
    size: d.size,
    amount: d.amount,
    email: {
      ...d.email,
      date: new Date(d.email.date),
    },
    label: d.label,
  }
}

export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch('/api/documents')
  if (!res.ok) throw new Error('request failed')
  const data: DocumentDTO[] = await res.json()
  return data
    .map(normalizeDoc)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
}

export async function fetchTags(): Promise<TagInfo[]> {
  const res = await fetch('/api/tags')
  if (!res.ok) throw new Error('tags failed')
  return res.json()
}

export async function patchDocument(
  id: string,
  body: { downloadFilename?: string | null; tags?: string[] },
): Promise<Document> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('update failed')
  return normalizeDoc(await res.json())
}

export async function fetchStatus(): Promise<SyncStatus> {
  const res = await fetch('/api/status')
  if (!res.ok) throw new Error('status failed')
  return res.json()
}

export function downloadUrl(id: string): string {
  return `/api/documents/${encodeURIComponent(id)}/download`
}

export function previewUrl(id: string): string {
  return `/api/documents/${encodeURIComponent(id)}/preview`
}

export function zipUrl(ids: string[]): string {
  return `/api/documents/zip?ids=${ids.map(encodeURIComponent).join(',')}`
}

export async function fetchPreview(
  id: string,
): Promise<{ blob: Blob; contentType: string; filename: string } | null> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}/preview`)
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return null
  }
  const rawName =
    res.headers.get('x-filename') ||
    res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] ||
    ''
  let filename = rawName
  try {
    filename = decodeURIComponent(rawName)
  } catch {
    /* keep raw */
  }
  const blob = await res.blob()
  return { blob, contentType, filename }
}

export async function startSync(
  onEvent: (event: SyncEvent) => void,
): Promise<void> {
  const res = await fetch('/api/sync', { method: 'POST' })
  if (!res.ok || !res.body) throw new Error('sync failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data: ')) {
        try {
          onEvent(JSON.parse(trimmed.slice(6)) as SyncEvent)
        } catch {
          /* ignore malformed SSE */
        }
      }
    }
  }
}
