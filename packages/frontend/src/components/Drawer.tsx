import type { Document } from '../api/types'
import { formatFullDate, formatSize } from '../lib/format'
import { useAttachmentPreview } from '../hooks/useAttachmentPreview'
import { AttachmentBody } from './AttachmentBody'

interface DrawerProps {
  doc: Document | null
  onClose: () => void
  onView: (doc: Document) => void
}

export function Drawer({ doc, onClose, onView }: DrawerProps) {
  const open = !!doc
  const preview = useAttachmentPreview(doc, {
    maxSheetRows: 100,
    maxTextChars: 100_000,
    needPdfBytes: true,
  })

  return (
    <>
      <div
        className={'drawer-overlay' + (open ? ' open' : '')}
        onClick={onClose}
      />
      <div className={'drawer' + (open ? ' open' : '')}>
        <div className="drawer-header">
          <h3>{doc?.filename ?? ''}</h3>
          <button type="button" className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {doc && (
          <div className="drawer-content">
            <div className="drawer-preview-container">
              <AttachmentBody
                doc={doc}
                preview={preview}
                variant="compact"
              />
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
            </div>
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
          </div>
        )}
      </div>
    </>
  )
}
