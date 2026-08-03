import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Document } from '../api/types'
import { previewUrl } from '../api/client'
import { type AttachmentPreviewState } from '../hooks/useAttachmentPreview'
import { renderPdfFirstPage } from '../lib/pdfRender'
import { LoadingStatus } from './Spinner'

interface AttachmentBodyProps {
  doc: Document
  preview: AttachmentPreviewState
  /** compact = drawer thumbnail; full = modal entire file */
  variant: 'compact' | 'full'
}

type PdfStatus = 'idle' | 'rendering' | 'ok' | 'password' | 'error'

function PreviewNotice({
  title,
  detail,
}: {
  title: string
  detail?: string
}) {
  return (
    <div className="preview-status preview-status--notice" role="status">
      <span className="preview-status-title">{title}</span>
      {detail && <span className="preview-status-text">{detail}</span>}
    </div>
  )
}

export function AttachmentBody({
  doc,
  preview,
  variant,
}: AttachmentBodyProps) {
  const { mode, message, pdfData, textContent, ics, eml, sheetRows } = preview
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mediaError, setMediaError] = useState(false)
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>('idle')
  const [imageLoading, setImageLoading] = useState(true)
  const src = previewUrl(doc.id)

  useEffect(() => {
    setMediaError(false)
    setPdfStatus('idle')
    setImageLoading(true)
  }, [doc.id, mode])

  useEffect(() => {
    if (variant !== 'compact' || mode !== 'pdf' || !pdfData || !canvasRef.current)
      return
    let cancelled = false
    setPdfStatus('rendering')
    void (async () => {
      const status = await renderPdfFirstPage(pdfData, canvasRef.current!)
      if (cancelled) return
      setPdfStatus(status)
    })()
    return () => {
      cancelled = true
    }
  }, [variant, mode, pdfData])

  const tall =
    mode === 'text' ||
    mode === 'docx' ||
    mode === 'xlsx' ||
    mode === 'ics' ||
    mode === 'eml'

  const encrypted =
    mode === 'password' || (mode === 'pdf' && pdfStatus === 'password')

  const failed =
    mode === 'error' ||
    mode === 'none' ||
    mediaError ||
    (mode === 'pdf' && pdfStatus === 'error')

  const pdfBusy =
    mode === 'pdf' &&
    variant === 'compact' &&
    !encrypted &&
    !failed &&
    (!pdfData || pdfStatus === 'rendering' || pdfStatus === 'idle')

  let statusNode: ReactNode = null
  if (encrypted) {
    statusNode = (
      <PreviewNotice
        title="Encrypted file"
        detail="This attachment is password-protected and can’t be previewed."
      />
    )
  } else if (mode === 'loading' || pdfBusy || (mode === 'image' && imageLoading && !mediaError)) {
    statusNode = (
      <LoadingStatus label="Loading preview…" className="preview-status" />
    )
  } else if (failed) {
    const title =
      mode === 'none'
        ? 'No preview available'
        : mediaError && mode === 'image'
          ? 'Couldn’t display image'
          : 'Preview failed'
    const detail =
      mode === 'none'
        ? undefined
        : message && message !== 'Loading…'
          ? message
          : 'Something went wrong while loading this attachment.'
    statusNode = <PreviewNotice title={title} detail={detail} />
  }

  const showContent =
    !encrypted &&
    !failed &&
    mode !== 'loading' &&
    !(mode === 'pdf' && variant === 'compact' && pdfStatus !== 'ok')

  if (variant === 'full') {
    return (
      <div className="view-modal-body">
        {(mode === 'loading' || (mode === 'image' && imageLoading && !mediaError)) && (
          <LoadingStatus label="Loading preview…" className="preview-status" />
        )}
        {encrypted && statusNode}
        {failed && !encrypted && mode !== 'image' && statusNode}
        {mode === 'image' && mediaError && statusNode}
        {mode === 'pdf' && !encrypted && !failed && (
          <iframe
            className="view-modal-frame"
            title={doc.filename}
            src={src}
          />
        )}
        {mode === 'image' && !mediaError && (
          <img
            src={src}
            className="view-modal-img"
            alt={doc.filename}
            style={imageLoading ? { display: 'none' } : undefined}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false)
              setMediaError(true)
            }}
          />
        )}
        {mode === 'audio' && !failed && (
          <audio
            className="view-modal-audio"
            controls
            src={src}
            onError={() => setMediaError(true)}
          />
        )}
        {mode === 'video' && !failed && (
          <video
            className="view-modal-video"
            controls
            src={src}
            onError={() => setMediaError(true)}
          />
        )}
        {(mode === 'text' || mode === 'docx') && !failed && (
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
        {mode === 'xlsx' && !failed && (
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
      {statusNode}
      {mode === 'pdf' && pdfData && !encrypted && pdfStatus !== 'error' && (
        <canvas
          ref={canvasRef}
          className={
            'drawer-preview-canvas' +
            (pdfStatus !== 'ok' ? ' drawer-preview-canvas--hidden' : '')
          }
          aria-hidden={pdfStatus !== 'ok'}
        />
      )}
      {showContent && mode === 'image' && (
        <img
          src={src}
          className="drawer-preview-img"
          alt={doc.filename}
          style={imageLoading ? { display: 'none' } : undefined}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false)
            setMediaError(true)
          }}
        />
      )}
      {showContent && mode === 'audio' && (
        <audio
          className="drawer-preview-audio"
          controls
          src={src}
          onError={() => setMediaError(true)}
        />
      )}
      {showContent && mode === 'video' && (
        <video
          className="drawer-preview-video"
          controls
          src={src}
          onError={() => setMediaError(true)}
        />
      )}
      {showContent && (mode === 'text' || mode === 'docx') && (
        <pre className="drawer-preview-text">{textContent}</pre>
      )}
      {showContent && mode === 'ics' && ics && (
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
      {showContent && mode === 'eml' && eml && (
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
      {showContent && mode === 'xlsx' && (
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
