import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Document } from '../api/types'
import {
  bySenderName,
  byTag,
  type FilterState,
  type SenderGroupInfo,
} from '../lib/filters'
import { tagColor } from '../lib/tagColor'
import { ManageGroupsModal } from './ManageGroupsModal'
import { TagPicker } from './TagPicker'

interface SidebarProps {
  docs: Document[]
  filters: FilterState
  anyFilter: boolean
  tagSuggestions: string[]
  groups: SenderGroupInfo[]
  hiddenSenders: string[]
  onResizeStart: (clientX: number) => void
  onToggleSender: (name: string) => void
  onToggleGroup: (groupId: number) => void
  onToggleTag: (tag: string) => void
  onSetTagFilters: (tags: string[]) => void
  onSetTagMode: (mode: 'and' | 'or') => void
  onSetDateFrom: (value: string | null) => void
  onSetDateTo: (value: string | null) => void
  onClearFilters: () => void
  onCreateGroup: (name: string) => Promise<void>
  onUpdateGroup: (
    id: number,
    patch: { name?: string; collapsed?: boolean; hidden?: boolean },
  ) => Promise<void>
  onDeleteGroup: (id: number) => Promise<void>
  onSetGroupMembers: (id: number, senders: string[]) => Promise<void>
  onMoveSender: (sender: string, groupId: number | null) => Promise<void>
  onHideSender: (sender: string, hidden: boolean) => Promise<void>
}

type MenuKey = string | null

function Section({
  title,
  defaultOpen = true,
  actions,
  children,
}: {
  title: string
  defaultOpen?: boolean
  actions?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'sidebar-section' + (open ? '' : ' collapsed')}>
      <div className="sidebar-head-row">
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
        {actions}
      </div>
      {open && <div className="sidebar-section-body">{children}</div>}
    </div>
  )
}

function FacetMenu({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="facet-menu" ref={ref} role="menu">
      {children}
    </div>
  )
}

