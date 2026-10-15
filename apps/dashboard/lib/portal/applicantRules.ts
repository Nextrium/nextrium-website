// Decisions staff make on contributor portal applicants. Pure, so the
// allowed transitions and who may make them are tested in one place.

export const APPLICANT_STATUSES = ['pending', 'revision_requested', 'rejected', 'active', 'inactive'] as const
export type ApplicantStatus = (typeof APPLICANT_STATUSES)[number]

export const APPLICANT_STATUS_LABELS: Record<ApplicantStatus, string> = {
  pending: 'Pending review',
  revision_requested: 'Changes requested',
  rejected: 'Not approved',
  active: 'Approved',
  inactive: 'Deactivated',
}

/** Badge style per status (pt-badge modifier class). */
export const APPLICANT_STATUS_BADGE: Record<ApplicantStatus, string> = {
  pending: 'warn',
  revision_requested: 'info',
  rejected: 'bad',
  active: 'good',
  inactive: '',
}

export const APPLICANT_ACTIONS = ['approve', 'request_revision', 'reject', 'deactivate', 'reactivate'] as const
export type ApplicantAction = (typeof APPLICANT_ACTIONS)[number]

interface Transition {
  from: ApplicantStatus[]
  to: ApplicantStatus
  /** The note the contributor sees: required, optional or not used. */
  note: 'required' | 'optional' | 'none'
}

export const TRANSITIONS: Record<ApplicantAction, Transition> = {
  approve: { from: ['pending', 'revision_requested', 'rejected'], to: 'active', note: 'none' },
  request_revision: { from: ['pending'], to: 'revision_requested', note: 'required' },
  reject: { from: ['pending', 'revision_requested'], to: 'rejected', note: 'optional' },
  deactivate: { from: ['active'], to: 'inactive', note: 'none' },
  reactivate: { from: ['inactive'], to: 'active', note: 'none' },
}

export const NOTE_MAX = 2000

export function isApplicantAction(value: unknown): value is ApplicantAction {
  return typeof value === 'string' && (APPLICANT_ACTIONS as readonly string[]).includes(value)
}

/** The actions offered for an applicant in this status. */
export function actionsFor(status: string | null | undefined): ApplicantAction[] {
  return APPLICANT_ACTIONS.filter((a) => (TRANSITIONS[a].from as string[]).includes(status ?? ''))
}

/**
 * Admins decide on anyone. Moderators decide on anyone but themselves (an
 * applicant with their own email), so nobody below admin approves or
 * reinstates their own portal account.
 */
export function canDecideOnApplicant(caller: { role: string; email: string | null }, applicantEmail: string | null | undefined): boolean {
  if (caller.role === 'admin') return true
  if (caller.role !== 'moderator') return false
  const mine = (caller.email ?? '').trim().toLowerCase()
  return !!mine && mine !== (applicantEmail ?? '').trim().toLowerCase()
}

/** The columns a decision writes. */
export interface ApplicantUpdate {
  status: ApplicantStatus
  revision_notes?: string | null
  rejection_reason?: string | null
}

export type PlannedDecision =
  | { ok: true; to: ApplicantStatus; update: ApplicantUpdate }
  | { ok: false; error: string }

/** The database update for a decision, or why it can't be made. */
export function planDecision(action: ApplicantAction, currentStatus: string | null | undefined, rawNote: unknown): PlannedDecision {
  const t = TRANSITIONS[action]
  if (!(t.from as string[]).includes(currentStatus ?? '')) {
    return { ok: false, error: 'This applicant has changed since you opened the page. Reload to see where they stand.' }
  }
  const note = typeof rawNote === 'string' ? rawNote.trim() : ''
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` }
  if (t.note === 'required' && !note) return { ok: false, error: 'Tell the applicant what to change.' }

  const update: ApplicantUpdate = { status: t.to }
  if (action === 'request_revision') update.revision_notes = note
  if (action === 'reject') update.rejection_reason = note || null
  if (action === 'approve' || action === 'reactivate') {
    update.revision_notes = null
    update.rejection_reason = null
  }
  return { ok: true, to: t.to, update }
}
