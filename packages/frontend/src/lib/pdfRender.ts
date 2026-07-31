import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export async function renderPdfFirstPage(
  data: ArrayBuffer,
  canvas: HTMLCanvasElement,
): Promise<'ok' | 'password' | 'error'> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdfDoc = await loadingTask.promise
    const page = await pdfDoc.getPage(1)
    const scale = 1.2
    const viewport = page.getViewport({ scale })
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'error'
    canvas.height = viewport.height
    canvas.width = viewport.width
    await page.render({ canvasContext: ctx, viewport }).promise
    return 'ok'
  } catch (err: unknown) {
    const name =
      err && typeof err === 'object' && 'name' in err
        ? String((err as { name: string }).name)
        : ''
    if (name === 'PasswordException') return 'password'
    return 'error'
  }
}