export function Sidebar({
  docs,
  filters,
  anyFilter,
  tagSuggestions,
  groups,
  hiddenSenders,
  onResizeStart,
  onToggleSender,
  onToggleGroup,
  onToggleTag,
  onSetTagFilters,
  onSetTagMode,
  onSetDateFrom,
  onSetDateTo,
  onClearFilters,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onSetGroupMembers,
  onMoveSender,
  onHideSender,
}: SidebarProps) {
  const senders = bySenderName(docs)
  const tags = byTag(docs)
  const [menu, setMenu] = useState<MenuKey>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const hiddenSet = useMemo(() => new Set(hiddenSenders), [hiddenSenders])

  const senderMeta = useMemo(() => {
    const map = new Map(senders.map((s) => [s.name, s]))
    return map
  }, [senders])

  const groupedNames = useMemo(() => {
    const set = new Set<string>()
    for (const g of groups) {
      for (const s of g.senders) set.add(s)
    }
    return set
  }, [groups])

  const otherSenders = useMemo(
    () => senders.filter((s) => !groupedNames.has(s.name)),
    [senders, groupedNames],
  )

  const groupCount = (g: SenderGroupInfo) =>
    g.senders.reduce((sum, name) => sum + (senderMeta.get(name)?.count || 0), 0)

  const closeMenu = () => setMenu(null)

  const renderSenderRow = (
    name: string,
    initials: string,
    count: number,
    groupId: number | null,
  ) => {
    const menuKey = `sender:${name}`
    const isHidden = hiddenSet.has(name)
    const active = filters.senderFilter === name
    return (
      <div
        key={name}
        className={
          'facet-row-wrap' +
          (active ? ' active' : '') +
          (isHidden ? ' is-hidden' : '')
        }
      >
        <button
          type="button"
          className={'facet-row' + (active ? ' active' : '')}
          onClick={() => onToggleSender(name)}
        >
          <span className="facet-avatar">{initials}</span>
          <span className="facet-label">{name}</span>
          <span className="facet-count">{count}</span>
        </button>
        <div className="facet-menu-anchor">
          <button
            type="button"
            className="facet-menu-btn"
            aria-label={`Options for ${name}`}
            aria-expanded={menu === menuKey}
            onClick={(e) => {
              e.stopPropagation()
              setMenu((m) => (m === menuKey ? null : menuKey))
            }}
          >
            ⋯
          </button>
          <FacetMenu open={menu === menuKey} onClose={closeMenu}>
            <div className="facet-menu-label">Move to group</div>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="facet-menu-item"
                disabled={groupId === g.id}
                onClick={() => {
                  void onMoveSender(name, g.id)
                  closeMenu()
                }}
              >
                {g.name}
              </button>
            ))}
            {groups.length === 0 && (
              <div className="facet-menu-empty">No groups yet</div>
            )}
            {groupId != null && (
              <button
                type="button"
                className="facet-menu-item"
                onClick={() => {
                  void onMoveSender(name, null)
                  closeMenu()
                }}
              >
                Remove from group
              </button>
            )}
            <button
              type="button"
              className="facet-menu-item"
              onClick={() => {
                void onHideSender(name, !isHidden)
                closeMenu()
              }}
            >
              {isHidden ? 'Unhide' : 'Hide'}
            </button>
          </FacetMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-shell">
      <aside className="sidebar" aria-label="Filters">
        <Section
          title="Senders"
          actions={
            <button
              type="button"
              className="sidebar-manage-btn"
              onClick={() => setManageOpen(true)}
            >
              Manage
            </button>
          }
        >
          <div className="facet-list">
            {groups.map((g) => {
              const menuKey = `group:${g.id}`
              const active = filters.groupFilter === g.id
              const count = groupCount(g)
              return (
                <div key={g.id} className="sender-group-block">
                  <div
                    className={
                      'facet-row-wrap group-row' +
                      (active ? ' active' : '') +
                      (g.hidden ? ' is-hidden' : '')
                    }
                  >
                    <button
                      type="button"
                      className="facet-collapse-btn"
                      aria-label={g.collapsed ? 'Expand group' : 'Collapse group'}
                      aria-expanded={!g.collapsed}
                      onClick={() =>
                        void onUpdateGroup(g.id, { collapsed: !g.collapsed })
                      }
                    >
                      {g.collapsed ? '▸' : '▾'}
                    </button>
                    <button
                      type="button"
                      className={'facet-row facet-row--group' + (active ? ' active' : '')}
                      onClick={() => onToggleGroup(g.id)}
                    >
                      <span className="facet-label">{g.name}</span>
                      <span className="facet-count">{count}</span>
                    </button>
                    <div className="facet-menu-anchor">
                      <button
                        type="button"
                        className="facet-menu-btn"
                        aria-label={`Options for ${g.name}`}
                        aria-expanded={menu === menuKey}
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenu((m) => (m === menuKey ? null : menuKey))
                        }}
                      >
                        ⋯
                      </button>
                      <FacetMenu open={menu === menuKey} onClose={closeMenu}>
                        <button
                          type="button"
                          className="facet-menu-item"
                          onClick={() => {
                            void onUpdateGroup(g.id, { hidden: !g.hidden })
                            closeMenu()
                          }}
                        >
                          {g.hidden ? 'Unhide group' : 'Hide group'}
                        </button>
                        <button
                          type="button"
                          className="facet-menu-item"
                          onClick={() => {
                            setManageOpen(true)
                            closeMenu()
                          }}
                        >
                          Manage…
                        </button>
                      </FacetMenu>
                    </div>
                  </div>
                  {!g.collapsed && (
                    <div className="sender-group-members">
                      {g.senders.map((name) => {
                        const meta = senderMeta.get(name)
                        return renderSenderRow(
                          name,
                          meta?.initials || name.slice(0, 2).toUpperCase(),
                          meta?.count || 0,
                          g.id,
                        )
                      })}
                      {g.senders.length === 0 && (
                        <div className="sidebar-empty">Empty group</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="sender-group-block">
              <div className="facet-row-wrap group-row other-row">
                <span className="facet-collapse-spacer" />
                <div className="facet-row facet-row--group facet-row--static">
                  <span className="facet-label">Other</span>
                  <span className="facet-count">
                    {otherSenders.reduce((n, s) => n + s.count, 0)}
                  </span>
                </div>
              </div>
              <div className="sender-group-members">
                {otherSenders.map((s) =>
                  renderSenderRow(s.name, s.initials, s.count, null),
                )}
                {otherSenders.length === 0 && (
                  <div className="sidebar-empty">no ungrouped senders</div>
                )}
              </div>
            </div>

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
      <ManageGroupsModal
        open={manageOpen}
        groups={groups}
        allSenders={senders.map((s) => s.name)}
        onClose={() => setManageOpen(false)}
        onCreate={onCreateGroup}
        onRename={(id, name) => onUpdateGroup(id, { name })}
        onDelete={onDeleteGroup}
        onSetMembers={onSetGroupMembers}
      />
    </div>
  )
}
