// filepath: d:\dev\orbyt\web\src\pages\TweetDetail.jsx
import React, { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { TweetsApi } from '../services/api'
import TweetCard from '../components/TweetCard'
import Loader from '../components/Loader'
import ErrorMessage from '../components/ErrorMessage'
import Empty from '../components/Empty'

export default function TweetDetail() {
  const { id } = useParams()
  const location = useLocation()
  const [tweet, setTweet] = useState(null)
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  // focus reply input when navigated via #reply
  const inputRef = React.useRef(null)
  useEffect(() => {
    if (location.hash === '#reply') {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [location.hash])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const t = await TweetsApi.get(id)
        const data = t?.data?.tweet || t?.data || {}
        if (!mounted) return
        setTweet(data)

        const r = await TweetsApi.replies(id)
        const list = (r?.data?.items) || (r?.data?.results) || (r?.data?.data) || r?.data || []
        if (mounted) setReplies(Array.isArray(list) ? list : [])
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e?.message || 'Failed to load tweet')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  async function submitReply(e) {
    e?.preventDefault?.()
    if (!text.trim() || posting) return
    setPosting(true)
    try {
      const res = await TweetsApi.reply(id, text.trim())
      const newReply = res?.data?.tweet || res?.data || null
      if (newReply) setReplies(arr => [newReply, ...arr])
      setText('')
    } catch (e) {
      console.error('Reply failed:', e?.response?.status, e?.response?.data || e?.message)
      alert(e?.response?.data?.message || e?.message || 'Failed to reply')
    } finally {
      setPosting(false)
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorMessage error={error} />
  if (!tweet) return <Empty>Not found.</Empty>

  return (
    <div>
      <TweetCard tweet={tweet} />

      <form onSubmit={submitReply} className="card" style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a reply..."
          style={{ flex: 1 }}
        />
        <button className="button primary" type="submit" disabled={posting || !text.trim()}>
          {posting ? 'Sending…' : 'Reply'}
        </button>
      </form>

      <div style={{ marginTop: 8 }}>
        {replies.length === 0 ? <Empty>No replies yet.</Empty> : replies.map((r, i) => (
          <TweetCard key={r.id || r._id || i} tweet={r} />
        ))}
      </div>
    </div>
  )
}