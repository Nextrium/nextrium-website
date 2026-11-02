const MAX_STATEMENT = 2000
const MAX_DIMENSIONS = 50
const MAX_URLS = 5
const MAX_URL_LENGTH = 2000

export interface RebuttalInput {
  dimensions: string[]
  statement: string
  urls: string[]
}

function isWebUrl(value: string): boolean {
  if (value.length > MAX_URL_LENGTH) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** Server actions accept anything from the network, so types are checked as well as content. */
export function parseRebuttalInput(dimensions: unknown, statement: unknown, urls: unknown): RebuttalInput | { error: string } {
  const text = typeof statement === 'string' ? statement.trim() : ''
  if (!text) return { error: 'Evidence statement is required.' }
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return { error: 'Please select at least one disputed dimension.' }
  }
  if (dimensions.length > MAX_DIMENSIONS || !dimensions.every((d) => typeof d === 'string')) {
    return { error: 'One or more disputed dimensions are not valid.' }
  }
  if (text.length > MAX_STATEMENT) return { error: 'Evidence statement must be under 2000 characters.' }

  const list = urls == null ? [] : urls
  if (!Array.isArray(list) || !list.every((u) => typeof u === 'string')) {
    return { error: 'One or more evidence URLs are not valid.' }
  }
  const cleaned = list.map((u: string) => u.trim()).filter(Boolean)
  if (cleaned.length > MAX_URLS) return { error: `Please add no more than ${MAX_URLS} evidence URLs.` }
  if (!cleaned.every(isWebUrl)) return { error: 'One or more evidence URLs are not valid.' }

  return { dimensions, statement: text, urls: cleaned }
}
