export function parseListResponse(data) {
  if (!data) return { items: [], nextCursor: null, total: undefined }
  if (Array.isArray(data)) return { items: data, nextCursor: null, total: data.length }

  const d = (data && typeof data.data === 'object' && !Array.isArray(data.data)) ? data.data : data

  if (Array.isArray(d.docs)) {
    return {
      items: d.docs,
      nextCursor: d.nextPage ?? null,
      total: d.totalDocs ?? d.total ?? undefined
    }
  }

  const candidates = [d.users, d.items, d.tweets, d.results, d.rows, d.list, d.docs, d.data]
  const items = candidates.find(Array.isArray) || []
  const nextCursor =
    d.nextCursor ?? d.next ?? d.cursor ?? d.pageInfo?.endCursor ?? d.pagination?.nextCursor ?? null
  const total = d.total ?? d.count ?? undefined

  return { items, nextCursor, total }
}