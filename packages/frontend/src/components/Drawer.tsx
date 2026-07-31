import { useEffect, useRef, useState } from 'react'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { Document } from '../api/types'
import { fetchPreview } from '../api/client'
import { formatFullDate, formatSize } from '../lib/format'
import { parseEml, parseIcs, type EmlSummary, type IcsEvent } from '../lib/parseAttachments'
import { detectPreviewKind, type PreviewKind } from '../lib/previewKind'
import { renderPdfFirstPage } from '../lib/pdfRender'

type Mode =
  | 'loading'
  | 'pdf'
  | 'image'
  | 'text'
  | 'audio'
  | 'video'
  | 'ics'
  | 'eml'
  | 'docx'
  | 'xlsx'
  | 'none'
  | 'password'
  | 'error'

interface DrawerProps {
  doc: Document | null
  onClose: () => void
}

export function Drawer({ doc, onClose }: DrawerProps) {
  const open = !!doc
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>('loading')
  const [message, setMessage] = useState('Loading…')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [textContent, setTextContent] = useState('')
  const [ics, setIcs] = useState<IcsEvent | null>(null)
  const [eml, setEml] = useState<EmlSummary | null>(null)
  const [sheetRows, setSheetRows] = useState<string[][]>([])

  useEffect(() => {
    if (!doc) {
      setMode('loading')
      setMessage('Loading…')
      setObjectUrl(null)
      setPdfData(null)
      setTextContent('')
      setIcs(null)
      setEml(null)
      setSheetRows([])
      return
    }

    let cancelled = false
    let url: string | null = null
    setMode('loading')
    setMessage('Loading…')
    setObjectUrl(null)
    setPdfData(null)
    setTextContent('')
    setIcs(null)
    setEml(null)
    setSheetRows([])

    void (async () => {
      try {
        const result = await fetchPreview(doc.id)
        if (cancelled) return
        if (!result) {
          setMode('none')
          setMessage('No preview available')
          return
        }

        const filename = result.filename || doc.filename
        const kind: PreviewKind = detectPreviewKind(
          result.contentType,
          filename,
        )

        if (kind === 'pdf') {
          const buf = await result.blob.arrayBuffer()
          if (cancelled) return
          setPdfData(buf)
          setMode('pdf')
          return
        }

        if (kind === 'image') {
          // Ensure browser-friendly MIME (some mailers send image/jpg)
          const type =
            result.contentType === 'image/jpg' ||
            result.contentType === 'image/pjpeg' ||
            result.contentType === 'image/x-jpeg' ||
            /\.jpe?g$/i.test(filename)
              ? 'image/jpeg'
              : result.contentType.startsWith('image/')
                ? result.contentType.split(';')[0].trim()
                : 'image/jpeg'
          const imageBlob =
            result.blob.type === type
              ? result.blob
              : new Blob([await result.blob.arrayBuffer()], { type })
          if (cancelled) return
          url = URL.createObjectURL(imageBlob)
          setObjectUrl(url)
          setMode('image')
          return
        }

        if (kind === 'audio' || kind === 'video') {
          url = URL.createObjectURL(result.blob)
          setObjectUrl(url)
          setMode(kind)
          return
        }

        if (kind === 'text') {
          const text = await result.blob.text()
          if (cancelled) return
          setTextContent(
            text.length > 100_000
              ? text.slice(0, 100_000) + '\n…'
              : text,
          )
          setMode('text')
          return
        }

        if (kind === 'ics') {
          const text = await result.blob.text()
          if (cancelled) return
          const event = parseIcs(text)
          if (!event) {
            setTextContent(text.slice(0, 8000))
            setMode('text')
            return
          }
          setIcs(event)
          setMode('ics')
          return
        }

        if (kind === 'eml') {
          const text = await result.blob.text()
          if (cancelled) return
          setEml(parseEml(text))
          setMode('eml')
          return
        }

        if (kind === 'docx') {
          const buf = await result.blob.arrayBuffer()
          if (cancelled) return
          const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
          if (cancelled) return
          setTextContent(value.trim() || '(empty document)')
          setMode('docx')
          return
        }

        if (kind === 'xlsx') {
          const buf = await result.blob.arrayBuffer()
          if (cancelled) return
          const wb = XLSX.read(buf, { type: 'array' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: '',
          }) as string[][]
          if (cancelled) return
          setSheetRows(rows.slice(0, 100))
          setMode('xlsx')
          return
        }

        setMode('none')
        setMessage('No preview available')
      } catch {
        if (!cancelled) {
          setMode('error')
          setMessage('Preview unavailable')
        }
      }
    })()

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc])

  useEffect(() => {
    if (mode !== 'pdf' || !pdfData || !canvasRef.current) return
    let cancelled = false
    void (async () => {
      const status = await renderPdfFirstPage(pdfData, canvasRef.current!)
      if (cancelled) return
      if (status === 'password') {
        setMode('password')
        setMessage('🔒 Password protected')
      } else if (status === 'error') {
        setMode('error')
        setMessage('Load error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, pdfData])

  const showMessage =
    mode === 'loading' ||
    mode === 'none' ||
    mode === 'password' ||
    mode === 'error'

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
              <div
                className={
                  'drawer-preview-box' +
                  (mode === 'text' ||
                  mode === 'docx' ||
                  mode === 'xlsx' ||
                  mode === 'ics' ||
                  mode === 'eml'
                    ? ' drawer-preview-box--tall'
                    : '')
                }
              >
                {showMessage && message}
                {mode === 'pdf' && (
                  <canvas
                    ref={canvasRef}
                    className="drawer-preview-canvas"
                  />
                )}
                {mode === 'image' && objectUrl && (
                  <img
                    src={objectUrl}
                    className="drawer-preview-img"
                    alt={doc.filename}
                  />
                )}
                {mode === 'audio' && objectUrl && (
                  <audio
                    className="drawer-preview-audio"
                    controls
                    src={objectUrl}
                  />
                )}
                {mode === 'video' && objectUrl && (
                  <video
                    className="drawer-preview-video"
                    controls
                    src={objectUrl}
                  />
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
          </div>
        )}
      </div>
    </>
  )
}
