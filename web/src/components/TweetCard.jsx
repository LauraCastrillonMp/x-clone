// filepath: d:\dev\orbyt\web\src\components\TweetCard.jsx
import React from 'react'
import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import LikeButton from './LikeButton'
import { timeAgo } from '../utils/time'

export default function TweetCard({ tweet }) {
  if (!tweet) return null

  const id = tweet.id || tweet._id
  const author = tweet.author || tweet.user || tweet.owner || {}
  const authorId = author.id || author._id
  const username = (author.username || author.handle || '').toLowerCase()
  const name = author.name || author.displayName || username || 'User'
  const avatar = author.avatar || author.avatarUrl || author.photoURL || ''
  const createdAt = tweet.createdAt || tweet.date || tweet.created_at || tweet.timestamp

  const liked = tweet.liked ?? tweet.likedByMe ?? tweet.isLiked ?? tweet.likedByCurrentUser ?? false
  const likeCount = tweet.likesCount ?? tweet.likeCount ?? tweet.likes_count ?? (Array.isArray(tweet.likes) ? tweet.likes.length : 0)
  const replyCount = tweet.repliesCount ?? tweet.commentsCount ?? tweet.reply_count ?? 0

  function onLikeChange(next) {
    tweet.liked = next
    const base = tweet.likesCount ?? tweet.likeCount ?? 0
    const n = Math.max(0, Number(base) + (next ? 1 : -1))
    tweet.likesCount = n
    tweet.likeCount = n
  }

  return (
    <div className="tweet">
      <div className="tweet-avatar">
        <Avatar size={48} src={avatar} alt={username || 'avatar'} />
      </div>

      <div className="tweet-body">
        <div className="tweet-header">
          <div className="tweet-author">
            <Link to={`/u/${encodeURIComponent(username)}${authorId ? `?id=${encodeURIComponent(authorId)}` : ''}`} className="tweet-username">
              {name}
            </Link>
            <span className="muted">@{username}</span>
            <span className="muted">·</span>
            <span className="muted">{createdAt ? timeAgo(createdAt) : ''}</span>
          </div>
          <span className="tweet-id muted">#{String(id || '').slice(-6)}</span>
        </div>

        <div className="tweet-text">
          {tweet.text || tweet.content || ''}
        </div>

        <div className="tweet-actions">
          <LikeButton
            tweetId={id}
            initiallyLiked={liked}
            initialCount={likeCount}
            size="small"
            onChange={onLikeChange}
          />
          <Link to={`/tweet/${encodeURIComponent(id)}#reply`} className="button icon small" aria-label="Open comments">
            💬 {replyCount > 0 ? replyCount : ''}
          </Link>
        </div>
      </div>
    </div>
  )
}