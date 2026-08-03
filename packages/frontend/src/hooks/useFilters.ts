import { useCallback, useState } from 'react'
import type { FilterState, TagMode } from '../lib/filters'

const initial: FilterState = {
  search: '',
  senderFilter: null,
  groupFilter: null,
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
      groupFilter: null,
      senderFilter: f.senderFilter === name ? null : name,
    }))
  }, [])

  const toggleGroup = useCallback((groupId: number) => {
    setFilters((f) => ({
      ...f,
      senderFilter: null,
      groupFilter: f.groupFilter === groupId ? null : groupId,
    }))
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
    !!filters.senderFilter ||
    filters.groupFilter != null ||
    filters.tagFilters.length > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.search

  return {
    filters,
    setSearch,
    toggleSender,
    toggleGroup,
    toggleTagFilter,
    setTagFilters,
    setTagMode,
    setDateFrom,
    setDateTo,
    clearFilters,
    anyFilter,
  }
}
