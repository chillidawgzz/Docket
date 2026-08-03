/** Expand {yyyy} / {mm} / {dd} using the document date. */
export function expandFilenameTemplate(
  template: string,
  date: Date,
  originalFilename: string,
): string {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  let name = template
    .replace(/\{yyyy\}/gi, yyyy)
    .replace(/\{mm\}/gi, mm)
    .replace(/\{dd\}/gi, dd)
    .trim()

  if (!name) return originalFilename

  const origExt = originalFilename.match(/(\.[a-z0-9]+)$/i)?.[1] || ''
  if (origExt && !/\.[a-z0-9]+$/i.test(name)) {
    name += origExt
  }
  return name
}

/** Ensure names are unique within a batch by appending " (2)", " (3)", … */
export function uniquifyFilenames(
  items: { id: string; filename: string }[],
): { id: string; filename: string }[] {
  const used = new Map<string, number>()
  return items.map((item) => {
    const key = item.filename.toLowerCase()
    const n = used.get(key) || 0
    used.set(key, n + 1)
    if (n === 0) return item
    const m = item.filename.match(/^(.*?)(\.[a-z0-9]+)?$/i)
    const base = m?.[1] ?? item.filename
    const ext = m?.[2] ?? ''
    return { id: item.id, filename: `${base} (${n + 1})${ext}` }
  })
}
