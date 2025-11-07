import React, { useEffect, useState } from 'react'
import { TweetsApi } from '../services/api'
import TweetCard from '../components/TweetCard'
import { parseListResponse } from '../utils/normalize'

export default function Saved() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data } = await TweetsApi.saved?.()
        if (!mounted) return
        const { items } = parseListResponse(data)
        setItems(items)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (loading) return <div>Loading…</div>

  return (
    <div>
      <h2>Saved</h2>
      {items.length === 0 ? <div>No saved posts.</div> : items.map(t => (
        <TweetCard key={t.id || t._id} tweet={t} />
      ))}
    </div>
  )
}