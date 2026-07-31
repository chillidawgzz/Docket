import { useCallback, useEffect, useState } from 'react'
import { fetchDocuments } from '../api/client'
import type { Document } from '../api/types'

export function useDocuments() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchDocuments()
      setDocs(data)
    } catch {
      setError(true)
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const upsertDoc = useCallback((doc: Document) => {
    setDocs((prev) => {
      const idx = prev.findIndex((d) => d.id === doc.id)
      if (idx < 0) return [doc, ...prev]
      const next = [...prev]
      next[idx] = doc
      return next
    })
  }, [])

  return { docs, loading, error, reload: load, upsertDoc }
}
