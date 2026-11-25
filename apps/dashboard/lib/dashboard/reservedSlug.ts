// The editor routes treat these slugs as "create a new item", so a saved item
// with one of them could never be opened, edited or deleted again.
const RESERVED = new Set(['new'])

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.trim().toLowerCase())
}
