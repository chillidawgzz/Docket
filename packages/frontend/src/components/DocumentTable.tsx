import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Document } from '../api/types'
import { CATEGORIES } from '../lib/categories'
import { formatShortDate, formatSize, monthKey, monthLabel } from '../lib/format'
import { sortDocs, type SortDir, type SortKey } from '../lib/sort'

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

type ColKey = 'name' | 'sender' | 'category' | 'date' | 'size'

const COL_TO_SORT: Record<ColKey, SortKey> = {
  name: 'filename',
  sender: 'sender',
  category: 'category',
  date: 'date',
  size: 'size',
}

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  name: 280,
  sender: 150,
  category: 120,
  date: 96,
  size: 76,
}

const MIN_WIDTHS: Record<ColKey, number> = {
  name: 120,
  sender: 80,
  category: 80,
  date: 64,
  size: 56,
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
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  const dragRef = useRef<{
    col: ColKey
    startX: number
    startW: number
  } | null>(null)

  const sorted = useMemo(
    () => sortDocs(list, sortKey, sortDir),
    [list, sortKey, sortDir],
  )

  const allChecked =
    sorted.length > 0 && sorted.every((d) => checked.has(d.id))

  const toggleSort = useCallback((col: ColKey) => {
    const key = COL_TO_SORT[col]
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      // Date defaults to newest-first; others to ascending
      setSortDir(key === 'date' ? 'desc' : 'asc')
      return key
    })
  }, [])

  const onResizeStart = useCallback((col: ColKey, clientX: number) => {
    dragRef.current = { col, startX: clientX, startW: widths[col] }

    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const delta = ev.clientX - drag.startX
      const next = Math.max(MIN_WIDTHS[drag.col], drag.startW + delta)
      setWidths((w) => ({ ...w, [drag.col]: next }))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove('col-resizing')
    }
    document.body.classList.add('col-resizing')
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [widths])

  const gridStyle = {
    ['--col-name' as string]: `${widths.name}px`,
    ['--col-sender' as string]: `${widths.sender}px`,
    ['--col-category' as string]: `${widths.category}px`,
    ['--col-date' as string]: `${widths.date}px`,
    ['--col-size' as string]: `${widths.size}px`,
  }

  const groupByMonth = sortKey === 'date'
  let currentMonth: string | null = null
  const rows: ReactNode[] = []

  if (!loading && !error) {
    for (const d of sorted) {
      if (groupByMonth) {
        const mk = monthKey(d.date)
        if (mk !== currentMonth) {
          currentMonth = mk
          rows.push(
            <div className="month-header" key={'m-' + mk}>
              {monthLabel(d.date)}
            </div>,
          )
        }
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

  const header = (
    col: ColKey,
    label: string,
    alignRight?: boolean,
  ) => {
    const active = sortKey === COL_TO_SORT[col]
    return (
      <div
        className={
          'th-cell' +
          (alignRight ? ' th-cell--right' : '') +
          (active ? ' th-cell--active' : '')
        }
      >
        <button
          type="button"
          className="th-sort"
          onClick={() => toggleSort(col)}
          aria-sort={
            active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
          }
        >
          <span>{label}</span>
          <span className="th-indicator" aria-hidden="true">
            {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
        <span
          className="col-resize"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onResizeStart(col, e.clientX)
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${label} column`}
        />
      </div>
    )
  }

  return (
    <main className="table-pane" style={gridStyle}>
      <div className="table-toolbar">
        <div className="result-count">
          {loading ? (
            'loading…'
          ) : error ? (
            'error'
          ) : (
            <>
              <b>{sorted.length}</b> document{sorted.length === 1 ? '' : 's'}
            </>
          )}
        </div>
        {!loading && !error && sorted.length > 0 && (
          <button
            type="button"
            className="select-all-link"
            onClick={onSelectAll}
          >
            {allChecked
              ? 'Deselect all'
              : `Select all ${sorted.length} in view`}
          </button>
        )}
      </div>
      <div className="table-scroll">
        <div className="table-head-row" role="row">
          <div />
          {header('name', 'Name')}
          {header('sender', 'Sender')}
          {header('category', 'Category')}
          {header('date', 'Date')}
          {header('size', 'Size', true)}
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
          {!loading && !error && sorted.length === 0 && (
            <div className="empty-state">
              no documents match these filters
            </div>
          )}
          {!loading && !error && sorted.length > 0 && rows}
        </div>
      </div>
      {children}
    </main>
  )
}
