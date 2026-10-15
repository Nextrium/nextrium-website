import { EXTENSION_DAYS, isComplexity } from '@nextrium/contributions-core/constants'

// Rules for portal tasks managed from the dashboard. Pure, so they are tested
// in one place. The community database only knows open, assigned and
// completed; there is no draft step.

export const PORTAL_TASK_STATUSES = ['open', 'assigned', 'completed'] as const
export type PortalTaskStatus = (typeof PORTAL_TASK_STATUSES)[number]

export const PORTAL_TASK_STATUS_LABELS: Record<PortalTaskStatus, string> = {
  open: 'Open',
  assigned: 'In progress',
  completed: 'Completed',
}

export const TAGS_MAX = 8
export const TAG_MAX = 40

/** Topic tags (the "primitives" column): comma separated, trimmed, de-duplicated. */
export function parseTags(raw: unknown): { tags: string[] | null } | { error: string } {
  const list = (typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [])
    .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
    .filter(Boolean)
  const tags = [...new Set(list)]
  if (tags.length > TAGS_MAX) return { error: `Use at most ${TAGS_MAX} tags.` }
  if (tags.some((t) => t.length > TAG_MAX)) return { error: `Each tag can be at most ${TAG_MAX} characters.` }
  if (tags.some((t) => !/^[a-z0-9][a-z0-9 _-]*$/.test(t))) return { error: 'Tags can use letters, numbers, spaces, - and _ only.' }
  return { tags: tags.length > 0 ? tags : null }
}

/**
 * Extension state as stored: requested (extension_requested_at), granted
 * (extension_granted + extended_deadline_at). The database has no "declined"
 * flag, so a decline is stored as requested, not granted, with
 * extended_deadline_at set to the unchanged deadline. That also stops the
 * contributor asking again.
 */
export type ExtensionState = 'none' | 'requested' | 'granted' | 'declined'

export function extensionState(t: { extension_requested_at: string | null; extension_granted: boolean | null; extended_deadline_at: string | null }): ExtensionState {
  if (t.extension_granted) return 'granted'
  if (!t.extension_requested_at) return 'none'
  return t.extended_deadline_at ? 'declined' : 'requested'
}

export const EXTENSION_LABELS: Record<ExtensionState, string> = {
  none: 'No extension',
  requested: 'Extension requested',
  granted: 'Extension granted',
  declined: 'Extension declined',
}

/** The deadline after granting: the original deadline plus the task size's extension days. */
export function extendedDeadline(deadlineAt: string, complexity: string): string {
  const days = isComplexity(complexity) ? EXTENSION_DAYS[complexity] : EXTENSION_DAYS.small
  return new Date(new Date(deadlineAt).getTime() + days * 86_400_000).toISOString()
}

/** Deadline for a direct assignment: the chosen date, or now plus the task's deadline days. */
export function assignmentDeadline(deadlineDays: number, chosen: string | null, now: Date = new Date()): string {
  return chosen ?? new Date(now.getTime() + deadlineDays * 86_400_000).toISOString()
}

/** Which edits a task allows in its current status. */
export function editRules(status: string | null | undefined): { content: boolean; sizing: boolean } {
  // Category and size set the point range and deadline, so they are fixed once someone holds the task.
  if (status === 'open') return { content: true, sizing: true }
  if (status === 'assigned') return { content: true, sizing: false }
  return { content: false, sizing: false }
}

/**
 * Whether an admin may delete a task, and which of its submissions go with it.
 * Only an open task whose submissions were all rejected (including "changes
 * requested") can go: those carry no points, so removing them changes no
 * score. Held tasks, work waiting for review and verified work are kept.
 */
export function deleteRule(status: string | null | undefined, submissions: { id: string; status: string | null }[]): { ok: true; removeSubmissionIds: string[] } | { ok: false; error: string } {
  if (status !== 'open') return { ok: false, error: 'Only open tasks can be deleted. Unassign it first.' }
  if (submissions.some((s) => s.status === 'verified')) return { ok: false, error: 'This task has verified work with points awarded, so it is kept for the record.' }
  if (submissions.some((s) => s.status !== 'rejected')) return { ok: false, error: 'This task has a submission waiting for review. Decide on it in the review queue first.' }
  return { ok: true, removeSubmissionIds: submissions.map((s) => s.id) }
}
