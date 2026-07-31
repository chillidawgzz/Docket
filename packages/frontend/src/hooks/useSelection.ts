import { useCallback, useState } from 'react'
import type { Document } from '../api/types'

export function useSelection() {
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((list: Document[]) => {
    setChecked((prev) => {
      const allChecked =
        list.length > 0 && list.every((d) => prev.has(d.id))
      const next = new Set(prev)
      if (allChecked) {
        for (const d of list) next.delete(d.id)
      } else {
        for (const d of list) next.add(d.id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setChecked(new Set())
  }, [])

  return { checked, toggle, selectAll, clear }
}
