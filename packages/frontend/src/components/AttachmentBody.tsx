import { useEffect, useRef } from 'react'
import type { Document } from '../api/types'
import {
  type AttachmentPreviewState,
} from '../hooks/useAttachmentPreview'
import { renderPdfFirstPage } from '../lib/pdfRender'

interface AttachmentBodyProps {
  doc: Document
  preview: AttachmentPreviewState
  /** compact = drawer thumbnail; full = modal entire file */
  variant: 'compact' | 'full'
}

export function AttachmentBody({
  doc,
  preview,
  variant,
}: AttachmentBodyProps) {
  const {
    mode,
    message,
    objectUrl,
    pdfData,
    textContent,
    ics,
    eml,
    sheetRows,
  } = preview
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (variant !== 'compact' || mode !== 'pdf' || !pdfData || !canvasRef.current)
      return
    let cancelled = false
    void (async () => {
      await renderPdfFirstPage(pdfData, canvasRef.current!)
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [variant, mode, pdfData])

  const showMessage =
    mode === 'loading' ||
    mode === 'none' ||
    mode === 'password' ||
    mode === 'error'

  const tall =
    mode === 'text' ||
    mode === 'docx' ||
    mode === 'xlsx' ||
    mode === 'ics' ||
    mode === 'eml'

  if (variant === 'full') {
    return (
      <div className="view-modal-body">
        {showMessage && <div className="view-modal-message">{message}</div>}
        {mode === 'pdf' && objectUrl && (
          <iframe
            className="view-modal-frame"
            title={doc.filename}
            src={objectUrl}
          />
        )}
        {mode === 'image' && objectUrl && (
          <img
            src={objectUrl}
            className="view-modal-img"
            alt={doc.filename}
          />
        )}
        {mode === 'audio' && objectUrl && (
          <audio className="view-modal-audio" controls src={objectUrl} />
        )}
        {mode === 'video' && objectUrl && (
          <video className="view-modal-video" controls src={objectUrl} />
        )}
        {(mode === 'text' || mode === 'docx') && (
          <pre className="view-modal-text">{textContent}</pre>
        )}
        {mode === 'ics' && ics && (
          <div className="drawer-preview-card view-modal-card">
            <div className="drawer-card-title">{ics.summary}</div>
            {ics.start && (
              <div className="drawer-card-row">
                <span>Start</span>
                <span>{ics.start}</span>
              </div>
            )}
            {ics.end && (
              <div className="drawer-card-row">
                <span>End</span>
                <span>{ics.end}</span>
              </div>
            )}
            {ics.location && (
              <div className="drawer-card-row">
                <span>Where</span>
                <span>{ics.location}</span>
              </div>
            )}
            {ics.organizer && (
              <div className="drawer-card-row">
                <span>From</span>
                <span>{ics.organizer}</span>
              </div>
            )}
            {ics.description && (
              <pre className="drawer-preview-text drawer-preview-text--inline">
                {ics.description}
              </pre>
            )}
          </div>
        )}
        {mode === 'eml' && eml && (
          <div className="drawer-preview-card view-modal-card">
            <div className="drawer-card-title">{eml.subject}</div>
            {eml.from && (
              <div className="drawer-card-row">
                <span>From</span>
                <span>{eml.from}</span>
              </div>
            )}
            {eml.to && (
              <div className="drawer-card-row">
                <span>To</span>
                <span>{eml.to}</span>
              </div>
            )}
            {eml.date && (
              <div className="drawer-card-row">
                <span>Date</span>
                <span>{eml.date}</span>
              </div>
            )}
            <pre className="drawer-preview-text drawer-preview-text--inline">
              {eml.body}
            </pre>
          </div>
        )}
        {mode === 'xlsx' && (
          <div className="drawer-preview-table-wrap view-modal-table">
            <table className="drawer-preview-table">
              <tbody>
                {sheetRows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{String(cell ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={
        'drawer-preview-box' + (tall ? ' drawer-preview-box--tall' : '')
      }
    >
      {showMessage && message}
      {mode === 'pdf' && (
        <canvas ref={canvasRef} className="drawer-preview-canvas" />
      )}
      {mode === 'image' && objectUrl && (
        <img
          src={objectUrl}
          className="drawer-preview-img"
          alt={doc.filename}
        />
      )}
      {mode === 'audio' && objectUrl && (
        <audio className="drawer-preview-audio" controls src={objectUrl} />
      )}
      {mode === 'video' && objectUrl && (
        <video className="drawer-preview-video" controls src={objectUrl} />
      )}
      {(mode === 'text' || mode === 'docx') && (
        <pre className="drawer-preview-text">{textContent}</pre>
      )}
      {mode === 'ics' && ics && (
        <div className="drawer-preview-card">
          <div className="drawer-card-title">{ics.summary}</div>
          {ics.start && (
            <div className="drawer-card-row">
              <span>Start</span>
              <span>{ics.start}</span>
            </div>
          )}
          {ics.end && (
            <div className="drawer-card-row">
              <span>End</span>
              <span>{ics.end}</span>
            </div>
          )}
          {ics.location && (
            <div className="drawer-card-row">
              <span>Where</span>
              <span>{ics.location}</span>
            </div>
          )}
          {ics.organizer && (
            <div className="drawer-card-row">
              <span>From</span>
              <span>{ics.organizer}</span>
            </div>
          )}
          {ics.description && (
            <pre className="drawer-preview-text drawer-preview-text--inline">
              {ics.description}
            </pre>
          )}
        </div>
      )}
      {mode === 'eml' && eml && (
        <div className="drawer-preview-card">
          <div className="drawer-card-title">{eml.subject}</div>
          {eml.from && (
            <div className="drawer-card-row">
              <span>From</span>
              <span>{eml.from}</span>
            </div>
          )}
          {eml.to && (
            <div className="drawer-card-row">
              <span>To</span>
              <span>{eml.to}</span>
            </div>
          )}
          {eml.date && (
            <div className="drawer-card-row">
              <span>Date</span>
              <span>{eml.date}</span>
            </div>
          )}
          <pre className="drawer-preview-text drawer-preview-text--inline">
            {eml.body}
          </pre>
        </div>
      )}
      {mode === 'xlsx' && (
        <div className="drawer-preview-table-wrap">
          <table className="drawer-preview-table">
            <tbody>
              {sheetRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{String(cell ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
