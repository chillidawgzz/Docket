import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
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

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 13.5v-3l1.8-1.4-1.5-2.6-2.2.5a6.8 6.8 0 00-1.5-.9L15.5 3h-3l-.5 2.1a6.8 6.8 0 00-1.5.9l-2.2-.5-1.5 2.6L8.6 10.5v3l-1.8 1.4 1.5 2.6 2.2-.5c.5.4 1 .7 1.5.9L12.5 21h3l.5-2.1c.5-.2 1-.5 1.5-.9l2.2.5 1.5-2.6-1.8-1.4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type ColKey = 'name' | 'sender' | 'category' | 'date' | 'size'
type RowLimit = 10 | 50 | 100 | 200 | 'all'

const COL_TO_SORT: Record<ColKey, SortKey> = {
  name: 'filename',
  sender: 'sender',
  category: 'category',
  date: 'date',
  size: 'size',
}

const COL_LABELS: Record<ColKey, string> = {
  name: 'Name',
  sender: 'Sender',
  category: 'Category',
  date: 'Date',
  size: 'Size',
}

const TOGGLEABLE_COLS: ColKey[] = ['sender', 'category', 'date', 'size']
const ROW_LIMITS: RowLimit[] = [10, 50, 100, 200, 'all']

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

const DEFAULT_VISIBLE: Record<ColKey, boolean> = {
  name: true,
  sender: true,
  category: true,
  date: true,
  size: true,
}

const SETTINGS_KEY = 'docket.tableSettings'

type TableSettings = {
  visible: Record<ColKey, boolean>
  rowLimit: RowLimit
}

function loadSettings(): TableSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { visible: { ...DEFAULT_VISIBLE }, rowLimit: 'all' }
    const parsed = JSON.parse(raw) as Partial<TableSettings>
    return {
      visible: { ...DEFAULT_VISIBLE, ...parsed.visible, name: true },
      rowLimit:
        parsed.rowLimit === 'all' ||
        parsed.rowLimit === 10 ||
        parsed.rowLimit === 50 ||
        parsed.rowLimit === 100 ||
        parsed.rowLimit === 200
          ? parsed.rowLimit
          : 'all',
    }
  } catch {
    return { visible: { ...DEFAULT_VISIBLE }, rowLimit: 'all' }
  }
}

