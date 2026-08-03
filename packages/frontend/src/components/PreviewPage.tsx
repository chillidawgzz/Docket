import { useEffect, useMemo, useRef, useState } from 'react'
import type { Document } from '../api/types'
import { downloadUrl } from '../api/client'
import { expandFilenameTemplate } from '../lib/filenameTemplate'
import { formatFullDate, formatSize } from '../lib/format'
import { useAttachmentPreview } from '../hooks/useAttachmentPreview'
import { AttachmentBody } from './AttachmentBody'
import { Spinner } from './Spinner'

interface PreviewPageProps {
  doc: Document
  onBack: () => void
  onView: (doc: Document) => void
  onRename: (filename: string) => Promise<void>
}

const MACROS = [
  { token: '{yyyy}', label: 'Year' },
  { token: '{mm}', label: 'Month' },
  { token: '{dd}', label: 'Day' },
] as const

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5l3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function PreviewPage({ doc, onBack, onView, onRename }: PreviewPageProps) {
  const preview = useAttachmentPreview(doc, {
    maxSheetRows: 100,
    maxTextChars: 100_000,
    needPdfBytes: true,
  })
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(doc.filename)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setValue(doc.filename)
  }, [doc.filename, editing])

  useEffect(() => {
    if (!editing) return
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 20)
    return () => window.clearTimeout(t)
  }, [editing])

  const expanded = useMemo(() => {
    const template = value.trim()
    if (!template) return ''
    return expandFilenameTemplate(template, doc.date, doc.filename)
  }, [doc.date, doc.filename, value])

  const showPreview =
    editing &&
    expanded &&
    (expanded !== value.trim() || /\{yyyy\}|\{mm\}|\{dd\}/i.test(value))

  const startEdit = () => {
    setValue(doc.filename)
    setError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setValue(doc.filename)
    setError('')
  }

  const saveEdit = async () => {
    const template = value.trim()
    if (!template) {
      setError('Name required')
      inputRef.current?.focus()
      return
    }
    const next = expandFilenameTemplate(template, doc.date, doc.filename)
    if (next === doc.filename) {
      setEditing(false)
      setError('')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onRename(next)
      setEditing(false)
    } catch {
      setError('Could not save')
    } finally {
      setSaving(false)
    }
  }

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

  return (
    <main className="sync-page preview-page" aria-label="Attachment preview">
      <div className="sync-page-inner preview-page-inner">
        <header className="sync-header">
          <button type="button" className="sync-back" onClick={onBack}>
            ← Documents
          </button>
          <div className="preview-page-heading">
            {editing ? (
              <div className="preview-page-edit">
                <div className="preview-page-title-row">
                  <input
                    ref={inputRef}
                    className="preview-page-title-input"
                    value={value}
                    disabled={saving}
                    aria-label="Attachment name"
                    onChange={(e) => {
                      setValue(e.target.value)
                      setError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void saveEdit()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelEdit()
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="preview-page-edit-action btn-with-spinner"
                    disabled={saving || !value.trim()}
                    onClick={() => void saveEdit()}
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" />
                        Saving
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                  <button
                    type="button"
                    className="preview-page-edit-action preview-page-edit-action--muted"
                    disabled={saving}
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </div>
                <div
                  className="bulk-rename-macros preview-page-macros"
                  role="group"
                  aria-label="Insert date macro"
                >
                  {MACROS.map((m) => (
                    <button
                      key={m.token}
                      type="button"
                      className="bulk-rename-macro"
                      disabled={saving}
                      onClick={() => insertMacro(m.token)}
                    >
                      {m.token}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
                {showPreview && (
                  <div className="preview-page-result" title={expanded}>
                    → {expanded}
                  </div>
                )}
                {error && <div className="edit-modal-error">{error}</div>}
              </div>
            ) : (
              <div className="preview-page-title-row">
                <h1 className="sync-title preview-page-title" title={doc.filename}>
                  {doc.filename}
                </h1>
                <button
                  type="button"
                  className="preview-page-pencil"
                  aria-label="Rename attachment"
                  title="Rename"
                  onClick={startEdit}
                >
                  <PencilIcon />
                </button>
              </div>
            )}
            <p className="sync-subtitle">
              {doc.sender.name} · {formatFullDate(doc.date)}
            </p>
          </div>
        </header>

        <div className="preview-page-layout">
          <section className="preview-page-panel preview-page-panel--media" aria-label="Attachment">
            <div className="drawer-preview-container">
              <AttachmentBody doc={doc} preview={preview} variant="compact" />
            </div>
            <div className="preview-page-actions">
              <button
                type="button"
                className="btn-view"
                onClick={() => onView(doc)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
                View attachment
              </button>
              <button
                type="button"
                className="btn-download"
                onClick={() => {
                  window.location.href = downloadUrl(doc.id)
                }}
              >
                Download
              </button>
            </div>
          </section>

          <section className="preview-page-panel" aria-label="Details">
            <div className="drawer-meta">
              <div className="drawer-meta-row">
                <div className="drawer-meta-key">Size:</div>
                <div className="drawer-meta-val">{formatSize(doc.size)}</div>
              </div>
              <div className="drawer-meta-row">
                <div className="drawer-meta-key">From:</div>
                <div className="drawer-meta-val">{doc.sender.name}</div>
              </div>
              <div className="drawer-meta-row">
                <div className="drawer-meta-key">Date:</div>
                <div className="drawer-meta-val">
                  {formatFullDate(doc.date)}
                </div>
              </div>
              <div className="drawer-meta-row">
                <div className="drawer-meta-key">Subject:</div>
                <div className="drawer-meta-val">{doc.email.subject}</div>
              </div>
            </div>
            <div className="drawer-email">
              <div className="drawer-email-label">Email</div>
              <div className="drawer-email-from">
                {doc.email.from} · {formatFullDate(doc.email.date)}
              </div>
              {doc.email.full || doc.email.snippet ? (
                <pre className="drawer-email-body">
                  {doc.email.full || doc.email.snippet}
                </pre>
              ) : (
                <div className="drawer-email-empty">No email body stored</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
