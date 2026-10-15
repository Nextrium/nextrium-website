import { normalizeUrl } from '@nextrium/utils/normalizeUrl'

/**
 * A link that is safe to render as an <a href>: http(s) only, no embedded
 * credentials. Scheme-less input ("github.com/x") gets https://. Anything
 * else (javascript:, data:, garbage) returns null and is not linked.
 */
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2000) return null
  let url: URL
  try {
    url = new URL(normalizeUrl(raw))
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password || !url.hostname.includes('.')) return null
  return url.toString()
}

export interface TaskLink {
  label: string
  url: string
}

/** A task's links column (jsonb), keeping only well-formed, safe entries. */
export function parseTaskLinks(raw: unknown): TaskLink[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const { label, url } = item as Record<string, unknown>
    const safe = safeExternalUrl(url)
    if (!safe) return []
    return [{ label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 200) : safe, url: safe }]
  })
}
