export function timeAgo(input) {
  if (!input) return ''
  const date = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  const w = Math.floor(d / 7)
  if (w < 4) return `${w}w`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo`
  const y = Math.floor(d / 365)
  return `${y}y`
}