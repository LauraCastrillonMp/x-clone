import React, { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'

function formatCount(n) {
  const v = Number(n || 0)
  if (v < 1000) return String(v)
  if (v < 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  if (v < 1_000_000) return Math.round(v / 100) / 10 + 'k'
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
}

export default function LikeButton({ tweet, tweetId, liked: likedProp, likesCount: likesCountProp, onChange }) {
  const id = tweet?._id ?? tweetId
  const initialLiked = Boolean((tweet && (tweet.liked ?? tweet.likedByCurrentUser)) ?? likedProp)
  const initialCount = Number((tweet && tweet.likesCount) ?? likesCountProp ?? 0)

  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [pop, setPop] = useState(false)
  const prevLikedRef = useRef(initialLiked)

  useEffect(() => {
    const nextLiked = Boolean((tweet && (tweet.liked ?? tweet.likedByCurrentUser)) ?? likedProp)
    const nextCount = Number((tweet && tweet.likesCount) ?? likesCountProp ?? 0)
    setLiked(nextLiked)
    setCount(nextCount)
  }, [tweet?.liked, tweet?.likedByCurrentUser, tweet?.likesCount, likedProp, likesCountProp])

  useEffect(() => {
    if (liked && !prevLikedRef.current) {
      setPop(true)
      const t = setTimeout(() => setPop(false), 250)
      return () => clearTimeout(t)
    }
    prevLikedRef.current = liked
  }, [liked])

  const handleToggle = useCallback(async (e) => {
    e?.preventDefault?.()
    if (!id || pending) return
    setPending(true)
    const prevLiked = liked
    const prevCount = count
    const nextLiked = !liked
    setLiked(nextLiked)
    setCount(p => Math.max(0, p + (nextLiked ? 1 : -1)))
    try {
      const resp = await api.post('/likes/toggle', { tweetId: id })
      const data = resp?.data ?? resp
      if (typeof data?.liked === 'boolean') setLiked(data.liked)
      if (typeof data?.likesCount === 'number') setCount(Math.max(0, data.likesCount))
      onChange?.({ liked: data?.liked ?? nextLiked, likesCount: data?.likesCount ?? prevCount, _id: id })
    } catch {
      setLiked(prevLiked)
      setCount(prevCount)
    } finally {
      setPending(false)
    }
  }, [id, pending, liked, count, onChange])

  if (!id) return null

  const cls = ['like-btn', liked ? 'liked' : '', pending ? 'pending' : '', pop ? 'pop' : ''].filter(Boolean).join(' ')

  return (
    <button type="button" className={cls} disabled={pending} onClick={handleToggle}
            aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'} title={liked ? 'Unlike' : 'Like'}>
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
        {liked
          ? <path d="M12 21s-6.716-4.35-9.243-7.243C.99 11.85 1 8.5 3.757 6.343 5.5 4.9 7.9 5.1 9.5 6.7L12 9.2l2.5-2.5c1.6-1.6 4-1.8 5.743-.357C23 8.5 23.01 11.85 21.243 13.757 18.716 16.65 12 21 12 21z" />
          : <path d="M16.5 3.9c-1.54 0-3.04.74-4 1.92A5.06 5.06 0 0 0 8.5 3.9C5.46 3.9 3 6.36 3 9.4c0 3.64 3.4 6.59 8.55 11.02l.45.39.45-.39C17.6 16 21 13.05 21 9.4c0-3.04-2.46-5.5-5.5-5.5z" fill="none" stroke="currentColor" strokeWidth="2" />
        }
      </svg>
      <span className="count">{formatCount(count)}</span>
      {pending ? <span className="dot" aria-hidden="true" /> : null}
    </button>
  )
}