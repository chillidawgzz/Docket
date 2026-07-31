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

  return { docs, loading, error, reload: load }
}
