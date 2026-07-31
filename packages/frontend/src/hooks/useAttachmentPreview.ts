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
  options?: { maxSheetRows?: number; maxTextChars?: number },
): AttachmentPreviewState {
  const maxSheetRows = options?.maxSheetRows ?? 500
  const maxTextChars = options?.maxTextChars ?? 500_000
  const [state, setState] = useState<AttachmentPreviewState>(empty)

  useEffect(() => {
    if (!doc) {
      setState(empty)
      return
    }

    let cancelled = false
    let url: string | null = null
    setState({ ...empty, mode: 'loading', message: 'Loading…' })

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
          const buf = await result.blob.arrayBuffer()
          if (cancelled) return
          const pdfBlob = new Blob([buf], { type: 'application/pdf' })
          url = URL.createObjectURL(pdfBlob)
          setState({
            ...empty,
            mode: 'pdf',
            objectUrl: url,
            pdfData: buf,
          })
          return
        }

        if (kind === 'image') {
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
          setState({ ...empty, mode: 'image', objectUrl: url })
          return
        }

        if (kind === 'audio' || kind === 'video') {
          url = URL.createObjectURL(result.blob)
          setState({ ...empty, mode: kind, objectUrl: url })
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
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc, maxSheetRows, maxTextChars])

  return state
}
