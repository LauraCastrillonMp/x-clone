import React, { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { UserApi } from '../services/api'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import UserRow from '../components/UserRow'
import { parseListResponse } from '../utils/normalize'

export default function Following() {
  const qs = new URLSearchParams(useLocation().search)
  const username = (qs.get('username') || '').toLowerCase()
  const PAGE_LIMIT = 10

  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)

  const loadPage = useCallback(async (p = 1) => {
    if (!username) {
      setError('Username required')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await UserApi.following(username, { page: p, limit: PAGE_LIMIT })
      const { items: rows = [], nextCursor } = parseListResponse(data)
      setItems(prev => (p === 1 ? rows : [...prev, ...rows]))
      setHasMore(nextCursor ? true : (rows.length >= PAGE_LIMIT))
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load following')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    setPage(1)
    setItems([])
    setHasMore(true)
    setError('')
    if (!username) {
      setLoading(false)
      return
    }
    loadPage(1)
  }, [username, loadPage])

  const handleLoadMore = async () => {
    if (loading || !hasMore) return
    const next = page + 1
    await loadPage(next)
    setPage(next)
  }

  if (loading && items.length === 0) return <Loader />
  if (error) return <ErrorMessage error={error} />
  if (!username) return <Empty>Username required.</Empty>
  if (!loading && items.length === 0) return <Empty>Not following anyone.</Empty>

  return (
    <div>
      <h2>Following</h2>
      {items.map(u => <UserRow key={u.id || u._id || u.username || u.handle} user={u} />)}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        {hasMore ? (
          <button onClick={handleLoadMore} className="button" disabled={loading}>
            {loading ? 'Loading…' : 'See more'}
          </button>
        ) : (
          <div style={{ color: '#666', padding: '8px 0' }}>No more</div>
        )}
      </div>
    </div>
  )
}