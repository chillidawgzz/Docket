import type { Document } from '../api/types'

export type TagMode = 'and' | 'or'

export interface FilterState {
  search: string
  senderFilters: string[]
  tagFilters: string[]
  tagMode: TagMode
  dateFrom: string | null // YYYY-MM-DD
  dateTo: string | null
}

export interface SenderGroupInfo {
  id: number
  name: string
  collapsed: boolean
  hidden: boolean
  senders: string[]
}

export interface SenderGroupsState {
  groups: SenderGroupInfo[]
  hiddenSenders: string[]
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
  return Object.values(map).sort((a, b) => compareNames(a.name, b.name))
}

export function compareNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function byTag(docs: Document[]) {
  const map: Record<string, number> = {}
  for (const d of docs) {
    for (const tag of d.tags) {
      map[tag] = (map[tag] || 0) + 1
    }
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) =>
      compareNames(a.name, b.name),
    )
}

function dayStart(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00').getTime()
}

function dayEnd(isoDate: string): number {
  return new Date(isoDate + 'T23:59:59.999').getTime()
}

/** Senders excluded by individual hide or hidden group membership. */
export function effectiveHiddenSenders(
  groups: SenderGroupInfo[],
  hiddenSenders: string[],
): Set<string> {
  const set = new Set(hiddenSenders)
  for (const g of groups) {
    if (!g.hidden) continue
    for (const s of g.senders) set.add(s)
  }
  return set
}

export function filteredDocs(
  docs: Document[],
  state: FilterState,
  groups: SenderGroupInfo[] = [],
  hiddenSenders: string[] = [],
): Document[] {
  const q = state.search.trim().toLowerCase()
  const fromTs = state.dateFrom ? dayStart(state.dateFrom) : null
  const toTs = state.dateTo ? dayEnd(state.dateTo) : null
  const hidden = effectiveHiddenSenders(groups, hiddenSenders)

  const senders = state.senderFilters.length
    ? new Set(state.senderFilters)
    : null

  return docs.filter((d) => {
    if (hidden.has(d.sender.name)) return false

    if (senders && !senders.has(d.sender.name)) return false

    if (state.tagFilters.length) {
      const tags = d.tags.map((t) => t.toLowerCase())
      const selected = state.tagFilters.map((t) => t.toLowerCase())
      if (state.tagMode === 'and') {
        if (!selected.every((t) => tags.includes(t))) return false
      } else if (!selected.some((t) => tags.includes(t))) {
        return false
      }
    }

    const t = d.date.getTime()
    if (fromTs != null && t < fromTs) return false
    if (toTs != null && t > toTs) return false

    if (q) {
      const hay = (
        d.filename +
        ' ' +
        d.sender.name +
        ' ' +
        d.email.subject +
        ' ' +
        d.email.from +
        ' ' +
        (d.email.snippet || '') +
        ' ' +
        (d.email.full || '') +
        ' ' +
        d.tags.join(' ')
      ).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
