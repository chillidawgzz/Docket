import type { CategoryKey, Document } from '../api/types'
import { CATEGORIES } from './categories'

export interface FilterState {
  search: string
  senderFilter: string | null
  categoryFilter: CategoryKey | null
  yearFilter: number | null
}

export function bySenderName(docs: Document[]) {
  const map: Record<
    string,
    { name: string; initials: string; count: number }
  > = {}
  for (const d of docs) {
    const key = d.sender.name
    if (!map[key]) {
      map[key] = {
        name: d.sender.name,
        initials: d.sender.initials,
        count: 0,
      }
    }
    map[key].count++
  }
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export function byCategory(docs: Document[]) {
  const map: Record<string, { key: CategoryKey; count: number }> = {}
  for (const d of docs) {
    if (!map[d.category]) map[d.category] = { key: d.category, count: 0 }
    map[d.category].count++
  }
  return (Object.keys(CATEGORIES) as CategoryKey[])
    .map((k) => map[k] ?? { key: k, count: 0 })
    .filter((c) => c.count > 0)
}

export function allYears(docs: Document[]): number[] {
  const set = new Set<number>()
  for (const d of docs) set.add(d.date.getFullYear())
  return Array.from(set).sort((a, b) => b - a)
}

export function filteredDocs(docs: Document[], state: FilterState): Document[] {
  const q = state.search.trim().toLowerCase()
  return docs.filter((d) => {
    if (state.senderFilter && d.sender.name !== state.senderFilter) return false
    if (state.categoryFilter && d.category !== state.categoryFilter) return false
    if (state.yearFilter && d.date.getFullYear() !== state.yearFilter)
      return false
    if (q) {
      const hay = (
        d.filename +
        ' ' +
        d.sender.name +
        ' ' +
        d.email.subject
      ).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
