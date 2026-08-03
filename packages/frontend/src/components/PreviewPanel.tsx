import type { Document } from '../api/types'
import { downloadUrl } from '../api/client'
import { formatFullDate, formatMoney, formatSize } from '../lib/format'
import { tagColor } from '../lib/tagColor'

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
  if (!doc) return <aside className="preview-panel" aria-label="Document preview" />

  const accent = doc.tags[0] ? tagColor(doc.tags[0]) : 'var(--accent)'
  const amount =
    doc.amount != null && doc.amount !== ''
      ? parseFloat(String(doc.amount))
      : NaN
  const emailBody = doc.email.full || doc.email.snippet || ''

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
          style={{ ['--cat' as string]: accent }}
        >
          <BigFileIcon />
        </div>
        <div className="preview-filename">{doc.filename}</div>
        {doc.tags.length > 0 && (
          <div className="preview-tags">
            {doc.tags.map((t) => (
              <span
                key={t}
                className="tag-pill"
                style={{ ['--cat' as string]: tagColor(t) }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
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
        <div className="email-block email-block--open">
          <div className="email-label">Email</div>
          <div className="email-subject">{doc.email.subject}</div>
          <div className="email-from">
            {doc.email.from} · {formatFullDate(doc.email.date)}
          </div>
          {emailBody ? (
            <pre className="email-body">{emailBody}</pre>
          ) : (
            <div className="email-empty">No email body stored</div>
          )}
        </div>
        <div className="preview-actions preview-actions--stack">
          <button
            type="button"
            className="btn-view"
            onClick={() => onView(doc)}
          >
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
              Download
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
