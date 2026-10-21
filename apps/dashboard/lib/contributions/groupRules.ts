// Rules for giving one task to several people. Each person gets their own copy
// of the task (same brief, same deadline), linked by a shared group id, so the
// usual one-owner checks keep every copy private to its assignee.

/** Fewest people a group is for; one person is an ordinary assignment. */
export const GROUP_MIN = 2
/** Most people one group can go to, so a single click never emails a crowd. */
export const GROUP_MAX = 20

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The chosen people: valid ids, each once, between GROUP_MIN and GROUP_MAX of them. */
export function parseGroupAssignees(raw: unknown): { ids: string[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Choose the people to assign.' }
  if (raw.length > GROUP_MAX * 2) return { error: `Choose at most ${GROUP_MAX} people.` }
  const ids: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string' || !ID.test(v)) return { error: 'Choose the people to assign.' }
    const id = v.toLowerCase()
    if (!ids.includes(id)) ids.push(id)
  }
  if (ids.length < GROUP_MIN) return { error: `Choose at least ${GROUP_MIN} people, or assign the task to one person instead.` }
  if (ids.length > GROUP_MAX) return { error: `Choose at most ${GROUP_MAX} people.` }
  return { ids }
}

/**
 * The one deadline every copy gets: the chosen date, or the task's usual
 * number of days from now. Worked out once so the copies match exactly.
 */
export function groupDeadline(chosen: string | null, deadlineDays: number, now: Date = new Date()): string {
  return chosen ?? new Date(now.getTime() + deadlineDays * 86_400_000).toISOString()
}

/** Short summary of how a group assignment went, for the staff member who made it. */
export function groupOutcome(assigned: number, failed: { name: string; error: string }[]): string {
  const total = assigned + failed.length
  if (failed.length === 0) return `Assigned to all ${total} people.`
  const who = failed.map((f) => `${f.name} (${f.error})`).join('; ')
  return `Assigned to ${assigned} of ${total}. Not assigned: ${who}. Their copies are kept as drafts in the task list, to assign again or cancel.`
}
