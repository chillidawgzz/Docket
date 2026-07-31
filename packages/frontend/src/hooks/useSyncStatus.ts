import { useCallback, useEffect, useState } from 'react'
import { fetchStatus, startSync } from '../api/client'
import type { SyncStatus } from '../api/types'

export type SyncUiState = {
  text: string
  showDot: boolean
  dotDanger: boolean
  dotMuted: boolean
  syncing: boolean
}

const idle: SyncUiState = {
  text: '',
  showDot: false,
  dotDanger: false,
  dotMuted: false,
  syncing: false,
}

function statusText(s: SyncStatus): { text: string; muted: boolean; danger: boolean } {
  if (s.scanning) return { text: 'syncing…', muted: false, danger: false }
  if (!s.configured) return { text: 'not configured', muted: true, danger: false }
  if (s.error) return { text: 'error: ' + s.error, muted: false, danger: true }
  if (s.connected) {
    return {
      text: s.messageCount + ' documents synced',
      muted: false,
      danger: false,
    }
  }
  return { text: 'not synced', muted: true, danger: false }
}

export function useSyncStatus(onComplete: () => void) {
  const [ui, setUi] = useState<SyncUiState>(idle)

  const refresh = useCallback(async () => {
    try {
      const s = await fetchStatus()
      const t = statusText(s)
      setUi((prev) => {
        if (prev.syncing) return prev
        return {
          ...prev,
          text: t.text,
          // Match vanilla: poll updates text/dot color but does not force-show the dot
          dotDanger: t.danger,
          dotMuted: t.muted,
        }
      })
    } catch {
      /* ignore poll errors */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 5000)
    return () => clearInterval(id)
  }, [refresh])

  const sync = useCallback(async () => {
    setUi({
      text: 'syncing…',
      showDot: true,
      dotDanger: false,
      dotMuted: false,
      syncing: true,
    })
    try {
      await startSync((msg) => {
        if (msg.type === 'progress') {
          setUi({
            text: `${msg.scanned}/${msg.total}`,
            showDot: true,
            dotDanger: false,
            dotMuted: false,
            syncing: true,
          })
        } else if (msg.type === 'complete') {
          const status = msg.status as SyncStatus
          setUi({
            text: status.messageCount + ' documents synced',
            showDot: true,
            dotDanger: false,
            dotMuted: false,
            syncing: true,
          })
        } else if (msg.type === 'error') {
          setUi({
            text: 'error: ' + String(msg.error),
            showDot: true,
            dotDanger: true,
            dotMuted: false,
            syncing: true,
          })
        }
      })
      onComplete()
      setUi((prev) => ({
        ...prev,
        showDot: false,
        syncing: false,
        text: prev.text === 'syncing…' ? 'sync complete' : prev.text,
      }))
    } catch {
      setUi({
        text: 'sync failed',
        showDot: true,
        dotDanger: true,
        dotMuted: false,
        syncing: false,
      })
    }
  }, [onComplete])

  return { ui, sync }
}
