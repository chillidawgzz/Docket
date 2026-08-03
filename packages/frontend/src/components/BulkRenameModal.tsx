import { useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from '../api/types'
import {
  expandFilenameTemplate,
  uniquifyFilenames,
} from '../lib/filenameTemplate'
import { Spinner } from './Spinner'

interface BulkRenameModalProps {
  docs: Document[]
  onClose: () => void
  onSave: (renames: { id: string; filename: string }[]) => Promise<void>
}

const MACROS = [
  { token: '{yyyy}', label: 'Year' },
  { token: '{mm}', label: 'Month' },
  { token: '{dd}', label: 'Day' },
] as const

export function BulkRenameModal({
  docs,
  onClose,
  onSave,
}: BulkRenameModalProps) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!docs.length) return
    setValue('')
    setError('')
    const t = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [docs])

  useEffect(() => {
    if (!docs.length) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [docs, onClose])

  const preview = useMemo(() => {
    const template = value.trim()
    if (!template) return []
    const expanded = docs.map((d) => ({
      id: d.id,
      from: d.filename,
      filename: expandFilenameTemplate(template, d.date, d.filename),
    }))
    const unique = uniquifyFilenames(
      expanded.map((e) => ({ id: e.id, filename: e.filename })),
    )
    const byId = new Map(unique.map((u) => [u.id, u.filename]))
    return expanded.map((e) => ({
      id: e.id,
      from: e.from,
      filename: byId.get(e.id) || e.filename,
    }))
  }, [docs, value])

  if (!docs.length) return null

  const insertMacro = (token: string) => {
    const el = inputRef.current
    if (!el) {
      setValue((v) => v + token)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const submit = () => {
    const template = value.trim()
    if (!template) {
      setError('Enter a name pattern')
      inputRef.current?.focus()
      return
    }
    if (!/\{yyyy\}|\{mm\}|\{dd\}/i.test(template)) {
      // Allow static names too, but warn if all would collide hard — uniquify handles it
    }
    const renames = uniquifyFilenames(
      docs.map((d) => ({
        id: d.id,
        filename: expandFilenameTemplate(template, d.date, d.filename),
      })),
    )
    setSaving(true)
    setError('')
    void onSave(renames)
      .then(onClose)
      .catch(() => setError('Could not rename some files'))
      .finally(() => setSaving(false))
  }

  return (
    <div className="view-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="edit-modal bulk-rename-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-rename-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-modal-header">
          <h3 id="bulk-rename-title">Rename {docs.length} files</h3>
          <button type="button" className="view-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="edit-modal-sub">
          Use date macros that expand per file. Example:{' '}
          <code className="bulk-rename-code">Cavalry Mews - {'{yyyy}'}-{'{mm}'}-{'{dd}'}</code>
        </p>

        <label className="bulk-rename-label" htmlFor="bulk-rename-pattern">
          Name pattern
        </label>
        <input
          id="bulk-rename-pattern"
          ref={inputRef}
          className="edit-modal-input"
          value={value}
          placeholder="Name - {yyyy}-{mm}-{dd}"
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />

        <div className="bulk-rename-macros" role="group" aria-label="Insert date macro">
          {MACROS.map((m) => (
            <button
              key={m.token}
              type="button"
              className="bulk-rename-macro"
              onClick={() => insertMacro(m.token)}
            >
              {m.token}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {preview.length > 0 && (
          <div className="bulk-rename-preview">
            <div className="bulk-rename-preview-label">Preview</div>
            <ul className="bulk-rename-preview-list">
              {preview.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <span className="bulk-rename-from" title={p.from}>
                    {p.from}
                  </span>
                  <span className="bulk-rename-arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="bulk-rename-to" title={p.filename}>
                    {p.filename}
                  </span>
                </li>
              ))}
              {preview.length > 8 && (
                <li className="bulk-rename-more">
                  +{preview.length - 8} more
                </li>
              )}
            </ul>
          </div>
        )}

        {error && <div className="edit-modal-error">{error}</div>}
        <div className="edit-modal-actions">
          <button type="button" className="btn-clear" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-download btn-with-spinner"
            disabled={saving || !value.trim()}
            onClick={submit}
          >
            {saving ? (
              <>
                <Spinner size="sm" />
                Renaming…
              </>
            ) : (
              `Rename ${docs.length}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
