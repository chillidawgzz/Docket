import { useCallback, useState } from 'react'
import type { FilterState, TagMode } from '../lib/filters'

const initial: FilterState = {
  search: '',
  senderFilters: [],
  tagFilters: [],
  tagMode: 'or',
  dateFrom: null,
  dateTo: null,
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(initial)

  const setSearch = useCallback((search: string) => {
    setFilters((f) => ({ ...f, search }))
  }, [])

  const toggleSender = useCallback((name: string) => {
    setFilters((f) => ({
      ...f,
      senderFilters: f.senderFilters.includes(name)
        ? f.senderFilters.filter((s) => s !== name)
        : [...f.senderFilters, name],
    }))
  }, [])

  /** Select every sender in the list, or deselect them all if already selected. */
  const toggleSenders = useCallback((names: string[]) => {
    if (!names.length) return
    setFilters((f) => {
      const allOn = names.every((n) => f.senderFilters.includes(n))
      const senderFilters = allOn
        ? f.senderFilters.filter((s) => !names.includes(s))
        : [...new Set([...f.senderFilters, ...names])]
      return { ...f, senderFilters }
    })
  }, [])

  const setTagFilters = useCallback((tagFilters: string[]) => {
    setFilters((f) => ({ ...f, tagFilters }))
  }, [])

  const toggleTagFilter = useCallback((tag: string) => {
    setFilters((f) => {
      const has = f.tagFilters.some(
        (t) => t.toLowerCase() === tag.toLowerCase(),
      )
      return {
        ...f,
        tagFilters: has
          ? f.tagFilters.filter((t) => t.toLowerCase() !== tag.toLowerCase())
          : [...f.tagFilters, tag],
      }
    })
  }, [])

  const setTagMode = useCallback((tagMode: TagMode) => {
    setFilters((f) => ({ ...f, tagMode }))
  }, [])

  const setDateFrom = useCallback((dateFrom: string | null) => {
    setFilters((f) => ({ ...f, dateFrom: dateFrom || null }))
  }, [])

  const setDateTo = useCallback((dateTo: string | null) => {
    setFilters((f) => ({ ...f, dateTo: dateTo || null }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(initial)
  }, [])

  const anyFilter =
    filters.senderFilters.length > 0 ||
    filters.tagFilters.length > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.search

  return {
    filters,
    setSearch,
    toggleSender,
    toggleSenders,
    toggleTagFilter,
    setTagFilters,
    setTagMode,
    setDateFrom,
    setDateTo,
    clearFilters,
    anyFilter,
  }
}
