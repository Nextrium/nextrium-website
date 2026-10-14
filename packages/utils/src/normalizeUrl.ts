// Prepends https:// to a scheme-less URL (e.g. "linkedin.com/in/x") before
// it's stored — without this, anywhere that renders it as a plain <a href>
// resolves it as a relative path on that page's own domain and 404s.
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function isValidUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeUrl(raw))
    return url.hostname.includes('.')
  } catch {
    return false
  }
}
