import type { CategoryKey, Document } from '../api/types'
import { CATEGORIES } from '../lib/categories'
import {
  allYears,
  byCategory,
  bySenderName,
  type FilterState,
} from '../lib/filters'

interface SidebarProps {
  docs: Document[]
  filters: FilterState
  anyFilter: boolean
  onToggleSender: (name: string) => void
  onToggleCategory: (key: CategoryKey) => void
  onToggleYear: (year: number) => void
  onClearFilters: () => void
}

export function Sidebar({
  docs,
  filters,
  anyFilter,
  onToggleSender,
  onToggleCategory,
  onToggleYear,
  onClearFilters,
}: SidebarProps) {
  const senders = bySenderName(docs)
  const cats = byCategory(docs)
  const years = allYears(docs)

  return (
    <aside className="sidebar" aria-label="Filters">
      <div className="sidebar-section">
        <div className="sidebar-head">Senders</div>
        <div className="facet-list">
          {senders.map((s) => (
            <button
              key={s.name}
              type="button"
              className={
                'facet-row' + (filters.senderFilter === s.name ? ' active' : '')
              }
              onClick={() => onToggleSender(s.name)}
            >
              <span className="facet-avatar">{s.initials}</span>
              <span className="facet-label">{s.name}</span>
              <span className="facet-count">{s.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-head">Category</div>
        <div className="facet-list">
          {cats.map((c) => {
            const meta = CATEGORIES[c.key]
            return (
              <button
                key={c.key}
                type="button"
                className={
                  'facet-row' +
                  (filters.categoryFilter === c.key ? ' active' : '')
                }
                style={{ ['--cat' as string]: meta.color }}
                onClick={() => onToggleCategory(c.key)}
              >
                <span className="facet-dot" />
                <span className="facet-label">{meta.label}</span>
                <span className="facet-count">{c.count}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-head">Year</div>
        <div className="year-chips">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={
                'year-chip' + (filters.yearFilter === y ? ' active' : '')
              }
              onClick={() => onToggleYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      {anyFilter && (
        <button
          type="button"
          className="clear-filters"
          onClick={onClearFilters}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Clear filters
        </button>
      )}
    </aside>
  )
}
