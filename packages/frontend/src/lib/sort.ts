import type { Document } from '../api/types'
import { CATEGORIES } from './categories'

export type SortKey = 'filename' | 'sender' | 'category' | 'date' | 'size'
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
      case 'sender':
        cmp = a.sender.name.localeCompare(b.sender.name, undefined, {
          sensitivity: 'base',
        })
        break
      case 'category':
        cmp = CATEGORIES[a.category].label.localeCompare(
          CATEGORIES[b.category].label,
          undefined,
          { sensitivity: 'base' },
        )
        break
      case 'date':
        cmp = a.date.getTime() - b.date.getTime()
        break
      case 'size':
        cmp = a.size - b.size
        break
    }
    if (cmp === 0) {
      // Stable-ish tiebreak by id
      return a.id.localeCompare(b.id) * mult
    }
    return cmp * mult
  })
}
