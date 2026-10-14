import { EXTENSION_DAYS, isComplexity } from '@nextrium/contributions-core/constants'

// Deadlines for a claimed task, as the contributor dashboard shows them.

export interface ClaimedTaskTiming {
  complexity: string
  claimed_at: string | null
  deadline_at: string | null
  deadline_days: number | null
  extension_granted: boolean | null
  extension_requested_at: string | null
  extended_deadline_at: string | null
}

/** The deadline that applies: a granted extension replaces the original. */
export function effectiveDeadline(t: ClaimedTaskTiming): Date | null {
  const value = t.extension_granted && t.extended_deadline_at ? t.extended_deadline_at : t.deadline_at
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface TimeRemaining {
  deadline: Date | null
  isOverdue: boolean
  /** Share of the deadline window already used, 0 to 1. */
  used: number
  urgency: 'normal' | 'urgent' | 'overdue'
  label: string
}

const HOUR = 3_600_000
const DAY = 24 * HOUR

export function timeRemaining(t: ClaimedTaskTiming, now: Date = new Date()): TimeRemaining {
  const deadline = effectiveDeadline(t)
  if (!deadline) return { deadline: null, isOverdue: false, used: 0, urgency: 'normal', label: 'No deadline set' }

  const diff = deadline.getTime() - now.getTime()
  const claimed = t.claimed_at ? new Date(t.claimed_at).getTime() : NaN
  const windowMs = deadline.getTime() - claimed
  const used = Number.isFinite(windowMs) && windowMs > 0 ? Math.min(1, Math.max(0, (now.getTime() - claimed) / windowMs)) : 0

  const abs = Math.abs(diff)
  const days = Math.floor(abs / DAY)
  const hours = Math.floor((abs % DAY) / HOUR)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

  if (diff < 0) {
    return { deadline, isOverdue: true, used: 1, urgency: 'overdue', label: `Overdue by ${days === 0 ? plural(hours, 'hour') : plural(days, 'day')}` }
  }
  const label = days > 0 ? `${plural(days, 'day')} ${hours}h remaining` : `${plural(hours, 'hour')} remaining`
  return { deadline, isOverdue: false, used, urgency: used > 0.5 ? 'urgent' : 'normal', label }
}

/** Days an extension adds for this task's size. */
export function extensionDays(complexity: string): number {
  return isComplexity(complexity) ? EXTENSION_DAYS[complexity] : EXTENSION_DAYS.small
}

/** One request per task, before the original deadline, and only while none is pending or granted. */
export function canRequestExtension(t: ClaimedTaskTiming, now: Date = new Date()): boolean {
  if (t.extension_granted || t.extension_requested_at || !t.deadline_at) return false
  return now.getTime() < new Date(t.deadline_at).getTime()
}
