const PROBE_ORIGIN = 'http://portal.invalid'

/**
 * The page to land on after signing in. Only same-site paths are allowed:
 * absolute URLs, protocol-relative (//evil), backslash tricks (/\evil),
 * control characters and the auth routes themselves all fall back.
 */
export function safeNext(raw: unknown, fallback = '/dashboard'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return fallback
  if (!/^\/(?![/\\])/.test(raw)) return fallback
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback
  let url: URL
  try {
    url = new URL(raw, PROBE_ORIGIN)
  } catch {
    return fallback
  }
  if (url.origin !== PROBE_ORIGIN) return fallback
  if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return fallback
  return url.pathname + url.search + url.hash
}
