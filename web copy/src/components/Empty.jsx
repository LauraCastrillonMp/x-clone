import React from 'react'

export default function Empty({ children = 'Nothing here yet.' }) {
  return <div className="empty">{children}</div>
}