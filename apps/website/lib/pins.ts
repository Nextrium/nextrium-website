// Pinned posts go first, in the order staff chose; everything else keeps its
// order (newest first). Pins pointing at posts that aren't in the list (a
// draft, a deleted post) are simply skipped.
export function orderWithPins<T extends { id: string }>(posts: T[], pinnedIds: string[]): T[] {
  const byId = new Map(posts.map((p) => [p.id, p]))
  const pinned: T[] = []
  const seen = new Set<string>()
  for (const id of pinnedIds) {
    const p = byId.get(id)
    if (p && !seen.has(id)) { pinned.push(p); seen.add(id) }
  }
  return [...pinned, ...posts.filter((p) => !seen.has(p.id))]
}
