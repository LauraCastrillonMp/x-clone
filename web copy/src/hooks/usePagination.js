import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export default function usePagination(loader, deps = []) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)

  // Track seen keys to avoid duplicates across pages
  const seenRef = useRef(new Set())
  const keyOf = useCallback((it) => (it?.id || it?._id || it?.uuid || it?.slug || ''), [])

  const reset = useCallback(() => {
    setItems([])
    setCursor(null)
    setHasMore(true)
    setError(null)
    seenRef.current = new Set()
  }, [])

  const load = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError(null)
    try {
      const { items: newItems, nextCursor } = await loader(cursor)
      const toAdd = []
      for (const it of newItems || []) {
        const k = keyOf(it)
        if (!k) { toAdd.push(it); continue }
        if (!seenRef.current.has(k)) {
          seenRef.current.add(k)
          toAdd.push(it)
        }
      }
      setItems((prev) => prev.concat(toAdd))
      setCursor(nextCursor || null)
      setHasMore(Boolean(nextCursor))
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [loader, cursor, loading, hasMore, keyOf])

  const memoDeps = useMemo(() => deps, deps) // eslint-disable-line
  useEffect(() => { reset() }, memoDeps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (items.length === 0 && hasMore && !loading) load()
  }, [items.length, hasMore, loading, load])

  const sentinelRef = useRef(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) load() })
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [load])

  return { items, loading, error, hasMore, loadMoreRef: sentinelRef, reset, load }
}