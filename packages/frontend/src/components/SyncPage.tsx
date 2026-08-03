import { useEffect, useMemo, useState } from 'react'
import type { SyncConfig, SyncLogEntry, SyncOptions } from '../api/types'
import type { SyncProgress } from '../hooks/useSyncStatus'

interface SyncPageProps {
  config: SyncConfig | null
  syncing: boolean
  paused: boolean
  progress: SyncProgress
  log: SyncLogEntry[]
  onSync: (options: SyncOptions) => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onBack: () => void
  onRefreshConfig: () => void
}

export function SyncPage({
  config,
  syncing,
  paused,
  progress,
  log,
  onSync,
  onPause,
  onResume,
  onCancel,
  onBack,
  onRefreshConfig,
}: SyncPageProps) {
  const defaults = config?.defaults
  const [labels, setLabels] = useState(defaults?.labels ?? '*')
  const [sinceDays, setSinceDays] = useState(defaults?.sinceDays ?? 730)
  const [maxMessages, setMaxMessages] = useState(defaults?.maxMessages ?? 10000)
  const [fullRescan, setFullRescan] = useState(false)
  const [showAllLabels, setShowAllLabels] = useState(false)

  useEffect(() => {
    if (!defaults) return
    setLabels(defaults.labels)
    setSinceDays(defaults.sinceDays)
    setMaxMessages(defaults.maxMessages)
  }, [defaults])

  const pct = useMemo(() => {
    if (!progress.total) return 0
    return Math.min(100, Math.round((progress.scanned / progress.total) * 100))
  }, [progress.scanned, progress.total])

  const allMailboxHints = useMemo(() => {
    const boxes = config?.mailboxes || []
    const paths = boxes.map((b) => b.path)
    const preferred = ['*', 'INBOX', '[Gmail]/All Mail'].filter(
      (p) => p === '*' || paths.includes(p),
    )
    const rest = paths
      .filter((p) => !preferred.includes(p))
      .sort((a, b) => a.localeCompare(b))
    return [...preferred, ...rest]
  }, [config])

  const LABEL_PREVIEW = 12
  const mailboxHints = showAllLabels
    ? allMailboxHints
    : allMailboxHints.slice(0, LABEL_PREVIEW)
  const hiddenLabelCount = Math.max(0, allMailboxHints.length - LABEL_PREVIEW)

  return (
    <main className="sync-page" aria-label="Sync">
      <div className="sync-page-inner">
        <header className="sync-header">
          <button type="button" className="sync-back" onClick={onBack}>
            ← Documents
          </button>
          <div>
            <h1 className="sync-title">Sync</h1>
            <p className="sync-subtitle">
              Pull attachments from Gmail into the local archive. Tune the
              window below, then run.
            </p>
          </div>
        </header>

        <section className="sync-status-strip" aria-live="polite">
          <div className="sync-stat">
            <span className="sync-stat-label">Archive</span>
            <span className="sync-stat-value">
              {config?.documentCount ?? '—'} docs
            </span>
          </div>
          <div className="sync-stat">
            <span className="sync-stat-label">Last sync</span>
            <span className="sync-stat-value">
              {config?.lastScan
                ? new Date(config.lastScan).toLocaleString()
                : 'never'}
            </span>
          </div>
          <div className="sync-stat">
            <span className="sync-stat-label">Last run found</span>
            <span className="sync-stat-value">
              {config?.lastRunFound ?? 0}
            </span>
          </div>
          <div className="sync-stat">
            <span className="sync-stat-label">Account</span>
            <span
              className={
                'sync-stat-value' +
                (config?.configured ? '' : ' is-danger')
              }
            >
              {config?.configured ? 'configured' : 'not configured'}
            </span>
          </div>
        </section>

        <div className="sync-grid">
          <section className="sync-panel">
            <h2 className="sync-panel-title">Parameters</h2>
            <p className="sync-panel-help">
              Defaults come from <code>.env</code>. Changes apply to this run
              only.
            </p>

            <label className="sync-field">
              <span>Labels</span>
              <input
                type="text"
                value={labels}
                disabled={syncing}
                onChange={(e) => setLabels(e.target.value)}
                placeholder="* or INBOX or Label A,Label B"
                spellCheck={false}
              />
              <span className="sync-field-hint">
                <code>*</code> uses Gmail All Mail (every label). Or comma-separate
                specific mailboxes.
              </span>
            </label>

            {mailboxHints.length > 0 && (
              <div className="sync-chip-row" role="list">
                {mailboxHints.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className={
                      'sync-chip' + (labels === path ? ' active' : '')
                    }
                    disabled={syncing}
                    onClick={() => setLabels(path)}
                  >
                    {path}
                  </button>
                ))}
                {hiddenLabelCount > 0 && (
                  <button
                    type="button"
                    className="sync-chip sync-chip--more"
                    disabled={syncing}
                    onClick={() => setShowAllLabels((v) => !v)}
                  >
                    {showAllLabels
                      ? 'Show less'
                      : `Show more (${hiddenLabelCount})`}
                  </button>
                )}
              </div>
            )}

            <div className="sync-field-row">
              <label className="sync-field">
                <span>Since days</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={sinceDays}
                  disabled={syncing}
                  onChange={(e) => setSinceDays(Number(e.target.value) || 1)}
                />
                <span className="sync-field-hint">
                  How far back on first scan of a mailbox.
                </span>
              </label>
              <label className="sync-field">
                <span>Max messages</span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={maxMessages}
                  disabled={syncing}
                  onChange={(e) =>
                    setMaxMessages(Number(e.target.value) || 1)
                  }
                />
                <span className="sync-field-hint">
                  Cap per mailbox (newest first).
                </span>
              </label>
            </div>

            <label className="sync-check">
              <input
                type="checkbox"
                checked={fullRescan}
                disabled={syncing}
                onChange={(e) => setFullRescan(e.target.checked)}
              />
              <span>
                Full rescan — ignore last message date and re-walk the since
                window
              </span>
            </label>

            <div className="sync-actions">
              <button
                type="button"
                className="sync-run"
                disabled={syncing || !config?.configured}
                onClick={() =>
                  onSync({
                    labels: labels.trim() || '*',
                    sinceDays,
                    maxMessages,
                    fullRescan,
                  })
                }
              >
                {syncing ? (paused ? 'Paused' : 'Syncing…') : 'Start sync'}
              </button>
              {syncing && (
                <>
                  <button
                    type="button"
                    className="sync-secondary"
                    onClick={() => (paused ? onResume() : onPause())}
                  >
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    className="sync-secondary sync-stop"
                    onClick={() => onCancel()}
                  >
                    Stop
                  </button>
                </>
              )}
              <button
                type="button"
                className="sync-secondary"
                disabled={syncing}
                onClick={() => onRefreshConfig()}
              >
                Refresh status
              </button>
            </div>
          </section>

          <section className="sync-panel sync-panel--live">
            <h2 className="sync-panel-title">Live progress</h2>

            <div className="sync-progress-block">
              <div className="sync-progress-meta">
                <span>
                  {progress.phase ||
                    (syncing ? (paused ? 'Paused' : 'Starting…') : 'Idle')}
                </span>
                <span className="sync-progress-pct">
                  {progress.total
                    ? `${progress.scanned}/${progress.total} (${pct}%)`
                    : syncing
                      ? '…'
                      : '—'}
                </span>
              </div>
              <div
                className="sync-progress-bar"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={
                    'sync-progress-fill' + (syncing ? ' is-active' : '')
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress.label && (
                <div className="sync-progress-label">
                  {progress.labelIndex > 0
                    ? `Label ${progress.labelIndex}/${progress.labelTotal}: `
                    : ''}
                  {progress.label}
                </div>
              )}
            </div>

            <div className="sync-counters">
              <div className="sync-counter">
                <span className="sync-counter-value is-ok">
                  {progress.found}
                </span>
                <span className="sync-counter-label">found</span>
              </div>
              <div className="sync-counter">
                <span className="sync-counter-value">
                  {progress.skipped}
                </span>
                <span className="sync-counter-label">skipped</span>
              </div>
              <div className="sync-counter">
                <span
                  className={
                    'sync-counter-value' +
                    (progress.errors ? ' is-danger' : '')
                  }
                >
                  {progress.errors}
                </span>
                <span className="sync-counter-label">errors</span>
              </div>
            </div>

            <h3 className="sync-log-title">Activity</h3>
            <div className="sync-log" role="log" aria-live="polite">
              {log.length === 0 && (
                <div className="sync-log-empty">
                  Run a sync to see attachments found, skips, and errors.
                </div>
              )}
              {log.map((entry) => (
                <div
                  key={entry.id}
                  className={'sync-log-row level-' + entry.level}
                >
                  <span className="sync-log-time">{entry.time}</span>
                  <span className="sync-log-text">{entry.text}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
