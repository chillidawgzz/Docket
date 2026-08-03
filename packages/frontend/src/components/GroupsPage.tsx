import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SenderGroupInfo } from '../lib/filters'
import { Spinner } from './Spinner'

interface GroupsPageProps {
  groups: SenderGroupInfo[]
  allSenders: string[]
  onBack: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onSetMembers: (id: number, senders: string[]) => Promise<void>
  onReorder: (ids: number[]) => Promise<void>
}

type SenderFilter = 'all' | 'in' | 'out'

function sameMembers(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((s) => set.has(s))
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="3" r="1" />
      <circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="8" cy="9" r="1" />
    </svg>
  )
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function GroupsPage({
  groups,
  allSenders,
  onBack,
  onCreate,
  onRename,
  onDelete,
  onSetMembers,
  onReorder,
}: GroupsPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [selectedSenders, setSelectedSenders] = useState<string[]>([])
  const [savedSenders, setSavedSenders] = useState<string[]>([])
  const [savedName, setSavedName] = useState('')
  const [senderQuery, setSenderQuery] = useState('')
  const [senderFilter, setSenderFilter] = useState<SenderFilter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [status, setStatus] = useState('')
  const [pendingSelectName, setPendingSelectName] = useState<string | null>(null)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)
  const createRef = useRef<HTMLInputElement>(null)
  const draftGroupId = useRef<number | null>(null)

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) || null,
    [groups, selectedId],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, number>()
    for (const g of groups) {
      for (const s of g.senders) map.set(s, g.id)
    }
    return map
  }, [groups])

  const membersDirty = !sameMembers(selectedSenders, savedSenders)
  const renameDirty =
    renameValue.trim() !== '' && renameValue.trim() !== savedName
  const dirty = Boolean(selected) && (membersDirty || renameDirty)

  const requestBack = useCallback(() => {
    if (busy) return
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    onBack()
  }, [busy, dirty, onBack])

  useEffect(() => {
    setError('')
    setStatus('')
    setNewName('')
    setSenderQuery('')
    setSenderFilter('all')
    setConfirmDelete(false)
    const t = window.setTimeout(() => createRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (pendingSelectName) {
      const created = groups.find(
        (g) => g.name.toLowerCase() === pendingSelectName.toLowerCase(),
      )
      if (created) {
        draftGroupId.current = null
        setSelectedId(created.id)
        setPendingSelectName(null)
        return
      }
    }
    if (!groups.length) {
      setSelectedId(null)
      return
    }
    if (selectedId == null || !groups.some((g) => g.id === selectedId)) {
      setSelectedId(groups[0].id)
    }
  }, [groups, selectedId, pendingSelectName])

  useEffect(() => {
    if (!selected) {
      draftGroupId.current = null
      setRenameValue('')
      setSavedName('')
      setSelectedSenders([])
      setSavedSenders([])
      setConfirmDelete(false)
      return
    }
    if (draftGroupId.current === selected.id) return
    draftGroupId.current = selected.id
    setRenameValue(selected.name)
    setSavedName(selected.name)
    setSelectedSenders([...selected.senders])
    setSavedSenders([...selected.senders])
    setConfirmDelete(false)
    setError('')
  }, [selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        requestBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestBack])

  const run = async (fn: () => Promise<void>, okMessage?: string) => {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await fn()
      if (okMessage) setStatus(okMessage)
    } catch {
      setError('Could not save changes. Check the name and try again.')
    } finally {
      setBusy(false)
    }
  }

  const moveGroup = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= groups.length ||
      toIndex >= groups.length
    ) {
      return
    }
    const ids = groups.map((g) => g.id)
    const [id] = ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, id)
    void run(async () => {
      await onReorder(ids)
    })
  }

  const selectGroup = (id: number) => {
    if (id === selectedId) return
    if (dirty) {
      const ok = window.confirm('You have unsaved changes. Discard them?')
      if (!ok) return
    }
    draftGroupId.current = null
    setSelectedId(id)
  }

  const toggleSender = (name: string) => {
    setSelectedSenders((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
    setStatus('')
  }

  const filteredSenders = allSenders.filter((name) => {
    const q = senderQuery.trim().toLowerCase()
    if (q && !name.toLowerCase().includes(q)) return false
    const inSelected = selectedSenders.includes(name)
    if (senderFilter === 'in') return inSelected
    if (senderFilter === 'out') return !inSelected
    return true
  })

  const createGroup = () => {
    const name = newName.trim()
    if (!name) {
      setError('Enter a group name to create one.')
      createRef.current?.focus()
      return
    }
    void run(async () => {
      await onCreate(name)
      setNewName('')
      setPendingSelectName(name)
      setStatus(`Created “${name}”`)
    })
  }

  const saveAll = () => {
    if (!selected) return
    const nextName = renameValue.trim()
    if (!nextName) {
      setError('Group name can’t be empty.')
      return
    }
    void run(async () => {
      if (renameDirty) await onRename(selected.id, nextName)
      if (membersDirty || renameDirty) {
        await onSetMembers(selected.id, selectedSenders)
      }
      setSavedSenders([...selectedSenders])
      setSavedName(nextName)
      setStatus('Group saved')
    })
  }

  return (
    <main className="sync-page groups-page" aria-label="Manage sender groups">
      <div className="sync-page-inner groups-page-inner">
        <header className="sync-header">
          <button type="button" className="sync-back" onClick={requestBack}>
            ← Documents
          </button>
          <div>
            <h1 className="sync-title" id="manage-groups-title">
              Sender groups
            </h1>
            <p className="sync-subtitle" id="manage-groups-desc">
              Organize senders into groups. Drag to reorder. Each sender can only
              be in one group.
            </p>
          </div>
        </header>

        <div className="manage-groups-layout groups-page-layout">
          <section className="manage-groups-col" aria-label="Groups">
            <div className="manage-panel-head">
              <h4 className="manage-panel-title">Groups</h4>
              <span className="manage-panel-meta">{groups.length}</span>
            </div>

            <div className="manage-field">
              <label className="manage-field-label" htmlFor="manage-group-create">
                New group
              </label>
              <div className="manage-groups-create">
                <input
                  id="manage-group-create"
                  ref={createRef}
                  className="edit-modal-input"
                  value={newName}
                  placeholder="e.g. Banks, Utilities"
                  disabled={busy}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    setError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      createGroup()
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-download"
                  disabled={busy || !newName.trim()}
                  onClick={createGroup}
                >
                  Add
                </button>
              </div>
            </div>

            <div className="manage-groups-list" role="listbox" aria-label="Saved groups">
              {groups.map((g, index) => {
                const active = selectedId === g.id
                return (
                  <div
                    key={g.id}
                    role="option"
                    aria-selected={active}
                    className={
                      'manage-group-item' +
                      (active ? ' active' : '') +
                      (dragId === g.id ? ' dragging' : '') +
                      (dropTargetId === g.id ? ' drop-target' : '')
                    }
                    draggable={!busy}
                    onDragStart={(e) => {
                      setDragId(g.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(g.id))
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setDropTargetId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dropTargetId !== g.id) setDropTargetId(g.id)
                    }}
                    onDragLeave={() => {
                      if (dropTargetId === g.id) setDropTargetId(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromId = Number(
                        e.dataTransfer.getData('text/plain') || dragId,
                      )
                      setDragId(null)
                      setDropTargetId(null)
                      const fromIndex = groups.findIndex((x) => x.id === fromId)
                      const toIndex = groups.findIndex((x) => x.id === g.id)
                      if (fromIndex >= 0 && toIndex >= 0) {
                        moveGroup(fromIndex, toIndex)
                      }
                    }}
                  >
                    <span
                      className="manage-drag-handle"
                      title="Drag to reorder"
                      aria-hidden="true"
                    >
                      <GripIcon />
                    </span>
                    <button
                      type="button"
                      className="manage-group-select"
                      onClick={() => selectGroup(g.id)}
                    >
                      <span className="manage-group-name">{g.name}</span>
                      <span className="facet-count" title="Members">
                        {g.senders.length}
                      </span>
                    </button>
                    <div className="manage-order-btns">
                      <button
                        type="button"
                        className="manage-order-btn"
                        aria-label={`Move ${g.name} up`}
                        disabled={busy || index === 0}
                        onClick={(e) => {
                          e.stopPropagation()
                          moveGroup(index, index - 1)
                        }}
                      >
                        <ChevronUpIcon />
                      </button>
                      <button
                        type="button"
                        className="manage-order-btn"
                        aria-label={`Move ${g.name} down`}
                        disabled={busy || index === groups.length - 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          moveGroup(index, index + 1)
                        }}
                      >
                        <ChevronDownIcon />
                      </button>
                    </div>
                  </div>
                )
              })}
              {groups.length === 0 && (
                <div className="manage-empty">
                  <p>No groups yet</p>
                  <span>Create one above to start assigning senders.</span>
                </div>
              )}
            </div>
          </section>

          <section className="manage-groups-col" aria-label="Group details">
            {selected ? (
              <>
                <div className="manage-panel-head">
                  <h4 className="manage-panel-title">Members</h4>
                  <span className="manage-panel-meta">
                    {selectedSenders.length} selected
                    {dirty ? ' · unsaved' : ''}
                  </span>
                </div>

                <div className="manage-field">
                  <label className="manage-field-label" htmlFor="manage-group-name">
                    Group name
                  </label>
                  <input
                    id="manage-group-name"
                    className="edit-modal-input"
                    value={renameValue}
                    disabled={busy}
                    onChange={(e) => {
                      setRenameValue(e.target.value)
                      setStatus('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        saveAll()
                      }
                    }}
                  />
                </div>

                <div className="manage-field">
                  <label className="manage-field-label" htmlFor="manage-sender-search">
                    Find senders
                  </label>
                  <div className="manage-search">
                    <span className="manage-search-icon">
                      <SearchIcon />
                    </span>
                    <input
                      id="manage-sender-search"
                      className="edit-modal-input manage-search-input"
                      value={senderQuery}
                      placeholder="Search by name"
                      disabled={busy}
                      onChange={(e) => setSenderQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div
                  className="manage-filter-row"
                  role="group"
                  aria-label="Filter senders"
                >
                  {(
                    [
                      ['all', 'All'],
                      ['in', 'In group'],
                      ['out', 'Available'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        'manage-filter-chip' +
                        (senderFilter === key ? ' active' : '')
                      }
                      aria-pressed={senderFilter === key}
                      onClick={() => setSenderFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                  <div className="manage-filter-actions">
                    <button
                      type="button"
                      className="manage-text-btn"
                      disabled={busy || filteredSenders.length === 0}
                      onClick={() => {
                        setSelectedSenders((prev) => {
                          const next = new Set(prev)
                          for (const s of filteredSenders) next.add(s)
                          return [...next]
                        })
                        setStatus('')
                      }}
                    >
                      Select shown
                    </button>
                    <button
                      type="button"
                      className="manage-text-btn"
                      disabled={busy || selectedSenders.length === 0}
                      onClick={() => {
                        setSelectedSenders([])
                        setStatus('')
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="manage-senders-list" role="group" aria-label="Senders">
                  {filteredSenders.map((name) => {
                    const otherGroupId = grouped.get(name)
                    const inOther =
                      otherGroupId != null && otherGroupId !== selected.id
                    const otherName = inOther
                      ? groups.find((g) => g.id === otherGroupId)?.name
                      : null
                    const checked = selectedSenders.includes(name)
                    return (
                      <label
                        key={name}
                        className={
                          'manage-sender-row' + (checked ? ' checked' : '')
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleSender(name)}
                        />
                        <span className="facet-label" title={name}>
                          {name}
                        </span>
                        {otherName && (
                          <span
                            className="manage-sender-meta"
                            title={`Currently in ${otherName}`}
                          >
                            in {otherName}
                          </span>
                        )}
                      </label>
                    )
                  })}
                  {allSenders.length === 0 && (
                    <div className="manage-empty">
                      <p>No senders yet</p>
                      <span>Sync mail to populate senders.</span>
                    </div>
                  )}
                  {allSenders.length > 0 && filteredSenders.length === 0 && (
                    <div className="manage-empty">
                      <p>No matches</p>
                      <span>Try another search or filter.</span>
                    </div>
                  )}
                </div>

                <div className="manage-footer">
                  <div className="manage-danger-zone">
                    {confirmDelete ? (
                      <>
                        <span className="manage-danger-hint">Delete this group?</span>
                        <button
                          type="button"
                          className="manage-text-btn"
                          disabled={busy}
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const id = selected.id
                              await onDelete(id)
                              draftGroupId.current = null
                              setSelectedId(null)
                              setConfirmDelete(false)
                              setStatus('Group deleted')
                            })
                          }
                        >
                          Confirm delete
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="manage-text-btn manage-text-btn--danger"
                        disabled={busy}
                        onClick={() => setConfirmDelete(true)}
                      >
                        Delete group
                      </button>
                    )}
                  </div>
                  <div className="edit-modal-actions manage-footer-actions">
                    <button
                      type="button"
                      className="btn-download btn-with-spinner"
                      disabled={busy || !dirty}
                      onClick={saveAll}
                    >
                      {busy ? (
                        <>
                          <Spinner size="sm" />
                          Saving…
                        </>
                      ) : (
                        'Save changes'
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="manage-empty manage-empty--panel">
                <p>Select or create a group</p>
                <span>Pick a group on the left to edit its members.</span>
              </div>
            )}
          </section>
        </div>

        <div className="manage-status-row" aria-live="polite">
          {error && (
            <div className="edit-modal-error" role="alert">
              {error}
            </div>
          )}
          {!error && status && <div className="manage-status-ok">{status}</div>}
        </div>
      </div>
    </main>
  )
}
