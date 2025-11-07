import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { UserApi } from '../services/api'
import Loader from '../components/Loader'
import Empty from '../components/Empty'
import ErrorMessage from '../components/ErrorMessage'
import UserRow from '../components/UserRow'

export default function Following() {
  const qs = new URLSearchParams(useLocation().search)
  const username = (qs.get('username') || '').toLowerCase()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!username) { setError('Username required'); setLoading(false); return }
      try {
        const res = await UserApi.following(username, { limit: 50 })
        const d = res?.data || {}
        const list =
          (Array.isArray(d.items) && d.items) ||
          (Array.isArray(d.users) && d.users) ||
          (Array.isArray(d.results) && d.results) ||
          (Array.isArray(d.data) && d.data) || []
        if (mounted) setItems(list)
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e?.message || 'Failed to load following')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [username])

  if (loading) return <Loader />
  if (error) return <ErrorMessage error={error} />
  return items.length === 0 ? <Empty>Not following anyone.</Empty> : (
    <div>
      <h2>Following</h2>
      {items.map(u => <UserRow key={u.id || u._id || u.username || u.handle} user={u} />)}
    </div>
  )
}