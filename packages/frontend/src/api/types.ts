export interface Sender {
  name: string
  initials: string
}

export interface EmailMeta {
  subject: string
  from: string
  date: Date
  snippet: string
  full?: string
}

export interface Document {
  id: string
  filename: string
  sender: Sender
  tags: string[]
  date: Date
  size: number
  amount?: number | string | null
  email: EmailMeta
  label?: string
}

export interface DocumentDTO {
  id: string
  filename: string
  sender: Sender
  tags?: string[]
  date: string
  size: number
  amount?: number | string | null
  email: {
    subject: string
    from: string
    date: string
    snippet: string
    full?: string
  }
  label?: string
}

export interface TagInfo {
  name: string
  count: number
}

export interface SenderGroupDTO {
  id: number
  name: string
  collapsed: boolean
  hidden: boolean
  senders: string[]
}

export interface SenderGroupsStateDTO {
  groups: SenderGroupDTO[]
  hiddenSenders: string[]
}

export interface SyncStatus {
  scanning: boolean
  paused?: boolean
  cancelled?: boolean
  configured: boolean
  connected: boolean
  error?: string | null
  messageCount: number
  lastScan?: string | Date | null
  scanned?: number
  scanTotal?: number
  found?: number
  skipped?: number
  errors?: number
}

export interface SyncDefaults {
  labels: string
  sinceDays: number
  maxMessages: number
}

export interface MailboxInfo {
  path: string
  specialUse: string | null
  selectable: boolean
}

export interface SyncConfig {
  configured: boolean
  defaults: SyncDefaults
  lastScan: string | null
  lastRunFound: number
  documentCount: number
  status: SyncStatus
  mailboxes: MailboxInfo[]
}

export interface SyncOptions {
  labels?: string
  sinceDays?: number
  maxMessages?: number
  fullRescan?: boolean
}

export type SyncLogLevel = 'info' | 'ok' | 'warn' | 'error'

export interface SyncLogEntry {
  id: number
  level: SyncLogLevel
  time: string
  text: string
}

export interface SyncEventProgress {
  type: 'progress'
  scanned: number
  total: number
  label?: string
  found?: number
  skipped?: number
  errors?: number
}

export type SyncHistoryEvent =
  | {
      type: 'start'
      labels: string[]
      sinceDays: number
      maxMessages: number
      fullRescan: boolean
      sinceFallback: string
    }
  | {
      type: 'label_start'
      label: string
      labelIndex: number
      labelTotal: number
      since: string
      incremental: boolean
    }
  | {
      type: 'label_search'
      label: string
      matched: number
      scanning: number
      truncated: boolean
      since: string
      scanned: number
      total: number
      found: number
      skipped: number
      errors: number
    }
  | SyncEventProgress
  | {
      type: 'found'
      label: string
      uid: number
      from: string
      subject: string
      attachments: string[]
      found: number
      scanned: number
      total: number
      skipped: number
      errors: number
    }
  | {
      type: 'message_error'
      label: string
      uid: number
      error: string
      errors: number
    }
  | {
      type: 'label_done'
      label: string
      found: number
      skipped: number
      errors: number
    }
  | {
      type: 'label_error'
      label: string
      error: string
      errors: number
    }
  | { type: 'complete'; status: SyncStatus }
  | { type: 'cancelled'; status: SyncStatus }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'error'; error: string }

export type SyncEvent =
  | SyncHistoryEvent
  | {
      type: 'snapshot'
      status: SyncStatus
      lastProgress: SyncEventProgress | null
      history: SyncHistoryEvent[]
    }
