// Staff decisions on portal submissions. Pure, so the queue, who may decide
// and the points rules are tested in one place. Community statuses:
// submitted (automated review not finished), under_review (with the team),
// ai_approved (passed the automated review), verified, rejected.

/** Attempts per task; the database refuses a fourth. */
export const MAX_ATTEMPTS = 3
export const NOTE_MAX = 4000

export const QUEUE_TABS = [
  { key: 'team', label: 'With the team', hint: 'Escalated by the automated review, or flagged for a person' },
  { key: 'passed', label: 'Passed review', hint: 'Passed the automated review — verify to award points' },
  { key: 'pending', label: 'Awaiting automated review', hint: 'The automated review has not finished; you can still decide' },
  { key: 'changes', label: 'Changes requested', hint: 'Waiting for the contributor to resubmit' },
  { key: 'verified', label: 'Verified', hint: 'Points awarded' },
  { key: 'rejected', label: 'Not accepted', hint: 'Final, no points' },
] as const
export type QueueTab = (typeof QUEUE_TABS)[number]['key']

interface Sub {
  status: string | null
  notes: string | null
  submission_count: number | null
}

/** Which queue tab a submission belongs in. */
export function queueTab(s: Sub): QueueTab {
  switch (s.status) {
    case 'under_review': return 'team'
    case 'ai_approved': return 'passed'
    case 'submitted': return 'pending'
    case 'verified': return 'verified'
    case 'rejected': return !s.notes && (s.submission_count ?? 1) < MAX_ATTEMPTS ? 'changes' : 'rejected'
    default: return 'team'
  }
}

/** Staff may verify or reject anything not yet final (including an automated rejection, as an override). */
export function isDecidable(s: Sub): boolean {
  const tab = queueTab(s)
  return tab === 'team' || tab === 'passed' || tab === 'pending' || tab === 'changes'
}

/**
 * Admins decide on anyone's submission. Moderators on anyone's but their own
 * (matched by email), so nobody below admin awards themselves points.
 */
export function canDecideOnPortalSubmission(caller: { role: string; email: string | null }, contributorEmail: string | null | undefined): boolean {
  if (caller.role === 'admin') return true
  if (caller.role !== 'moderator') return false
  const mine = (caller.email ?? '').trim().toLowerCase()
  return !!mine && mine !== (contributorEmail ?? '').trim().toLowerCase()
}

/** Points to award, kept inside the task's range. */
export function clampPoints(points: unknown, min: number, max: number): number | null {
  const n = typeof points === 'number' ? points : typeof points === 'string' && points.trim() ? Number(points) : NaN
  if (!Number.isFinite(n)) return null
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return Math.round(Math.max(lo, Math.min(hi, n)))
}

export function parseNote(raw: unknown, required: boolean): { note: string | null } | { error: string } {
  const note = typeof raw === 'string' ? raw.trim() : ''
  if (note.length > NOTE_MAX) return { error: `Keep the note under ${NOTE_MAX} characters.` }
  if (required && !note) return { error: 'Add a note for the contributor explaining the decision.' }
  return { note: note || null }
}
