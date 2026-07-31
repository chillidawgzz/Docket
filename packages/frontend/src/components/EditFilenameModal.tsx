import { useEffect, useState } from 'react'
import type { Document } from '../api/types'

interface EditFilenameModalProps {
  doc: Document | null
  onClose: () => void
  onSave: (downloadFilename: string) => Promise<void>
}

export function EditFilenameModal({
  doc,
  onClose,
  onSave,
}: EditFilenameModalProps) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(doc?.downloadFilename || doc?.filename || '')
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
        aria-label="Edit download filename"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-modal-header">
          <h3>Download filename</h3>
          <button type="button" className="view-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="edit-modal-sub">
          Original: <span className="mono">{doc.filename}</span>
        </p>
        <input
          className="edit-modal-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              setSaving(true)
              void onSave(value.trim())
                .then(onClose)
                .catch(() => setError('Could not save'))
                .finally(() => setSaving(false))
            }
          }}
        />
        {error && <div className="edit-modal-error">{error}</div>}
        <div className="edit-modal-actions">
          <button type="button" className="btn-clear" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-download"
            disabled={saving}
            onClick={() => {
              setSaving(true)
              setError('')
              void onSave(value.trim())
                .then(onClose)
                .catch(() => setError('Could not save'))
                .finally(() => setSaving(false))
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
