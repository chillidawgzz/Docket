import type { SyncUiState } from '../hooks/useSyncStatus'
import { Spinner } from './Spinner'

interface TopbarProps {
  search: string
  onSearchChange: (value: string) => void
  onToggleSidebar: () => void
  syncUi: SyncUiState
  onOpenSync: () => void
  onGoHome: () => void
  view: 'documents' | 'sync' | 'groups' | 'preview'
  searchDisabled?: boolean
}

export function Topbar({
  search,
  onSearchChange,
  onToggleSidebar,
  syncUi,
  onOpenSync,
  onGoHome,
  view,
  searchDisabled,
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
      <button
        type="button"
        className="wordmark"
        onClick={onGoHome}
        aria-label="Back to documents"
      >
        <span className="prompt">~/</span>docket
        <span className="cursor">_</span>
      </button>
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
          placeholder="grep filename, sender, subject, message…"
          aria-label="Search documents"
          value={search}
          disabled={searchDisabled}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="topbar-right">
        <button
          type="button"
          className={
            'topbar-sync-btn btn-with-spinner' + (view === 'sync' ? ' active' : '')
          }
          onClick={onOpenSync}
        >
          {syncUi.syncing ? (
            <>
              <Spinner size="sm" />
              Syncing…
            </>
          ) : (
            'Sync'
          )}
        </button>
        <span>
          <span
            className="sync-dot"
            style={{
              display: syncUi.showDot || syncUi.syncing ? 'inline-block' : 'none',
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
