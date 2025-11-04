// filepath: d:\dev\orbyt\web\src\pages\Home.jsx
import React, { useCallback } from 'react'
import { TweetsApi } from '../services/api'
import TweetCard from '../components/TweetCard'
import usePagination from '../hooks/usePagination'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import { parseListResponse } from '../utils/normalize'

export default function Home() {
  const loader = useCallback(async (cursor) => {
    const params = cursor ? { cursor } : undefined
    const { data } = await TweetsApi.list(params)
    const { items, nextCursor } = parseListResponse(data)
    // Only top-level tweets (exclude replies/comments)
    const topLevel = (items || []).filter(t =>
      !(t.parentId || t.parent || t.replyTo || t.inReplyToId || t.isReply)
    )
    return { items: topLevel, nextCursor }
  }, [])

  const { items, loading, error, hasMore, loadMoreRef } = usePagination(loader, [])

  if (loading && items.length === 0) return <Loader />
  if (error) return <ErrorMessage error={error} />
  if (!loading && items.length === 0) return <Empty>No posts yet.</Empty>

  return (
    <div>
      <h2>Home</h2>
      {items.map((t, i) => {
        const k = t.id || t._id || `${t.createdAt || t.date || ''}-${i}`
        return <TweetCard key={String(k)} tweet={t} />
      })}
      {hasMore && <div ref={loadMoreRef} style={{ height: 1 }} />}
    </div>
  )
}