import { useEffect, useState } from 'react'
import type { Document } from '../api/types'
import { Spinner } from './Spinner'
import { TagPicker } from './TagPicker'

export type BulkTagMode = 'add' | 'replace' | 'remove'

interface BulkTagsModalProps {
  docs: Document[]
  suggestions: string[]
  onClose: () => void
  onSave: (tags: string[], mode: BulkTagMode) => Promise<void>
}

export function BulkTagsModal({
  docs,
  suggestions,
  onClose,
  onSave,
}: BulkTagsModalProps) {
  const [tags, setTags] = useState<string[]>([])
  const [mode, setMode] = useState<BulkTagMode>('add')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!docs.length) return
    setTags([])
    setMode('add')
    setError('')
  }, [docs])

  useEffect(() => {
    if (!docs.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [docs, onClose])

  if (!docs.length) return null

  const actionLabel =
    mode === 'add' ? 'Add tags' : mode === 'replace' ? 'Replace tags' : 'Remove tags'

  return (
    <div className="view-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-tags-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-modal-header">
          <h3 id="bulk-tags-title">Tag {docs.length} files</h3>
          <button type="button" className="view-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="edit-modal-sub">
          Choose tags, then add them to every selected file, replace all tags, or
          remove matching ones.
        </p>

        <div
          className="bulk-tag-mode"
          role="group"
          aria-label="Tag action"
        >
          {(
            [
              ['add', 'Add'],
              ['replace', 'Replace'],
              ['remove', 'Remove'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={'bulk-tag-mode-btn' + (mode === key ? ' active' : '')}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <TagPicker
          value={tags}
          suggestions={suggestions}
          onChange={setTags}
          placeholder={
            mode === 'remove' ? 'Tags to remove…' : 'Tags to apply…'
          }
        />

        {error && <div className="edit-modal-error">{error}</div>}
        <div className="edit-modal-actions">
          <button type="button" className="btn-clear" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-download btn-with-spinner"
            disabled={saving || tags.length === 0}
            onClick={() => {
              setSaving(true)
              setError('')
              void onSave(tags, mode)
                .then(onClose)
                .catch(() => setError('Could not update tags'))
                .finally(() => setSaving(false))
            }}
          >
            {saving ? (
              <>
                <Spinner size="sm" />
                Saving…
              </>
            ) : (
              `${actionLabel} · ${docs.length}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Merge / replace / remove tags for one document. */
export function applyBulkTags(
  existing: string[],
  tags: string[],
  mode: BulkTagMode,
): string[] {
  if (mode === 'replace') return [...tags]
  if (mode === 'add') {
    const next = [...existing]
    for (const tag of tags) {
      if (!next.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        next.push(tag)
      }
    }
    return next
  }
  const remove = new Set(tags.map((t) => t.toLowerCase()))
  return existing.filter((t) => !remove.has(t.toLowerCase()))
}
