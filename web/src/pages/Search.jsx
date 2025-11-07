import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { SearchApi } from '../services/api'
import Loader from '../components/Loader'
import UserRow from '../components/UserRow'
import TweetCard from '../components/TweetCard'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const q = String(searchParams.get('q') || '').trim()
  const type = String(searchParams.get('type') || 'tweets') // 'tweets' | 'users'

  const [query, setQuery] = useState(q)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // keep local input in sync when url changes (back/forward)
  useEffect(() => {
    setQuery(q)
  }, [q])

  const doSearch = useCallback(
    async (searchText, searchType) => {
      const qClean = (searchText || '').trim()
      if (!qClean) {
        setResults([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        let res
        if (searchType === 'users') {
          res = await SearchApi.searchUsers(qClean, null)
          // normalize response shape: prefer res.users or res.data or raw array
          setResults(Array.isArray(res) ? res : (res?.users || res?.data || []))
        } else {
          res = await SearchApi.searchTweets(qClean, null)
          setResults(Array.isArray(res) ? res : (res?.tweets || res?.data || []))
        }
      } catch (err) {
        console.error('Search error', err)
        setError(err?.message || 'Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Trigger search when q or type changes in the URL
  useEffect(() => {
    if (!q) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    doSearch(q, type)
  }, [q, type, doSearch])

  function submit(e) {
    e.preventDefault()
    const trimmed = (query || '').trim()
    if (!trimmed) {
      // clear the q param
      setSearchParams({})
      return
    }
    setSearchParams({ q: trimmed, type })
    // ensure URL reflect change (useNavigate not required; setSearchParams suffices)
  }

  function changeType(t) {
    const qParam = (query || '').trim()
    if (qParam) setSearchParams({ q: qParam, type: t })
    else setSearchParams({ type: t })
  }

  return (
    <div className="page search-page">
      <h2>Search</h2>

      <form onSubmit={submit} style={{ marginBottom: 12 }}>
        <input
          aria-label="search"
          placeholder="Search users or tweets"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
        />
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => changeType('tweets')}
          disabled={type === 'tweets'}
          style={{ padding: '6px 10px', borderRadius: 8 }}
        >
          Tweets
        </button>
        <button
          onClick={() => changeType('users')}
          disabled={type === 'users'}
          style={{ padding: '6px 10px', borderRadius: 8 }}
        >
          Users
        </button>
      </div>

      {loading && <Loader />}

      {error && <div className="error">{error}</div>}

      {!loading && !error && results.length === 0 && q && (
        <div>No results for “{q}”</div>
      )}

      <div>
        {type === 'users' &&
          results.map((u) => <UserRow key={u._id || u.id || u.username} user={u} />)}

        {type === 'tweets' &&
          results.map((t) => <TweetCard key={t._id || t.id} tweet={t} />)}
      </div>
    </div>
  )
}