import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchStatus,
  fetchSyncConfig,
  startSyncJob,
  pauseSyncJob,
  resumeSyncJob,
  cancelSyncJob,
  watchSyncEvents,
} from '../api/client'
import type {
  SyncConfig,
  SyncEvent,
  SyncHistoryEvent,
  SyncLogEntry,
  SyncOptions,
  SyncStatus,
} from '../api/types'

export type SyncUiState = {
  text: string
  showDot: boolean
  dotDanger: boolean
  dotMuted: boolean
  syncing: boolean
  paused: boolean
}

export type SyncProgress = {
  scanned: number
  total: number
  found: number
  skipped: number
  errors: number
  label: string
  labelIndex: number
  labelTotal: number
  phase: string
}

const idle: SyncUiState = {
  text: '',
  showDot: false,
  dotDanger: false,
  dotMuted: false,
  syncing: false,
  paused: false,
}

const emptyProgress: SyncProgress = {
  scanned: 0,
  total: 0,
  found: 0,
  skipped: 0,
  errors: 0,
  label: '',
  labelIndex: 0,
  labelTotal: 0,
  phase: '',
}

function statusText(s: SyncStatus): {
  text: string
  muted: boolean
  danger: boolean
} {
  if (s.scanning) {
    if (s.paused) return { text: 'paused', muted: false, danger: false }
    if (s.scanTotal)
      return {
        text: `${s.scanned ?? 0}/${s.scanTotal}`,
        muted: false,
        danger: false,
      }
    return { text: 'syncing…', muted: false, danger: false }
  }
  if (!s.configured)
    return { text: 'not configured', muted: true, danger: false }
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

function stamp() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function useSyncStatus(onComplete: () => void) {
  const [ui, setUi] = useState<SyncUiState>(idle)
  const [config, setConfig] = useState<SyncConfig | null>(null)
  const [progress, setProgress] = useState<SyncProgress>(emptyProgress)
  const [log, setLog] = useState<SyncLogEntry[]>([])
  const logId = useRef(0)
  const progressUiAt = useRef(0)
  const watchAbort = useRef<AbortController | null>(null)
  const watching = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const pushLog = useCallback(
    (level: SyncLogEntry['level'], text: string) => {
      logId.current += 1
      const entry: SyncLogEntry = {
        id: logId.current,
        level,
        time: stamp(),
        text,
      }
      setLog((prev) => [entry, ...prev].slice(0, 200))
    },
    [],
  )

  const refreshConfig = useCallback(async () => {
    try {
      const c = await fetchSyncConfig()
      setConfig(c)
      return c
    } catch {
      return null
    }
  }, [])

  const applyHistoryEvent = useCallback(
    (msg: SyncHistoryEvent, opts?: { silentProgress?: boolean }) => {
      const applyProgress = (patch: Partial<SyncProgress>) => {
        setProgress((p) => ({ ...p, ...patch }))
      }

      switch (msg.type) {
        case 'start':
          applyProgress({
            ...emptyProgress,
            labelTotal: msg.labels.length,
            phase: 'Connecting…',
          })
          pushLog(
            'info',
            `Scan started · labels ${msg.labels.join(', ')} · ${msg.sinceDays}d · max ${msg.maxMessages}${msg.fullRescan ? ' · full rescan' : ''}`,
          )
          break
        case 'label_start':
          applyProgress({
            label: msg.label,
            labelIndex: msg.labelIndex,
            labelTotal: msg.labelTotal,
            phase: msg.incremental
              ? `Incremental scan of ${msg.label}`
              : `Full window scan of ${msg.label}`,
          })
          pushLog(
            'info',
            `${msg.label} (${msg.labelIndex}/${msg.labelTotal}) · since ${new Date(msg.since).toLocaleDateString()}${msg.incremental ? ' · incremental' : ''}`,
          )
          break
        case 'label_search':
          applyProgress({
            label: msg.label,
            scanned: msg.scanned,
            total: msg.total,
            found: msg.found,
            skipped: msg.skipped,
            errors: msg.errors,
            phase: `Scanning ${msg.scanning} messages in ${msg.label}`,
          })
          pushLog(
            msg.truncated ? 'warn' : 'info',
            `${msg.label}: ${msg.matched} matched` +
              (msg.truncated
                ? `, capped to ${msg.scanning}`
                : `, scanning ${msg.scanning}`),
          )
          break
        case 'progress': {
          setProgress((p) => ({
            ...p,
            scanned: msg.scanned,
            total: msg.total,
            found: msg.found ?? p.found,
            skipped: msg.skipped ?? p.skipped,
            errors: msg.errors ?? p.errors,
            label: msg.label || p.label,
            phase: msg.label ? `Reading ${msg.label}` : p.phase,
          }))
          if (!opts?.silentProgress) {
            const now = Date.now()
            if (now - progressUiAt.current > 120 || msg.scanned === msg.total) {
              progressUiAt.current = now
              setUi({
                text: `${msg.scanned}/${msg.total}`,
                showDot: true,
                dotDanger: false,
                dotMuted: false,
                syncing: true,
                paused: false,
              })
            }
          }
          break
        }
        case 'found':
          setProgress((p) => ({
            ...p,
            found: msg.found,
            scanned: msg.scanned,
            total: msg.total,
            skipped: msg.skipped,
            errors: msg.errors,
          }))
          pushLog(
            'ok',
            `${msg.attachments.join(', ')} ← ${msg.from} · ${msg.subject}`,
          )
          break
        case 'message_error':
          setProgress((p) => ({ ...p, errors: msg.errors }))
          pushLog('error', `${msg.label} uid ${msg.uid}: ${msg.error}`)
          break
        case 'label_done':
          pushLog(
            'info',
            `Finished ${msg.label} · ${msg.found} found · ${msg.skipped} skipped`,
          )
          break
        case 'label_error':
          setProgress((p) => ({ ...p, errors: msg.errors }))
          pushLog('error', `Label ${msg.label}: ${msg.error}`)
          break
        case 'complete': {
          const st = msg.status
          setProgress((p) => ({
            ...p,
            found: st.found ?? st.messageCount ?? p.found,
            skipped: st.skipped ?? p.skipped,
            errors: st.errors ?? p.errors,
            scanned: st.scanned ?? p.scanned,
            total: st.scanTotal ?? p.total,
            phase: 'Complete',
          }))
          setUi({
            text: (st.messageCount ?? 0) + ' documents synced',
            showDot: true,
            dotDanger: false,
            dotMuted: false,
            syncing: false,
            paused: false,
          })
          pushLog(
            'ok',
            `Sync complete · ${st.messageCount ?? 0} attachments indexed` +
              (st.skipped != null ? ` · ${st.skipped} skipped` : ''),
          )
          break
        }
        case 'cancelled': {
          const st = msg.status
          setProgress((p) => ({
            ...p,
            found: st.found ?? p.found,
            skipped: st.skipped ?? p.skipped,
            errors: st.errors ?? p.errors,
            scanned: st.scanned ?? p.scanned,
            total: st.scanTotal ?? p.total,
            phase: 'Cancelled',
          }))
          setUi({
            text: 'sync cancelled',
            showDot: true,
            dotDanger: false,
            dotMuted: false,
            syncing: false,
            paused: false,
          })
          pushLog(
            'warn',
            `Sync cancelled · kept ${st.found ?? st.messageCount ?? 0} attachments found so far`,
          )
          break
        }
        case 'paused':
          setUi((prev) => ({
            ...prev,
            text: 'paused',
            syncing: true,
            paused: true,
            showDot: true,
          }))
          setProgress((p) => ({ ...p, phase: 'Paused' }))
          pushLog('warn', 'Sync paused')
          break
        case 'resumed':
          setUi((prev) => ({
            ...prev,
            text: 'syncing…',
            syncing: true,
            paused: false,
            showDot: true,
          }))
          setProgress((p) => ({
            ...p,
            phase: p.label ? `Reading ${p.label}` : 'Resumed',
          }))
          pushLog('info', 'Sync resumed')
          break
        case 'error':
          setUi({
            text: 'error: ' + String(msg.error),
            showDot: true,
            dotDanger: true,
            dotMuted: false,
            syncing: false,
            paused: false,
          })
          pushLog('error', String(msg.error))
          break
      }
    },
    [pushLog],
  )

  const handleEvent = useCallback(
    (msg: SyncEvent) => {
      if (msg.type === 'snapshot') {
        setLog([])
        logId.current = 0
        setProgress(emptyProgress)
        if (msg.status.scanning) {
          setUi({
            text: msg.status.paused
              ? 'paused'
              : msg.status.scanTotal
                ? `${msg.status.scanned ?? 0}/${msg.status.scanTotal}`
                : 'syncing…',
            showDot: true,
            dotDanger: false,
            dotMuted: false,
            syncing: true,
            paused: Boolean(msg.status.paused),
          })
          setProgress((p) => ({
            ...p,
            scanned: msg.status.scanned ?? 0,
            total: msg.status.scanTotal ?? 0,
            found: msg.status.found ?? 0,
            skipped: msg.status.skipped ?? 0,
            errors: msg.status.errors ?? 0,
            phase: msg.status.paused
              ? 'Paused'
              : 'Reconnected — sync in progress',
          }))
          pushLog('info', 'Reconnected to in-progress sync')
        }
        for (const ev of msg.history) {
          applyHistoryEvent(ev, { silentProgress: true })
        }
        if (msg.lastProgress) {
          applyHistoryEvent(msg.lastProgress)
        }
        return
      }
      applyHistoryEvent(msg)
    },
    [applyHistoryEvent, pushLog],
  )

  const attachWatcher = useCallback(async () => {
    if (watching.current) return
    watching.current = true
    watchAbort.current?.abort()
    const ac = new AbortController()
    watchAbort.current = ac
    setUi((prev) => ({
      ...prev,
      syncing: true,
      showDot: true,
      text: prev.text || 'syncing…',
    }))
    try {
      await watchSyncEvents(handleEvent, ac.signal)
      onCompleteRef.current()
      await refreshConfig()
      setUi((prev) => ({
        ...prev,
        syncing: false,
        paused: false,
        showDot: false,
        text:
          prev.dotDanger
            ? prev.text
            : prev.text.includes('cancelled')
              ? prev.text
              : prev.text.includes('synced')
                ? prev.text
                : 'sync complete',
      }))
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setUi({
        text: 'sync stream lost',
        showDot: true,
        dotDanger: true,
        dotMuted: false,
        syncing: false,
        paused: false,
      })
    } finally {
      watching.current = false
    }
  }, [handleEvent, refreshConfig])

  const refresh = useCallback(async () => {
    try {
      const s = await fetchStatus()
      const t = statusText(s)
      setUi((prev) => {
        if (prev.syncing) return prev
        return {
          ...prev,
          text: t.text,
          dotDanger: t.danger,
          dotMuted: t.muted,
          paused: false,
        }
      })
      if (s.scanning && !watching.current) {
        void attachWatcher()
      }
    } catch {
      /* ignore poll errors */
    }
  }, [attachWatcher])

  useEffect(() => {
    void refresh()
    void refreshConfig()
    const id = setInterval(() => void refresh(), 5000)
    return () => {
      clearInterval(id)
      watchAbort.current?.abort()
    }
  }, [refresh, refreshConfig])

  const sync = useCallback(
    async (options: SyncOptions = {}) => {
      setLog([])
      setProgress(emptyProgress)
      setUi({
        text: 'syncing…',
        showDot: true,
        dotDanger: false,
        dotMuted: false,
        syncing: true,
        paused: false,
      })
      try {
        const result = await startSyncJob(options)
        if (result.error && !result.alreadyRunning) {
          setUi({
            text: 'error: ' + result.error,
            showDot: true,
            dotDanger: true,
            dotMuted: false,
            syncing: false,
            paused: false,
          })
          pushLog('error', result.error)
          return
        }
        if (result.alreadyRunning) {
          pushLog('info', 'Joining sync already in progress')
        }
        await attachWatcher()
      } catch {
        setUi({
          text: 'sync failed',
          showDot: true,
          dotDanger: true,
          dotMuted: false,
          syncing: false,
          paused: false,
        })
        pushLog('error', 'Sync failed to start')
      }
    },
    [attachWatcher, pushLog],
  )

  const pause = useCallback(async () => {
    try {
      await pauseSyncJob()
    } catch {
      pushLog('error', 'Could not pause sync')
    }
  }, [pushLog])

  const resume = useCallback(async () => {
    try {
      await resumeSyncJob()
    } catch {
      pushLog('error', 'Could not resume sync')
    }
  }, [pushLog])

  const cancel = useCallback(async () => {
    try {
      pushLog('warn', 'Cancel requested…')
      await cancelSyncJob()
    } catch {
      pushLog('error', 'Could not cancel sync')
    }
  }, [pushLog])

  return {
    ui,
    sync,
    pause,
    resume,
    cancel,
    config,
    progress,
    log,
    refreshConfig,
  }
}
