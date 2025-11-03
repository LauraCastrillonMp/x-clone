import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchApi } from '../services/api'
import usePagination from '../hooks/usePagination'
import { parseListResponse } from '../utils/normalize'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import TweetCard from '../components/TweetCard'
import UserRow from '../components/UserRow'

export default function Search() {
  const [params, setParams] = useSearchParams()
  const initialQ = (params.get('q') || params.get('query') || '').trim()
  const initialTab = (params.get('tab') || 'tweets').toLowerCase() === 'people' ? 'people' : 'tweets'

  const [input, setInput] = useState(initialQ)
  const [q, setQ] = useState(initialQ)
  const [tab, setTab] = useState(initialTab)

  // Debounce input into q
  useEffect(() => {
    const h = setTimeout(() => setQ(input.trim()), 300)
    return () => clearTimeout(h)
  }, [input])

  // Keep URL in sync
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (q) next.set('q', q); else next.delete('q')
    next.set('tab', tab)
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab])

  const loader = useCallback(async (cursor) => {
    if (!q) return { items: [], nextCursor: null }

    if (tab === 'tweets') {
      const r = await SearchApi.searchTweets(q, cursor)
      const { items = [], nextCursor } = parseListResponse(r?.data || r)
      // Show only top-level tweets (keep results clean)
      const topLevel = items.filter(t => !(t.parentId || t.parent || t.replyTo || t.inReplyToId || t.isReply))
      return { items: topLevel, nextCursor }
    } else {
      const r = await SearchApi.searchUsers(q, cursor)
      const { items = [], nextCursor } = parseListResponse(r?.data || r)
      return { items, nextCursor }
    }
  }, [q, tab])

  const { items, loading, error, hasMore, loadMoreRef } = usePagination(loader, [q, tab])

  const header = useMemo(() => (
    <div className="row" style={{ gap: 8, marginBottom: 12 }}>
      <input
        className="input"
        placeholder={`Search ${tab === 'tweets' ? 'tweets' : 'people'}...`}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoFocus
      />
      <div className="row" role="tablist" aria-label="Search type" style={{ gap: 6 }}>
        <button
          className={`button ${tab === 'tweets' ? 'primary' : ''}`}
          onClick={() => setTab('tweets')}
          role="tab"
          aria-selected={tab === 'tweets'}
        >
          Tweets
        </button>
        <button
          className={`button ${tab === 'people' ? 'primary' : ''}`}
          onClick={() => setTab('people')}
          role="tab"
          aria-selected={tab === 'people'}
        >
          People
        </button>
      </div>
    </div>
  ), [input, tab])

  return (
    <div className="container">
      <h2 style={{ marginTop: 0 }}>Search</h2>
      {header}

      {!q && <Empty>Type to search tweets or people.</Empty>}
      {error && <ErrorMessage error={error} />}
      {loading && items.length === 0 && q && <Loader />}

      {q && items.length === 0 && !loading && !error && (
        <Empty>No results found.</Empty>
      )}

      {tab === 'tweets' && items.map((t, i) => (
        <TweetCard key={String(t.id || t._id || t.uid || i)} tweet={t} />
      ))}

      {tab === 'people' && items.map((u, i) => (
        <UserRow key={String(u.id || u._id || u.uid || i)} user={u} />
      ))}

      {hasMore && <div ref={loadMoreRef} style={{ height: 1 }} />}
    </div>
  )
}