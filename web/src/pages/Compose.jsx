import React, { useState, useMemo } from 'react'
import { TweetsApi } from '../services/api'

const MAX_TWEET_CHARS = 280

export default function Compose() {
  const [text, setText] = useState('')
  const remaining = useMemo(() => MAX_TWEET_CHARS - (text?.length || 0), [text])

  const handleChange = (e) => {
    const value = e.target.value || ''
    setText(value.slice(0, MAX_TWEET_CHARS))
  }

  const canPost = text.trim().length > 0 && text.length <= MAX_TWEET_CHARS
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canPost) return
    setPosting(true)
    setError('')
    try {
      await TweetsApi.create({ text })
      setText('')
    } catch (e) {
      setError(e?.message || 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <>
      <h2>Compose</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="input"
          rows={4}
          value={text}
          onChange={handleChange}
          maxLength={MAX_TWEET_CHARS}
          placeholder="What’s happening?"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <small>{text.length}/{MAX_TWEET_CHARS}</small>
          <button className="button" type="submit" disabled={!canPost}>{posting ? 'Posting…' : 'Post'}</button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
    </>
  )
}