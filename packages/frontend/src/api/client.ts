import type {
  Document,
  DocumentDTO,
  SenderGroupsStateDTO,
  SyncConfig,
  SyncEvent,
  SyncOptions,
  SyncStatus,
  TagInfo,
} from './types'

function normalizeDoc(d: DocumentDTO): Document {
  return {
    id: d.id,
    filename: d.filename,
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

async function senderGroupsResponse(res: Response): Promise<SenderGroupsStateDTO> {
  if (!res.ok) throw new Error('sender groups failed')
  return res.json()
}

export async function fetchSenderGroups(): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(await fetch('/api/sender-groups'))
}

export async function createSenderGroup(
  name: string,
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch('/api/sender-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  )
}

export async function patchSenderGroup(
  id: number,
  body: { name?: string; collapsed?: boolean; hidden?: boolean },
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch(`/api/sender-groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

export async function deleteSenderGroup(
  id: number,
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch(`/api/sender-groups/${id}`, { method: 'DELETE' }),
  )
}

export async function setSenderGroupMembers(
  id: number,
  senders: string[],
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch(`/api/sender-groups/${id}/members`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senders }),
    }),
  )
}

export async function addSenderToGroup(
  id: number,
  sender: string,
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch(`/api/sender-groups/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender }),
    }),
  )
}

export async function removeSenderFromGroup(
  id: number,
  sender: string,
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch(
      `/api/sender-groups/${id}/members/${encodeURIComponent(sender)}`,
      { method: 'DELETE' },
    ),
  )
}

export async function setSenderHidden(
  sender: string,
  hidden: boolean,
): Promise<SenderGroupsStateDTO> {
  const path = `/api/hidden-senders/${encodeURIComponent(sender)}`
  return senderGroupsResponse(
    await fetch(path, { method: hidden ? 'POST' : 'DELETE' }),
  )
}

export async function reorderSenderGroups(
  ids: number[],
): Promise<SenderGroupsStateDTO> {
  return senderGroupsResponse(
    await fetch('/api/sender-groups/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }),
  )
}

export async function patchDocument(
  id: string,
  body: { filename?: string; tags?: string[] },
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

export async function fetchSyncConfig(): Promise<SyncConfig> {
  const res = await fetch('/api/sync/config')
  if (!res.ok) throw new Error('sync config failed')
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

export async function startSyncJob(
  options: SyncOptions = {},
): Promise<{ started: boolean; alreadyRunning: boolean; error?: string }> {
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!res.ok) throw new Error('sync failed')
  return res.json()
}

export async function pauseSyncJob(): Promise<void> {
  const res = await fetch('/api/sync/pause', { method: 'POST' })
  if (!res.ok) throw new Error('pause failed')
}

export async function resumeSyncJob(): Promise<void> {
  const res = await fetch('/api/sync/resume', { method: 'POST' })
  if (!res.ok) throw new Error('resume failed')
}

export async function cancelSyncJob(): Promise<void> {
  const res = await fetch('/api/sync/cancel', { method: 'POST' })
  if (!res.ok) throw new Error('cancel failed')
}

/** Subscribe to sync SSE (replays history, then live events). Resolves on complete/error or abort. */
export async function watchSyncEvents(
  onEvent: (event: SyncEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/sync/events', {
    method: 'GET',
    signal,
    headers: { Accept: 'text/event-stream' },
  })
  if (!res.ok || !res.body) throw new Error('sync events failed')

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
      if (!trimmed.startsWith('data: ')) continue
      try {
        const event = JSON.parse(trimmed.slice(6)) as SyncEvent
        onEvent(event)
        if (
          event.type === 'complete' ||
          event.type === 'error' ||
          event.type === 'cancelled'
        ) {
          try {
            await reader.cancel()
          } catch {
            /* ignore */
          }
          return
        }
        if (event.type === 'snapshot' && !event.status.scanning) {
          try {
            await reader.cancel()
          } catch {
            /* ignore */
          }
          return
        }
      } catch {
        /* ignore malformed SSE */
      }
    }
  }
}
