import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTags } from '../api/client'
import type { Document } from '../api/types'
import { byTag } from '../lib/filters'

export function useTags(docs: Document[]) {
  const [apiTags, setApiTags] = useState<string[]>([])

  const reloadTags = useCallback(async () => {
    try {
      const tags = await fetchTags()
      setApiTags(tags.map((t) => t.name))
    } catch {
      setApiTags([])
    }
  }, [])

  useEffect(() => {
    void reloadTags()
  }, [reloadTags])

  const tagNames = useMemo(() => {
    const fromDocs = byTag(docs).map((t) => t.name)
    const merged = new Set<string>()
    for (const name of [...apiTags, ...fromDocs]) {
      merged.add(name)
    }
    return [...merged].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )
  }, [apiTags, docs])

  return { tagNames, reloadTags }
}
