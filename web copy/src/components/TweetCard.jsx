// filepath: d:\dev\x-clone\web copy\src\components\TweetCard.jsx
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from './Avatar'
import LikeButton from './LikeButton'
import { getMediaUrl } from '../services/api' // added to resolve media URLs

function formatCount(n) {
  const v = Number(n || 0)
  if (v < 1000) return String(v)
  if (v < 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  if (v < 1_000_000) return Math.round(v / 100) / 10 + 'k'
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
}

// publication date + hour formatter (DD/MM/YY · HH:MM)
function formatDateTime(d) {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${dd}/${mm}/${yy} · ${timeStr}`
}

export default function TweetCard({ tweet, onChanged }) {
  const navigate = useNavigate()
  if (!tweet) return null

  const id = tweet._id || tweet.id
  const author = tweet?.author || {}
  const username = (author.username || author.handle || '').toLowerCase()

  // determine publication date from common fields
  const rawDate = tweet.createdAt || tweet.date || tweet.publishedAt || tweet.created_at || tweet.published_at
  const publishedDate = rawDate ? new Date(rawDate) : null
  const published = publishedDate ? formatDateTime(publishedDate) : ''

  const openDetail = (e) => {
    e?.stopPropagation?.();
    if (!id) return;
    navigate(`/tweet/${id}`); // page route
  }
  const openReply = (e) => {
    e?.stopPropagation?.()
    if (!id) return
    navigate(`/tweets/${id}#reply`) // go to detail, not API
  }

  const comments = tweet?.commentsCount ?? 0;

  // support different shapes for media (strings, objects with public_id/url)
  const rawMedia = Array.isArray(tweet.media) ? tweet.media : (tweet.images || tweet.media || [])
  const mediaItems = (Array.isArray(rawMedia) ? rawMedia : []).slice(0, 4)
  const mediaUrls = mediaItems.map(m => getMediaUrl(m) || (typeof m === 'string' ? m : null)).filter(Boolean)

  return (
    <div className="tweet-card">
      <div className="tweet">
        <div className="tweet-avatar">
          <Avatar src={author.avatarUrl || author.photoURL} alt={author.fullName || username || 'User'} />
        </div>

        <div className="tweet-header">
          <div className="tweet-author">
            <strong>{author.fullName || username || 'User'}</strong>
            <span
              className="muted"
              title={publishedDate ? publishedDate.toLocaleString() : undefined}
            >
              @{username}{published ? ` · ${published}` : ''}
            </span>
          </div>
        </div>

        {/* Only content opens detail */}
        <div className="tweet-content" onClick={openDetail} role="button" tabIndex={0}
             onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDetail(e)}>
          <div
            className="tweet-text"
            style={{
              whiteSpace: 'pre-wrap',       // preserve line breaks and wrap
              wordBreak: 'break-word',      // break long words
              overflowWrap: 'anywhere',     // allow breaks anywhere if needed
              hyphens: 'auto',              // enable hyphenation when available
              maxWidth: '100%',
            }}
          >
            {tweet.text}
          </div>

          {mediaUrls.length > 0 && (
            <div
              className="tweet-media"
              style={{
                display: 'grid',
                gap: 8,
                marginTop: 8,
                gridTemplateColumns: mediaUrls.length === 1 ? '1fr' : '1fr 1fr'
              }}
            >
              {mediaUrls.map((u, i) => (
                <img
                  key={i}
                  src={u}
                  alt={`tweet-media-${i}`}
                  style={{
                    // fixed dimensions: single image larger, multiple images square
                    width: mediaUrls.length === 1 ? 480 : 160,
                    height: mediaUrls.length === 1 ? 300 : 160,
                    objectFit: 'cover',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'block'
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="tweet-actions">
          <LikeButton tweet={tweet} onChange={(p) => onChanged?.({ ...tweet, ...p })} />
          <button
            type="button"
            className="comment-btn"
            onClick={openReply}
            aria-label="Comments"
            title="Comments"
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 4H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3.8l3.6 3.2c.7.6 1.8.1 1.8-.8V17H20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="count">{formatCount(comments)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}