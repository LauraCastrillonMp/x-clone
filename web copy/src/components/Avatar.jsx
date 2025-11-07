import React from 'react'

export default function Avatar({ src, alt, size = 36, rounded = true }) {
  const style = {
    width: size,
    height: size,
    borderRadius: rounded ? '50%' : 8,
    objectFit: 'cover',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  }
  return <img src={src || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='} alt={alt || ''} style={style} />
}