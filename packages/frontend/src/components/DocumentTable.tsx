import type { ReactNode } from 'react'
import type { Document } from '../api/types'
import { CATEGORIES } from '../lib/categories'
import { formatShortDate, formatSize, monthKey, monthLabel } from '../lib/format'

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface DocumentTableProps {
  list: Document[]
  loading: boolean
  error: boolean
  checked: Set<string>
  previewId: string | null
  onToggleCheck: (id: string) => void
  onRowActivate: (id: string) => void
  onSelectAll: () => void
  onRetry: () => void
  children?: ReactNode
}

export function DocumentTable({
  list,
  loading,
  error,
  checked,
  previewId,
  onToggleCheck,
  onRowActivate,
  onSelectAll,
  onRetry,
  children,
}: DocumentTableProps) {
  const allChecked =
    list.length > 0 && list.every((d) => checked.has(d.id))

  let currentMonth: string | null = null
  const rows: ReactNode[] = []

  if (!loading && !error) {
    for (const d of list) {
      const mk = monthKey(d.date)
      if (mk !== currentMonth) {
        currentMonth = mk
        rows.push(
          <div className="month-header" key={'m-' + mk}>
            {monthLabel(d.date)}
          </div>,
        )
      }
      const meta = CATEGORIES[d.category]
      const isChecked = checked.has(d.id)
      const selected = previewId === d.id
      rows.push(
        <div
          key={d.id}
          className={
            'doc-row unseen' +
            (isChecked ? ' checked' : '') +
            (selected ? ' selected' : '')
          }
          data-id={d.id}
          role="row"
          tabIndex={0}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-check]')) return
            onRowActivate(d.id)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            e.preventDefault()
            onRowActivate(d.id)
          }}
        >
          <div className="cell-check">
            <input
              type="checkbox"
              data-check={d.id}
              checked={isChecked}
              aria-label={`Select ${d.filename}`}
              onChange={() => onToggleCheck(d.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="cell-name">
            <span
              className="file-icon"
              style={{ ['--cat' as string]: meta.color }}
            >
              <FileIcon />
            </span>
            <span className="cell-filename">{d.filename}</span>
          </div>
          <div className="cell-sender">{d.sender.name}</div>
          <div
            className="cat-tag"
            style={{ ['--cat' as string]: meta.color }}
          >
            <span className="facet-dot" />
            {meta.label}
          </div>
          <div className="cell-date">{formatShortDate(d.date)}</div>
          <div className="cell-size">{formatSize(d.size)}</div>
        </div>,
      )
    }
  }

  return (
    <main className="table-pane">
      <div className="table-toolbar">
        <div className="result-count">
          {loading ? (
            'loading…'
          ) : error ? (
            'error'
          ) : (
            <>
              <b>{list.length}</b> document{list.length === 1 ? '' : 's'}
            </>
          )}
        </div>
        {!loading && !error && list.length > 0 && (
          <button
            type="button"
            className="select-all-link"
            onClick={onSelectAll}
          >
            {allChecked
              ? 'Deselect all'
              : `Select all ${list.length} in view`}
          </button>
        )}
      </div>
      <div className="table-scroll">
        <div className="table-head-row" role="row">
          <div />
          <div>Name</div>
          <div>Sender</div>
          <div>Category</div>
          <div>Date</div>
          <div style={{ textAlign: 'right' }}>Size</div>
        </div>
        <div>
          {loading && (
            <div className="empty-state">loading documents…</div>
          )}
          {error && (
            <div className="empty-state">
              couldn&apos;t load documents.{' '}
              <button
                type="button"
                id="retryLoad"
                style={{ cursor: 'pointer' }}
                onClick={onRetry}
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && list.length === 0 && (
            <div className="empty-state">
              no documents match these filters
            </div>
          )}
          {!loading && !error && list.length > 0 && rows}
        </div>
      </div>
      {children}
    </main>
  )
}
