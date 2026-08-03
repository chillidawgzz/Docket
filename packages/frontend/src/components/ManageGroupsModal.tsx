import { useEffect, useMemo, useState } from 'react'
import type { SenderGroupInfo } from '../lib/filters'

interface ManageGroupsModalProps {
  open: boolean
  groups: SenderGroupInfo[]
  allSenders: string[]
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onSetMembers: (id: number, senders: string[]) => Promise<void>
}

export function ManageGroupsModal({
  open,
  groups,
  allSenders,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onSetMembers,
}: ManageGroupsModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [selectedSenders, setSelectedSenders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (!open) return
    setError('')
    setNewName('')
    if (groups.length && (selectedId == null || !groups.some((g) => g.id === selectedId))) {
      setSelectedId(groups[0].id)
    }
  }, [open, groups, selectedId])

  useEffect(() => {
    if (!selected) {
      setRenameValue('')
      setSelectedSenders([])
      return
    }
    setRenameValue(selected.name)
    setSelectedSenders([...selected.senders])
  }, [selected])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch {
      setError('Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  const toggleSender = (name: string) => {
    setSelectedSenders((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  return (
    <div className="view-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="edit-modal manage-groups-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Manage sender groups"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-modal-header">
          <h3>Manage groups</h3>
          <button type="button" className="view-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="edit-modal-sub">
          Create groups and assign senders. A sender can belong to one group.
        </p>

        <div className="manage-groups-layout">
          <div className="manage-groups-col">
            <div className="manage-groups-create">
              <input
                className="edit-modal-input"
                value={newName}
                placeholder="New group name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    void run(async () => {
                      await onCreate(newName.trim())
                      setNewName('')
                    })
                  }
                }}
              />
              <button
                type="button"
                className="btn-download"
                disabled={busy || !newName.trim()}
                onClick={() =>
                  void run(async () => {
                    await onCreate(newName.trim())
                    setNewName('')
                  })
                }
              >
                Add
              </button>
            </div>
            <div className="manage-groups-list">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={
                    'manage-group-item' + (selectedId === g.id ? ' active' : '')
                  }
                  onClick={() => setSelectedId(g.id)}
                >
                  <span>{g.name}</span>
                  <span className="facet-count">{g.senders.length}</span>
                </button>
              ))}
              {groups.length === 0 && (
                <div className="sidebar-empty">No groups yet</div>
              )}
            </div>
          </div>

          <div className="manage-groups-col">
            {selected ? (
              <>
                <div className="manage-groups-rename">
                  <input
                    className="edit-modal-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label="Rename group"
                  />
                  <button
                    type="button"
                    className="btn-clear"
                    disabled={busy || !renameValue.trim() || renameValue === selected.name}
                    onClick={() =>
                      void run(() => onRename(selected.id, renameValue.trim()))
                    }
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn-clear"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await onDelete(selected.id)
                        setSelectedId(null)
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
                <div className="manage-senders-list">
                  {allSenders.map((name) => {
                    const otherGroupId = grouped.get(name)
                    const inOther =
                      otherGroupId != null && otherGroupId !== selected.id
                    const otherName = inOther
                      ? groups.find((g) => g.id === otherGroupId)?.name
                      : null
                    const checked = selectedSenders.includes(name)
                    return (
                      <label key={name} className="manage-sender-row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSender(name)}
                        />
                        <span className="facet-label">{name}</span>
                        {otherName && (
                          <span className="manage-sender-meta">{otherName}</span>
                        )}
                      </label>
                    )
                  })}
                  {allSenders.length === 0 && (
                    <div className="sidebar-empty">No senders</div>
                  )}
                </div>
                <div className="edit-modal-actions">
                  <button type="button" className="btn-clear" onClick={onClose}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-download"
                    disabled={busy}
                    onClick={() =>
                      void run(() => onSetMembers(selected.id, selectedSenders))
                    }
                  >
                    {busy ? 'Saving…' : 'Save members'}
                  </button>
                </div>
              </>
            ) : (
              <div className="sidebar-empty">Select or create a group</div>
            )}
          </div>
        </div>
        {error && <div className="edit-modal-error">{error}</div>}
      </div>
    </div>
  )
}
