import { useEffect } from 'react'
import type { Document } from '../api/types'
import { downloadUrl } from '../api/client'
import { useAttachmentPreview } from '../hooks/useAttachmentPreview'
import { AttachmentBody } from './AttachmentBody'

interface ViewModalProps {
  doc: Document | null
  onClose: () => void
}

export function ViewModal({ doc, onClose }: ViewModalProps) {
  const preview = useAttachmentPreview(doc, {
    maxSheetRows: 2000,
    maxTextChars: 1_000_000,
    needPdfBytes: false,
  })

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
        className="view-modal"
        role="dialog"
        aria-modal="true"
        aria-label={doc.filename}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="view-modal-header">
          <h3 className="view-modal-title">{doc.filename}</h3>
          <div className="view-modal-actions">
            <button
              type="button"
              className="btn-download"
              onClick={() => {
                window.location.href = downloadUrl(doc.id)
              }}
            >
              Download
            </button>
            <button
              type="button"
              className="view-modal-close"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        <AttachmentBody doc={doc} preview={preview} variant="full" />
      </div>
    </div>
  )
}
