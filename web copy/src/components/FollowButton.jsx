import React, { useEffect, useMemo, useState } from 'react'
import { UserApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function FollowButton({ targetUsername, initiallyFollowing, size = 'default', onChange }) {
  const { user } = useAuth()
  const meUsername = useMemo(
    () => (user?.username || user?.handle || (user?.email ? user.email.split('@')[0] : '')).toLowerCase(),
    [user]
  )
  const username = (targetUsername || '').toLowerCase()

  // Hide for self; parent can render "Edit profile"
  if (!username || (meUsername && meUsername === username)) return null

  const [following, setFollowing] = useState(
    typeof initiallyFollowing === 'boolean' ? initiallyFollowing : null
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    if (following === null && username) {
      ;(async () => {
        try {
          const r = await UserApi.followStatus(username)
          const d = r?.data || {}
          const val =
            (typeof d.following === 'boolean') ? d.following :
            (typeof d.isFollowing === 'boolean') ? d.isFollowing :
            false
          if (mounted) setFollowing(val)
        } catch {
          if (mounted && following === null) setFollowing(false)
        }
      })()
    }
    return () => { mounted = false }
  }, [username, following])

  useEffect(() => {
    if (typeof initiallyFollowing === 'boolean') setFollowing(initiallyFollowing)
  }, [initiallyFollowing])

  async function toggle() {
    if (loading) return
    setLoading(true)
    const next = !(following === true)
    setFollowing(next)
    try {
      if (next) await UserApi.follow(username)
      else await UserApi.unfollow(username)
      onChange?.(next)
    } catch (e) {
      setFollowing(!next)
      // eslint-disable-next-line no-console
      console.error('Follow toggle failed:', e?.response?.status, e?.response?.data || e?.message)
    } finally {
      setLoading(false)
    }
  }

  const label = loading ? '...' : (following ? 'Unfollow' : 'Follow')

  return (
    <button
      className={`button ${following ? 'primary' : ''} ${size === 'small' ? 'small' : ''}`}
      onClick={toggle}
      disabled={loading}
      aria-pressed={Boolean(following)}
    >
      {label}
    </button>
  )
}