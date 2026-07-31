import type { Document } from '../api/types'

export type SortKey =
  | 'filename'
  | 'downloadFilename'
  | 'sender'
  | 'tags'
  | 'date'
  | 'size'
export type SortDir = 'asc' | 'desc'

export function sortDocs(
  docs: Document[],
  key: SortKey,
  dir: SortDir,
): Document[] {
  const mult = dir === 'asc' ? 1 : -1
  return [...docs].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'filename':
        cmp = a.filename.localeCompare(b.filename, undefined, {
          sensitivity: 'base',
        })
        break
      case 'downloadFilename':
        cmp = (a.downloadFilename || '').localeCompare(
          b.downloadFilename || '',
          undefined,
          { sensitivity: 'base' },
        )
        break
      case 'sender':
        cmp = a.sender.name.localeCompare(b.sender.name, undefined, {
          sensitivity: 'base',
        })
        break
      case 'tags':
        cmp = a.tags.join(',').localeCompare(b.tags.join(','), undefined, {
          sensitivity: 'base',
        })
        break
      case 'date':
        cmp = a.date.getTime() - b.date.getTime()
        break
      case 'size':
        cmp = a.size - b.size
        break
    }
    if (cmp === 0) return a.id.localeCompare(b.id) * mult
    return cmp * mult
  })
}
