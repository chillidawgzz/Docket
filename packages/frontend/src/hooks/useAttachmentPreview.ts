import { useEffect, useState } from 'react'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import type { Document } from '../api/types'
import { fetchPreview } from '../api/client'
import {
  parseEml,
  parseIcs,
  type EmlSummary,
  type IcsEvent,
} from '../lib/parseAttachments'
import { detectPreviewKind, type PreviewKind } from '../lib/previewKind'

export type AttachmentMode =
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

export type AttachmentPreviewState = {
  mode: AttachmentMode
  message: string
  objectUrl: string | null
  pdfData: ArrayBuffer | null
  textContent: string
  ics: IcsEvent | null
  eml: EmlSummary | null
  sheetRows: string[][]
}

const empty: AttachmentPreviewState = {
  mode: 'loading',
  message: 'Loading…',
  objectUrl: null,
  pdfData: null,
  textContent: '',
  ics: null,
  eml: null,
  sheetRows: [],
}

export function useAttachmentPreview(
  doc: Document | null,
  options?: {
    maxSheetRows?: number
    maxTextChars?: number
    /** Fetch PDF bytes for first-page canvas (drawer). Modal uses iframe URL. */
    needPdfBytes?: boolean
  },
): AttachmentPreviewState {
  const maxSheetRows = options?.maxSheetRows ?? 500
  const maxTextChars = options?.maxTextChars ?? 500_000
  const needPdfBytes = options?.needPdfBytes ?? false
  const [state, setState] = useState<AttachmentPreviewState>(empty)

  useEffect(() => {
    if (!doc) {
      setState(empty)
      return
    }

    let cancelled = false
    setState({ ...empty, mode: 'loading', message: 'Loading…' })

    // Fast path: browser can load these via the preview URL directly
    const nameKind = detectPreviewKind(
      'application/octet-stream',
      doc.filename,
    )
    if (
      nameKind === 'image' ||
      nameKind === 'audio' ||
      nameKind === 'video'
    ) {
      setState({ ...empty, mode: nameKind })
      return
    }
    if (nameKind === 'pdf' && !needPdfBytes) {
      setState({ ...empty, mode: 'pdf' })
      return
    }

    void (async () => {
      try {
        const result = await fetchPreview(doc.id)
        if (cancelled) return
        if (!result) {
          setState({
            ...empty,
            mode: 'none',
            message: 'No preview available',
          })
          return
        }

        const filename = result.filename || doc.filename
        const kind: PreviewKind = detectPreviewKind(
          result.contentType,
          filename,
        )

        if (kind === 'pdf') {
          if (!needPdfBytes) {
            setState({ ...empty, mode: 'pdf' })
            return
          }
          const buf = await result.blob.arrayBuffer()
          if (cancelled) return
          setState({
            ...empty,
            mode: 'pdf',
            pdfData: buf,
          })
          return
        }

        if (kind === 'image' || kind === 'audio' || kind === 'video') {
          setState({ ...empty, mode: kind })
          return
        }

        if (kind === 'text') {
          const text = await result.blob.text()
          if (cancelled) return
          setState({
            ...empty,
            mode: 'text',
            textContent:
              text.length > maxTextChars
                ? text.slice(0, maxTextChars) + '\n…'
                : text,
          })
          return
        }

        if (kind === 'ics') {
          const text = await result.blob.text()
          if (cancelled) return
          const event = parseIcs(text)
          if (!event) {
            setState({
              ...empty,
              mode: 'text',
              textContent: text.slice(0, 8000),
            })
            return
          }
          setState({ ...empty, mode: 'ics', ics: event })
          return
        }

        if (kind === 'eml') {
          const text = await result.blob.text()
          if (cancelled) return
          setState({ ...empty, mode: 'eml', eml: parseEml(text) })
          return
        }

        if (kind === 'docx') {
          const buf = await result.blob.arrayBuffer()
          if (cancelled) return
          const { value } = await mammoth.extractRawText({ arrayBuffer: buf })
          if (cancelled) return
          setState({
            ...empty,
            mode: 'docx',
            textContent: value.trim() || '(empty document)',
          })
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
          setState({
            ...empty,
            mode: 'xlsx',
            sheetRows: rows.slice(0, maxSheetRows),
          })
          return
        }

        setState({
          ...empty,
          mode: 'none',
          message: 'No preview available',
        })
      } catch {
        if (!cancelled) {
          setState({
            ...empty,
            mode: 'error',
            message: 'Preview unavailable',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [doc, maxSheetRows, maxTextChars, needPdfBytes])

  return state
}
