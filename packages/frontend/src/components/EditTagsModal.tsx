import { useEffect, useState } from 'react'
import type { Document } from '../api/types'
import { Spinner } from './Spinner'
import { TagPicker } from './TagPicker'

interface EditTagsModalProps {
  doc: Document | null
  suggestions: string[]
  onClose: () => void
  onSave: (tags: string[]) => Promise<void>
}

export function EditTagsModal({
  doc,
  suggestions,
  onClose,
  onSave,
}: EditTagsModalProps) {
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTags(doc?.tags ?? [])
    setError('')
  }, [doc])

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, onClose])

  if (!doc) return null

  return (
    <div className="view-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit tags"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-modal-header">
          <h3>Tags</h3>
          <button type="button" className="view-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="edit-modal-sub">{doc.filename}</p>
        <TagPicker value={tags} suggestions={suggestions} onChange={setTags} />
        {error && <div className="edit-modal-error">{error}</div>}
        <div className="edit-modal-actions">
          <button type="button" className="btn-clear" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-download btn-with-spinner"
            disabled={saving}
            onClick={() => {
              setSaving(true)
              setError('')
              void onSave(tags)
                .then(onClose)
                .catch(() => setError('Could not save tags'))
                .finally(() => setSaving(false))
            }}
          >
            {saving ? (
              <>
                <Spinner size="sm" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
