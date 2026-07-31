import type { SyncUiState } from '../hooks/useSyncStatus'

interface TopbarProps {
  search: string
  onSearchChange: (value: string) => void
  onToggleSidebar: () => void
  syncUi: SyncUiState
  onSync: () => void
}

export function Topbar({
  search,
  onSearchChange,
  onToggleSidebar,
  syncUi,
  onSync,
}: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="sidebar-toggle"
        aria-label="Toggle filters"
        onClick={onToggleSidebar}
        type="button"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div className="wordmark">
        <span className="prompt">~/</span>docket
        <span className="cursor">_</span>
      </div>
      <div className="search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M21 21l-4.3-4.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="search"
          placeholder="grep filename, sender, subject…"
          aria-label="Search documents"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="topbar-right">
        <button
          type="button"
          disabled={syncUi.syncing}
          onClick={onSync}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-s)',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: syncUi.syncing ? 'default' : 'pointer',
          }}
        >
          {syncUi.syncing ? '…' : 'Sync'}
        </button>
        <span>
          <span
            className="sync-dot"
            style={{
              display: syncUi.showDot ? 'inline-block' : 'none',
              background: syncUi.dotDanger
                ? 'var(--danger)'
                : syncUi.dotMuted
                  ? 'var(--text-tertiary)'
                  : undefined,
            }}
          />
          <span>{syncUi.text}</span>
        </span>
      </div>
    </header>
  )
}
