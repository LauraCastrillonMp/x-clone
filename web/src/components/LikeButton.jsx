import React, { useEffect, useState } from 'react'
import { TweetsApi } from '../services/api'

export default function LikeButton({ tweetId, initiallyLiked = false, initialCount = 0, size = 'default', onChange }) {
  const [liked, setLiked] = useState(Boolean(initiallyLiked))
  const [count, setCount] = useState(Number(initialCount) || 0)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setLiked(Boolean(initiallyLiked)) }, [initiallyLiked])
  useEffect(() => { setCount(Number(initialCount) || 0) }, [initialCount])

  async function toggle() {
    if (loading) return
    setLoading(true)
    const next = !liked
    // optimistic
    setLiked(next)
    setCount(c => Math.max(0, c + (next ? 1 : -1)))
    try {
      const r = await TweetsApi.toggleLike?.(tweetId)
      const d = r?.data || r || {}
      const likedVal =
        (typeof d.liked === 'boolean') ? d.liked
        : (typeof d.likedByCurrentUser === 'boolean') ? d.likedByCurrentUser
        : (typeof d.isLiked === 'boolean') ? d.isLiked
        : next
      const countVal =
        Number.isFinite(d.likesCount) ? d.likesCount
        : Number.isFinite(d.likeCount) ? d.likeCount
        : (Array.isArray(d.likes) ? d.likes.length : null)

      setLiked(likedVal)
      if (Number.isFinite(countVal)) setCount(countVal)
      onChange?.(likedVal)
    } catch (e) {
      // rollback
      setLiked(!next)
      setCount(c => Math.max(0, c + (next ? -1 : 1)))
      // eslint-disable-next-line no-console
      console.error('Like toggle failed:', e?.response?.status, e?.response?.data || e?.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className={`button icon ${liked ? 'primary' : ''} ${size === 'small' ? 'small' : ''}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      title={liked ? 'Unlike' : 'Like'}
    >
      {liked ? '♥' : '♡'} {count > 0 ? count : ''}
    </button>
  )
}