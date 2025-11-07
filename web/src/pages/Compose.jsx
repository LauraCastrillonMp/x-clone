import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TweetsApi } from '../services/api'

export default function Compose() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const MAX_TWEET_CHARS = 280

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const clean = (text || '').trim()
    if (!clean) {
      setError('Text required')
      return
    }
    if (clean.length > MAX_TWEET_CHARS) {
      setError(`Tweet must be 1–${MAX_TWEET_CHARS} characters`)
      return
    }

    setLoading(true)
    try {
      // Only send text — media handling removed
      await TweetsApi.create({ text: clean })
      navigate('/')
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.message || err?.message || 'Failed to post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="compose-page">
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="What's happening?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_TWEET_CHARS}
          rows={5}
        />
        {error && <div className="error">{error}</div>}
        <div className="compose-actions">
          <div className="chars-left">{MAX_TWEET_CHARS - (text || '').length}</div>
          <button type="submit" disabled={loading}>
            {loading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}