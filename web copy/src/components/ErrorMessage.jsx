import React from 'react'

export default function ErrorMessage({ error }) {
  if (!error) return null
  const msg = typeof error === 'string' ? error : (error?.message || 'Something went wrong')
  return <div className="error">{msg}</div>
}