export type CategoryKey =
  | 'tax'
  | 'utilities'
  | 'banking'
  | 'insurance'
  | 'medical'
  | 'housing'
  | 'receipts'
  | 'uncategorized'

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
  category: CategoryKey
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
  category: CategoryKey
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

export interface SyncStatus {
  scanning: boolean
  configured: boolean
  connected: boolean
  error?: string | null
  messageCount: number
}

export type SyncEvent =
  | { type: 'progress'; scanned: number; total: number }
  | { type: 'complete'; status: SyncStatus }
  | { type: 'error'; error: string }
  | { type: string; [key: string]: unknown }
