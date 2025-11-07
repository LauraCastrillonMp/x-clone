import React, { useState, useMemo, useRef, useEffect } from 'react'
import { postTweet, uploadToCloudinary } from '../services/api'

const MAX_TWEET_CHARS = 280
const MAX_IMAGES = 4

export default function Compose() {
  const [text, setText] = useState('')
  const remaining = useMemo(() => MAX_TWEET_CHARS - (text?.length || 0), [text])

  const [files, setFiles] = useState([]) // { file: File, preview: objectUrl }
  const inputRef = useRef(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      // cleanup previews on unmount
      files.forEach(f => { try { URL.revokeObjectURL(f.preview) } catch {} })
    }
  }, [files])

  const handleChange = (e) => {
    const value = e.target.value || ''
    setText(value.slice(0, MAX_TWEET_CHARS))
  }

  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || [])
    if (!list.length) return
    const added = list.slice(0, MAX_IMAGES).map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setFiles(prev => {
      const combined = [...prev, ...added].slice(0, MAX_IMAGES)
      return combined
    })
    // reset input so same file can be picked later
    if (inputRef.current) inputRef.current.value = null
  }

  const removeAt = (idx) => {
    setFiles(prev => {
      const copy = prev.slice()
      const [removed] = copy.splice(idx, 1)
      try { if (removed?.preview) URL.revokeObjectURL(removed.preview) } catch {}
      return copy
    })
  }

  const canPost = (text.trim().length > 0 || files.length > 0) && text.length <= MAX_TWEET_CHARS

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canPost || posting) return
    setPosting(true)
    setError('')
    try {
      const bodyText = String(text || '').trim()
      const media = []

      if (files.length) {
        // upload in parallel
        const promises = files.map(f => uploadToCloudinary(f.file, { folder: 'tweets' }))
        const results = await Promise.all(promises)
        for (const r of results) {
          const url = r?.secure_url || r?.url || (r?.public_id ? `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload/${r.public_id}` : null)
          if (url) media.push(url)
        }
      }

      await postTweet({ text: bodyText, media })
      setText('')
      // revoke previews
      files.forEach(f => { try { URL.revokeObjectURL(f.preview) } catch {} })
      setFiles([])
      if (inputRef.current) inputRef.current.value = null
    } catch (err) {
      console.error('Publish error', err)
      setError(err?.response?.data?.message || err?.message || 'Failed to post')
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

        <div style={{ marginTop: 8 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            aria-label="Attach images"
          />
        </div>

        {files.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {files.map((f, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img
                  src={f.preview}
                  alt={`preview-${i}`}
                  style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8 }}
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  style={{
                    position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)',
                    color: '#fff', border: 'none', borderRadius: 12, padding: '2px 6px', cursor: 'pointer'
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <small>{text.length}/{MAX_TWEET_CHARS} {remaining < 20 && <span style={{color: remaining < 0 ? 'red' : 'inherit'}}>({remaining} left)</span>}</small>
          <button className="button" type="submit" disabled={!canPost || posting}>{posting ? 'Posting…' : 'Post'}</button>
        </div>

        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </form>
    </>
  )
}