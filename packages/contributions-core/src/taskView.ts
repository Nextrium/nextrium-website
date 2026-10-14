// Display helpers for tasks. Pure, so the list, editor and member pages all
// agree on what "overdue" and "effective deadline" mean.
import type { ContributionStatus, TaskStatus } from './constants'

export interface DeadlineFields {
  status: TaskStatus
  deadline_at: string | null
  extended_deadline_at: string | null
}

const OPEN_STATUSES: TaskStatus[] = ['assigned', 'changes_requested']

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  submitted: 'Submitted',
  changes_requested: 'Changes requested',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** The deadline that applies: a granted extension replaces the original. */
export function effectiveDeadline(t: Pick<DeadlineFields, 'deadline_at' | 'extended_deadline_at'>): Date | null {
  const value = t.extended_deadline_at ?? t.deadline_at
  return value ? new Date(value) : null
}

/** Open (assigned or changes requested) and past its effective deadline. */
export function isOverdue(t: DeadlineFields, now: Date = new Date()): boolean {
  const d = effectiveDeadline(t)
  return !!d && OPEN_STATUSES.includes(t.status) && now.getTime() > d.getTime()
}

/** "in 3 days", "in 5 hours", "2 days overdue", or "—" when there's no deadline. */
export function deadlineLabel(t: DeadlineFields, now: Date = new Date()): string {
  const d = effectiveDeadline(t)
  if (!d) return '—'
  const diffMs = d.getTime() - now.getTime()
  const hours = Math.round(Math.abs(diffMs) / 3_600_000)
  const amount = hours >= 48 ? `${Math.round(hours / 24)} days` : `${hours} hour${hours === 1 ? '' : 's'}`
  if (!OPEN_STATUSES.includes(t.status)) return d.toISOString().slice(0, 10)
  return diffMs >= 0 ? `in ${amount}` : `${amount} overdue`
}

/**
 * Minutes after which a review still 'pending_review' is treated as lost (the
 * background review was cut off) and staff may retry it. Well above the
 * server's 60 s limit, so a review that is still running is never retried.
 */
export const REVIEW_STALE_MINUTES = 5

export function isReviewStale(c: { status: string; submitted_at: string }, now: Date = new Date()): boolean {
  return c.status === 'pending_review' && now.getTime() - new Date(c.submitted_at).getTime() > REVIEW_STALE_MINUTES * 60_000
}

/** How a contribution's status reads to the member who submitted it. */
export const CONTRIBUTION_STATUS_MEMBER_LABELS: Record<ContributionStatus, string> = {
  pending_review: 'Submitted — being reviewed',
  review_failed: 'Submitted — waiting for the team to review',
  changes_requested: 'Changes requested',
  needs_human: 'Submitted — with the team for review',
  ai_approved: 'Passed review — awaiting team verification',
  verified: 'Verified',
  rejected: 'Not accepted',
}

/** Review queue tabs, in display order. The first is the default. */
export const QUEUE_TABS: { key: ContributionStatus; label: string; hint: string }[] = [
  { key: 'needs_human', label: 'Needs a human', hint: 'Escalated by the service, or approved with a security finding' },
  { key: 'ai_approved', label: 'AI approved', hint: 'Passed the automated review — verify to award points' },
  { key: 'review_failed', label: 'Review failed', hint: 'The service timed out, was rate limited or errored — retry' },
  { key: 'changes_requested', label: 'Changes requested', hint: 'Waiting for the member to resubmit' },
  { key: 'pending_review', label: 'Reviewing', hint: 'The automated review is running' },
  { key: 'verified', label: 'Verified', hint: 'Points awarded' },
  { key: 'rejected', label: 'Rejected', hint: 'Final, no points' },
]
