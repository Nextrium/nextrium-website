// Display helpers for tasks. Pure, so the list, editor and member pages all
// agree on what "overdue" and "effective deadline" mean.
import type { TaskStatus } from './constants'

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
