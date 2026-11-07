// A stored link is only rendered as <a href> when it is plain http(s) with no
// embedded credentials. The save paths already check this; this is the second
// line in case a row reaches the table another way.
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  return url.toString()
}
