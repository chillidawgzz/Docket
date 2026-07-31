import { useEffect, useState } from 'react'
import type { Document } from '../api/types'
import { downloadUrl } from '../api/client'
import { CATEGORIES } from '../lib/categories'
import { formatFullDate, formatMoney, formatSize } from '../lib/format'

function BigFileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 2h9l5 5v15a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface PreviewPanelProps {
  doc: Document | null
  onClose: () => void
  onView: (doc: Document) => void
}

export function PreviewPanel({ doc, onClose, onView }: PreviewPanelProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [doc?.id])

  if (!doc) return <aside className="preview-panel" aria-label="Document preview" />

  const meta = CATEGORIES[doc.category]
  const amount =
    doc.amount != null && doc.amount !== ''
      ? parseFloat(String(doc.amount))
      : NaN

  return (
    <aside className="preview-panel" aria-label="Document preview">
      <div className="preview-inner">
        <div className="preview-top">
          <button
            type="button"
            className="preview-close"
            aria-label="Close preview"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div
          className="preview-icon"
          style={{ ['--cat' as string]: meta.color }}
        >
          <BigFileIcon />
        </div>
        <div className="preview-filename">{doc.filename}</div>
        <div
          className="preview-cat cat-tag"
          style={{ ['--cat' as string]: meta.color }}
        >
          <span className="facet-dot" />
          {meta.label}
        </div>
        <div className="preview-meta">
          <div className="preview-meta-row">
            <span className="k">Sender</span>
            <span className="v">{doc.sender.name}</span>
          </div>
          <div className="preview-meta-row">
            <span className="k">Date</span>
            <span className="v">{formatFullDate(doc.date)}</span>
          </div>
          <div className="preview-meta-row">
            <span className="k">Size</span>
            <span className="v">{formatSize(doc.size)}</span>
          </div>
          {!Number.isNaN(amount) && (
            <div className="preview-meta-row">
              <span className="k">Amount</span>
              <span className="v">{formatMoney(amount)}</span>
            </div>
          )}
        </div>
        <div className="preview-actions preview-actions--stack">
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
          <div className="preview-actions-row">
            <button
              type="button"
              className="btn-download"
              onClick={() => {
                window.location.href = downloadUrl(doc.id)
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Download
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className={'email-block' + (expanded ? ' expanded' : '')}>
          <div className="email-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M3 6l9 7 9-7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            Received via email
          </div>
          <div className="email-subject">{doc.email.subject}</div>
          <div className="email-from">
            {doc.email.from} · {formatFullDate(doc.email.date)}
          </div>
          <div className="email-snippet">{doc.email.snippet}</div>
          {doc.email.full && (
            <>
              <div className="email-full">{doc.email.full}</div>
              <button
                type="button"
                className="email-toggle"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Show less' : 'View full email'}
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
