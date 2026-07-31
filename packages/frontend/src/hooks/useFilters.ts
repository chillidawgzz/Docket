import { useCallback, useState } from 'react'
import type { CategoryKey } from '../api/types'
import type { FilterState } from '../lib/filters'

const initial: FilterState = {
  search: '',
  senderFilter: null,
  categoryFilter: null,
  yearFilter: null,
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>(initial)

  const setSearch = useCallback((search: string) => {
    setFilters((f) => ({ ...f, search }))
  }, [])

  const toggleSender = useCallback((name: string) => {
    setFilters((f) => ({
      ...f,
      senderFilter: f.senderFilter === name ? null : name,
    }))
  }, [])

  const toggleCategory = useCallback((key: CategoryKey) => {
    setFilters((f) => ({
      ...f,
      categoryFilter: f.categoryFilter === key ? null : key,
    }))
  }, [])

  const toggleYear = useCallback((year: number) => {
    setFilters((f) => ({
      ...f,
      yearFilter: f.yearFilter === year ? null : year,
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(initial)
  }, [])

  const anyFilter =
    !!filters.senderFilter ||
    !!filters.categoryFilter ||
    !!filters.yearFilter ||
    !!filters.search

  return {
    filters,
    setSearch,
    toggleSender,
    toggleCategory,
    toggleYear,
    clearFilters,
    anyFilter,
  }
}
