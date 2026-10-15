// Deadline reminders for portal tasks. The job runs once a day, so each
// reminder covers a whole day: a task falls into each window on exactly one
// run, and nobody is reminded twice for the same window.

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type ReminderKind = '7_days' | '3_days' | '1_day' | 'overdue'

export interface ReminderTask {
  deadline_days: number | null
  deadline_at: string | null
  extended_deadline_at: string | null
  extension_granted: boolean | null
}

export function effectiveDeadline(t: ReminderTask): Date | null {
  const v = t.extension_granted && t.extended_deadline_at ? t.extended_deadline_at : t.deadline_at
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The reminder a task is due on this run, or null. */
export function reminderFor(t: ReminderTask, now: Date = new Date()): ReminderKind | null {
  const deadline = effectiveDeadline(t)
  if (!deadline) return null
  const left = deadline.getTime() - now.getTime()
  const window = t.deadline_days ?? 3
  if (left <= 0) return left > -DAY ? 'overdue' : null
  if (left <= DAY) return '1_day'
  if (window >= 6 && left > 2 * DAY && left <= 3 * DAY) return '3_days'
  if (window >= 12 && left > 6 * DAY && left <= 7 * DAY) return '7_days'
  return null
}

export const REMINDER_LEAD: Record<ReminderKind, string> = {
  '7_days': 'about a week',
  '3_days': 'about three days',
  '1_day': 'less than a day',
  overdue: '',
}
