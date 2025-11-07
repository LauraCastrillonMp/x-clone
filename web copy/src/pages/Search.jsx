import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchApi } from '../services/api'
import usePagination from '../hooks/usePagination'
import { parseListResponse } from '../utils/normalize'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import UserRow from '../components/UserRow'

export default function Search() {
  const [params, setParams] = useSearchParams()
  const initialQ = (params.get('q') || params.get('query') || '').trim()

  const [input, setInput] = useState(initialQ)
  const [q, setQ] = useState(initialQ)

  // Debounce input into q
  useEffect(() => {
    const h = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(h)
  }, [input])

  // Keep URL in sync
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q); else next.delete('q')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const loader = useCallback(async (cursor) => {
    if (!q) return { items: [], nextCursor: null }

    // Always search users / profiles
    const r = await SearchApi.searchUsers(q, cursor)
    const { items = [], nextCursor } = parseListResponse(r?.data || r)
    return { items, nextCursor }
  }, [q])

  const { items, loading, error, hasMore, loadMoreRef } = usePagination(loader, [q])

  const header = useMemo(() => (
    <div className="row" style={{ gap: 8, marginBottom: 12 }}>
      <input
        className="input"
        placeholder="Search people..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoFocus
      />
    </div>
  ), [input])

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Search</h2>
      {header}

      {!q && <Empty>Type to search people.</Empty>}
      {error && <ErrorMessage error={error} />}
      {loading && items.length === 0 && q && <Loader />}

      {q && items.length === 0 && !loading && !error && (
        <Empty>No results found.</Empty>
      )}

      {items.map((u, i) => (
        <UserRow key={String(u.id || u._id || u.uid || i)} user={u} />
      ))}

      {hasMore && <div ref={loadMoreRef} style={{ height: 1 }} />}
    </div>
  )
}