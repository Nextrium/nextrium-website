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

// ── Progress of a shared task ───────────────────────────────────────────────

const SUBMITTED = ['submitted', 'changes_requested', 'completed']

/** Where a group stands, counting only live (not cancelled) copies. */
export function groupProgress(statuses: string[]): { total: number; submitted: number; completed: number; label: string } {
  const live = statuses.filter((s) => s !== 'cancelled')
  const submitted = live.filter((s) => SUBMITTED.includes(s)).length
  const completed = live.filter((s) => s === 'completed').length
  const label = live.length === 0
    ? 'All copies cancelled'
    : `${submitted} of ${live.length} submitted${completed ? ` · ${completed} completed` : ''}`
  return { total: live.length, submitted, completed, label }
}

/** Copies a group-wide action may change: not yet submitted and never given a submission. */
export function openCopyIds(copies: { id: string; status: string }[], withSubmission: Set<string>): string[] {
  return copies.filter((c) => (c.status === 'draft' || c.status === 'assigned') && !withSubmission.has(c.id)).map((c) => c.id)
}

// ── Deleting ────────────────────────────────────────────────────────────────

/** Only admins, only cancelled tasks, and only when nobody ever submitted work for it. */
export function deleteTaskRule(role: string, status: string, submissions: number): { ok: true } | { ok: false; error: string } {
  if (role !== 'admin') return { ok: false, error: 'Only admins can delete tasks.' }
  if (status !== 'cancelled') return { ok: false, error: 'Cancel the task first. Only cancelled tasks can be deleted.' }
  if (submissions > 0) return { ok: false, error: 'This task has a submission, so it is kept for the record.' }
  return { ok: true }
}

// ── Similar submissions within a group ──────────────────────────────────────

/** Overlap at or above this share of word sequences is worth a reviewer's look. */
export const SIMILARITY_FLAG = 0.6

function words(text: string): string[] {
  return text.toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
}

/** Share of three-word sequences two texts have in common (0 to 1). */
export function textSimilarity(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  if (wa.length === 0 || wb.length === 0) return 0
  if (wa.length < 3 || wb.length < 3) return wa.join(' ') === wb.join(' ') ? 1 : 0
  const grams = (w: string[]) => {
    const s = new Set<string>()
    for (let i = 0; i + 2 < w.length; i++) s.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`)
    return s
  }
  const ga = grams(wa)
  const gb = grams(wb)
  let shared = 0
  for (const g of ga) if (gb.has(g)) shared++
  return shared / (ga.size + gb.size - shared)
}

/** The same evidence link, ignoring case, "www.", a trailing slash and the fragment. */
export function sameEvidence(a: string | null, b: string | null): boolean {
  const norm = (u: string | null) => {
    if (!u) return null
    try {
      const x = new URL(u.trim())
      return `${x.host.toLowerCase().replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${x.search}`
    } catch {
      return u.trim().toLowerCase()
    }
  }
  const na = norm(a)
  const nb = norm(b)
  return !!na && na === nb
}

export interface SubmissionText { id: string; description: string; evidence_url: string | null }

/** Other submissions in the group that look like this one, most similar first. */
export function findSimilar(target: SubmissionText, others: SubmissionText[]): { id: string; score: number; sameLink: boolean }[] {
  return others
    .filter((o) => o.id !== target.id)
    .map((o) => ({ id: o.id, score: textSimilarity(target.description, o.description), sameLink: sameEvidence(target.evidence_url, o.evidence_url) }))
    .filter((r) => r.score >= SIMILARITY_FLAG || r.sameLink)
    .sort((x, y) => Number(y.sameLink) - Number(x.sameLink) || y.score - x.score)
}