interface DocumentTableProps {
  list: Document[]
  loading: boolean
  error: boolean
  checked: Set<string>
  previewId: string | null
  onToggleCheck: (id: string) => void
  onRowActivate: (id: string) => void
  onSelectAll: (ids: Document[]) => void
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
  const initial = useMemo(() => loadSettings(), [])
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  const [visible, setVisible] = useState(initial.visible)
  const [rowLimit, setRowLimit] = useState<RowLimit>(initial.rowLimit)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    col: ColKey
    startX: number
    startW: number
  } | null>(null)

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ visible, rowLimit } satisfies TableSettings),
    )
  }, [visible, rowLimit])

  useEffect(() => {
    if (!settingsOpen) return
    const onDown = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [settingsOpen])

  const sorted = useMemo(
    () => sortDocs(list, sortKey, sortDir),
    [list, sortKey, sortDir],
  )

  const displayed = useMemo(() => {
    if (rowLimit === 'all') return sorted
    return sorted.slice(0, rowLimit)
  }, [sorted, rowLimit])

  const allChecked =
    displayed.length > 0 && displayed.every((d) => checked.has(d.id))
  const someChecked =
    displayed.some((d) => checked.has(d.id)) && !allChecked
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked
    }
  }, [someChecked])

  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 900px)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const effectiveVisible = useMemo(() => {
    if (!isMobile) return visible
    return { ...visible, sender: false, size: false }
  }, [visible, isMobile])

  const visibleCols = (Object.keys(COL_LABELS) as ColKey[]).filter(
    (c) => effectiveVisible[c],
  )

  const toggleSort = useCallback((col: ColKey) => {
    const key = COL_TO_SORT[col]
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
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

  const tableCols = [
    '36px',
    ...visibleCols.map((c) =>
      c === 'name' ? `minmax(120px, ${widths.name}px)` : `${widths[c]}px`,
    ),
  ].join(' ')

  const gridStyle = {
    ['--table-cols' as string]: tableCols,
  }

  const groupByMonth = sortKey === 'date'
  let currentMonth: string | null = null
  const rows: ReactNode[] = []

  if (!loading && !error) {
    for (const d of displayed) {
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
          {effectiveVisible.name && (
            <div className="cell-name" data-col="name">
              <span
                className="file-icon"
                style={{ ['--cat' as string]: meta.color }}
              >
                <FileIcon />
              </span>
              <span className="cell-filename">{d.filename}</span>
            </div>
          )}
          {effectiveVisible.sender && (
            <div className="cell-sender" data-col="sender">
              {d.sender.name}
            </div>
          )}
          {effectiveVisible.category && (
            <div
              className="cat-tag"
              data-col="category"
              style={{ ['--cat' as string]: meta.color }}
            >
              <span className="facet-dot" />
              {meta.label}
            </div>
          )}
          {effectiveVisible.date && (
            <div className="cell-date" data-col="date">
              {formatShortDate(d.date)}
            </div>
          )}
          {effectiveVisible.size && (
            <div className="cell-size" data-col="size">
              {formatSize(d.size)}
            </div>
          )}
        </div>,
      )
    }
  }

  const header = (col: ColKey, alignRight?: boolean) => {
    if (!effectiveVisible[col]) return null
    const active = sortKey === COL_TO_SORT[col]
    return (
      <div
        key={col}
        data-col={col}
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
          <span>{COL_LABELS[col]}</span>
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
          aria-label={`Resize ${COL_LABELS[col]} column`}
        />
      </div>
    )
  }

  const showingLimited =
    !loading &&
    !error &&
    rowLimit !== 'all' &&
    sorted.length > displayed.length

  return (
    <main className="table-pane" style={gridStyle}>
      <div className="table-toolbar">
        <div className="result-count">
          {loading ? (
            'loading…'
          ) : error ? (
            'error'
          ) : showingLimited ? (
            <>
              showing <b>{displayed.length}</b> of <b>{sorted.length}</b>
            </>
          ) : (
            <>
              <b>{sorted.length}</b> document{sorted.length === 1 ? '' : 's'}
            </>
          )}
        </div>
        <div className="table-toolbar-right">
          {!loading && !error && displayed.length > 0 && (
            <button
              type="button"
              className="select-all-link"
              onClick={() => onSelectAll(displayed)}
            >
              {allChecked
                ? 'Deselect all'
                : `Select all ${displayed.length} in view`}
            </button>
          )}
          <div className="table-settings" ref={settingsRef}>
            <button
              type="button"
              className={
                'table-settings-btn' + (settingsOpen ? ' active' : '')
              }
              aria-label="Table settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <GearIcon />
            </button>
            {settingsOpen && (
              <div className="table-settings-menu" role="menu">
                <div className="table-settings-section">
                  <div className="table-settings-label">Columns</div>
                  <label className="table-settings-check table-settings-check--locked">
                    <input type="checkbox" checked disabled readOnly />
                    Name
                  </label>
                  {TOGGLEABLE_COLS.map((col) => (
                    <label key={col} className="table-settings-check">
                      <input
                        type="checkbox"
                        checked={visible[col]}
                        onChange={() =>
                          setVisible((v) => ({ ...v, [col]: !v[col] }))
                        }
                      />
                      {COL_LABELS[col]}
                    </label>
                  ))}
                </div>
                <div className="table-settings-section">
                  <div className="table-settings-label">Rows</div>
                  <div className="table-settings-rows">
                    {ROW_LIMITS.map((limit) => (
                      <button
                        key={String(limit)}
                        type="button"
                        role="menuitemradio"
                        aria-checked={rowLimit === limit}
                        className={
                          'table-settings-chip' +
                          (rowLimit === limit ? ' active' : '')
                        }
                        onClick={() => setRowLimit(limit)}
                      >
                        {limit === 'all' ? 'All' : limit}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="table-scroll">
        <div className="table-head-row" role="row">
          <div className="cell-check">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allChecked}
              disabled={loading || error || displayed.length === 0}
              aria-label={
                allChecked
                  ? 'Deselect all documents in view'
                  : 'Select all documents in view'
              }
              onChange={() => onSelectAll(displayed)}
            />
          </div>
          {header('name')}
          {header('sender')}
          {header('category')}
          {header('date')}
          {header('size', true)}
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
          {!loading && !error && displayed.length > 0 && rows}
        </div>
      </div>
      {children}
    </main>
  )
}
