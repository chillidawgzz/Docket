import { useState, type ReactNode } from 'react'
import type { Document } from '../api/types'
import { bySenderName, byTag, type FilterState } from '../lib/filters'
import { tagColor } from '../lib/tagColor'
import { TagPicker } from './TagPicker'

interface SidebarProps {
  docs: Document[]
  filters: FilterState
  anyFilter: boolean
  tagSuggestions: string[]
  onResizeStart: (clientX: number) => void
  onToggleSender: (name: string) => void
  onToggleTag: (tag: string) => void
  onSetTagFilters: (tags: string[]) => void
  onSetTagMode: (mode: 'and' | 'or') => void
  onSetDateFrom: (value: string | null) => void
  onSetDateTo: (value: string | null) => void
  onClearFilters: () => void
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'sidebar-section' + (open ? '' : ' collapsed')}>
      <button
        type="button"
        className="sidebar-head sidebar-head--toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="sidebar-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className="sidebar-section-body">{children}</div>}
    </div>
  )
}

export function Sidebar({
  docs,
  filters,
  anyFilter,
  tagSuggestions,
  onResizeStart,
  onToggleSender,
  onToggleTag,
  onSetTagFilters,
  onSetTagMode,
  onSetDateFrom,
  onSetDateTo,
  onClearFilters,
}: SidebarProps) {
  const senders = bySenderName(docs)
  const tags = byTag(docs)

  return (
    <div className="sidebar-shell">
      <aside className="sidebar" aria-label="Filters">
        <Section title="Senders">
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
            {senders.length === 0 && (
              <div className="sidebar-empty">no senders</div>
            )}
          </div>
        </Section>

      <Section title="Tags">
        <div className="tag-mode-toggle" role="group" aria-label="Tag match mode">
          <button
            type="button"
            className={
              'tag-mode-btn' + (filters.tagMode === 'or' ? ' active' : '')
            }
            onClick={() => onSetTagMode('or')}
          >
            Any
          </button>
          <button
            type="button"
            className={
              'tag-mode-btn' + (filters.tagMode === 'and' ? ' active' : '')
            }
            onClick={() => onSetTagMode('and')}
          >
            All
          </button>
        </div>
        <div className="sidebar-tag-picker">
          <TagPicker
            value={filters.tagFilters}
            suggestions={tagSuggestions}
            onChange={onSetTagFilters}
            placeholder="Filter by tag…"
          />
        </div>
        <div className="facet-list">
          {tags.map((t) => {
            const active = filters.tagFilters.some(
              (x) => x.toLowerCase() === t.name.toLowerCase(),
            )
            return (
              <button
                key={t.name}
                type="button"
                className={'facet-row' + (active ? ' active' : '')}
                style={{ ['--cat' as string]: tagColor(t.name) }}
                onClick={() => onToggleTag(t.name)}
              >
                <span className="facet-dot" />
                <span className="facet-label">{t.name}</span>
                <span className="facet-count">{t.count}</span>
              </button>
            )
          })}
          {tags.length === 0 && (
            <div className="sidebar-empty">no tags yet</div>
          )}
        </div>
      </Section>

      <Section title="Date">
        <div className="date-range">
          <label className="date-range-field">
            <span>From</span>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => onSetDateFrom(e.target.value || null)}
            />
          </label>
          <label className="date-range-field">
            <span>To</span>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => onSetDateTo(e.target.value || null)}
            />
          </label>
        </div>
      </Section>

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
      <div
        className="sidebar-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize filters panel"
        onMouseDown={(e) => {
          e.preventDefault()
          onResizeStart(e.clientX)
        }}
      />
    </div>
  )
}
