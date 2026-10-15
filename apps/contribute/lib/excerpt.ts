import { briefToText } from '@nextrium/contributions-core/sanitize'

export const EXCERPT_LENGTH = 280

// Block ends become spaces so "<h3>Context</h3><p>Running" reads "Context Running".
const BLOCK_END = /<\/(?:p|h[1-6]|li|div|pre|blockquote|tr|td|th)>|<br\s*\/?>/gi

/** Plain-text preview of a task brief (HTML), cut at a word-ish boundary. */
export function excerptOf(html: string, length = EXCERPT_LENGTH): string {
  const text = briefToText(html.replace(BLOCK_END, '$& ')).replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}
