// Pure rules for recurring task schedules, Lagos-anchored calendar dates,
// direct-review defaults, and the 24h reminder -> 3-day draft -> auto-delete lifecycle.
import { isCategory, isComplexity, taskDefaults, type Category, type Complexity } from './constants'

export const CADENCES = ['daily', 'weekdays', 'weekly', 'biweekly', 'monthly'] as const
export type Cadence = (typeof CADENCES)[number]

export const CADENCE_LABELS: Record<Cadence, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays (Mon–Fri)',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
}

export const DAY_OF_WEEK_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export const END_MODES = ['date', 'count', 'never'] as const
export type EndMode = (typeof END_MODES)[number]

export const SCHEDULE_STATUSES = ['active', 'paused', 'completed'] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

export const ASSIGNMENT_MODES = ['draft', 'one', 'group'] as const
export type RecurringAssignmentMode = (typeof ASSIGNMENT_MODES)[number]

export const DURATION_DAYS_MIN = 1
export const DURATION_DAYS_MAX = 30
export const MAX_OCCURRENCES_CAP = 104
export const REMINDER_GRACE_HOURS = 24
export const DRAFT_RETENTION_DAYS = 3

const YMD = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCadence(value: unknown): value is Cadence {
  return typeof value === 'string' && (CADENCES as readonly string[]).includes(value)
}

export function isEndMode(value: unknown): value is EndMode {
  return typeof value === 'string' && (END_MODES as readonly string[]).includes(value)
}

export function isScheduleStatus(value: unknown): value is ScheduleStatus {
  return typeof value === 'string' && (SCHEDULE_STATUSES as readonly string[]).includes(value)
}

export function isValidYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !YMD.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Current calendar date (YYYY-MM-DD) in Africa/Lagos (WAT, UTC+1, no DST). */
export function lagosToday(now: Date = new Date()): string {
  const wat = new Date(now.getTime() + 60 * 60_000)
  const y = wat.getUTCFullYear()
  const m = String(wat.getUTCMonth() + 1).padStart(2, '0')
  const d = String(wat.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Adds `days` calendar days to a YYYY-MM-DD date string. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Day of week (0 = Sunday .. 6 = Saturday) for a YYYY-MM-DD date. */
export function dayOfWeekYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export interface ScheduleSpec {
  cadence: Cadence
  day_of_week: number | null
  day_of_month: number | null
  starts_on: string
  ends_on: string | null
  max_occurrences: number | null
  occurrences_created: number
}

function withinBounds(spec: Pick<ScheduleSpec, 'ends_on' | 'max_occurrences' | 'occurrences_created'>, candidateYmd: string): boolean {
  if (spec.ends_on && candidateYmd > spec.ends_on) return false
  if (spec.max_occurrences !== null && spec.occurrences_created >= spec.max_occurrences) return false
  return true
}

/** Computes the first scheduled occurrence date on or after `fromYmd` (and >= `starts_on`). */
export function firstOccurrenceOnOrAfter(spec: ScheduleSpec, fromYmd: string): string | null {
  if (spec.max_occurrences !== null && spec.occurrences_created >= spec.max_occurrences) return null
  const floor = fromYmd > spec.starts_on ? fromYmd : spec.starts_on
  let candidate: string

  switch (spec.cadence) {
    case 'daily':
      candidate = floor
      break
    case 'weekdays': {
      candidate = floor
      while (dayOfWeekYmd(candidate) === 0 || dayOfWeekYmd(candidate) === 6) {
        candidate = addDaysYmd(candidate, 1)
      }
      break
    }
    case 'weekly':
    case 'biweekly': {
      const targetDow = spec.day_of_week ?? dayOfWeekYmd(spec.starts_on)
      const startDow = dayOfWeekYmd(spec.starts_on)
      const firstAfterStart = addDaysYmd(spec.starts_on, (targetDow - startDow + 7) % 7)
      const step = spec.cadence === 'biweekly' ? 14 : 7
      candidate = firstAfterStart
      while (candidate < floor) {
        candidate = addDaysYmd(candidate, step)
      }
      break
    }
    case 'monthly': {
      const dom = Math.max(1, Math.min(28, spec.day_of_month ?? Number(spec.starts_on.slice(8, 10))))
      let y = Number(floor.slice(0, 4))
      let m = Number(floor.slice(5, 7))
      candidate = `${y}-${String(m).padStart(2, '0')}-${String(dom).padStart(2, '0')}`
      if (candidate < floor) {
        m += 1
        if (m > 12) { m = 1; y += 1 }
        candidate = `${y}-${String(m).padStart(2, '0')}-${String(dom).padStart(2, '0')}`
      }
      break
    }
  }

  return withinBounds(spec, candidate) ? candidate : null
}

/** Computes the next occurrence strictly after `lastYmd`. */
export function nextOccurrenceAfter(spec: ScheduleSpec, lastYmd: string): string | null {
  if (spec.max_occurrences !== null && spec.occurrences_created >= spec.max_occurrences) return null
  let candidate: string

  switch (spec.cadence) {
    case 'daily':
      candidate = addDaysYmd(lastYmd, 1)
      break
    case 'weekdays': {
      candidate = addDaysYmd(lastYmd, 1)
      while (dayOfWeekYmd(candidate) === 0 || dayOfWeekYmd(candidate) === 6) {
        candidate = addDaysYmd(candidate, 1)
      }
      break
    }
    case 'weekly':
      candidate = addDaysYmd(lastYmd, 7)
      break
    case 'biweekly':
      candidate = addDaysYmd(lastYmd, 14)
      break
    case 'monthly': {
      const dom = Math.max(1, Math.min(28, spec.day_of_month ?? Number(lastYmd.slice(8, 10))))
      let y = Number(lastYmd.slice(0, 4))
      let m = Number(lastYmd.slice(5, 7)) + 1
      if (m > 12) { m = 1; y += 1 }
      candidate = `${y}-${String(m).padStart(2, '0')}-${String(dom).padStart(2, '0')}`
      break
    }
  }

  return withinBounds(spec, candidate) ? candidate : null
}

/** True when an active schedule has an occurrence due on or before `todayYmd`. */
export function isScheduleDue(
  schedule: { status: string; next_run_on: string | null; ends_on: string | null; max_occurrences: number | null; occurrences_created: number },
  todayYmd: string,
): boolean {
  if (schedule.status !== 'active' || !schedule.next_run_on) return false
  if (schedule.ends_on && schedule.next_run_on > schedule.ends_on) return false
  if (schedule.max_occurrences !== null && schedule.occurrences_created >= schedule.max_occurrences) return false
  return schedule.next_run_on <= todayYmd
}

/**
 * Computes the ISO deadline for a recurring occurrence opening at 08:00 Lagos
 * on `occurrenceYmd` (or `now` if spawned mid-day on the start date) plus `durationDays`.
 */
export function cycleDeadlineAt(occurrenceYmd: string, durationDays: number, spawnedAt?: Date): string {
  const days = Math.max(DURATION_DAYS_MIN, Math.min(DURATION_DAYS_MAX, Math.round(durationDays)))
  // 08:00 Africa/Lagos (UTC+1) = 07:00 UTC on occurrenceYmd.
  const [y, m, d] = occurrenceYmd.split('-').map(Number)
  const scheduledStartMs = Date.UTC(y, m - 1, d, 7, 0, 0)
  const baseMs = spawnedAt && spawnedAt.getTime() > scheduledStartMs ? spawnedAt.getTime() : scheduledStartMs
  return new Date(baseMs + days * 24 * 60 * 60_000).toISOString()
}

/** Appends a concise human-readable cycle date to a recurring task's title (≤ 200 chars). */
export function formatOccurrenceTitle(baseTitle: string, occurrenceYmd: string): string {
  const clean = baseTitle.trim() || 'Recurring task'
  const [y, m, d] = occurrenceYmd.split('-').map(Number)
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const suffix = ` — ${label}`
  const maxBase = Math.max(1, 200 - suffix.length)
  return `${clean.slice(0, maxBase)}${suffix}`
}

export interface ParsedRecurringOptions {
  cadence: Cadence
  day_of_week: number | null
  day_of_month: number | null
  starts_on: string
  ends_on: string | null
  max_occurrences: number | null
  duration_days: number
  assignment_mode: RecurringAssignmentMode
  assignee_ids: string[]
  skip_automated_review: boolean
  next_run_on: string
}

/** Server-side validator for recurring schedule configuration. */
export function parseRecurringOptions(
  raw: unknown,
  taskMeta: { category: unknown; complexity: unknown },
  todayYmd: string = lagosToday(),
): { options: ParsedRecurringOptions } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid recurring schedule.' }
  const r = raw as Record<string, unknown>

  if (!isCadence(r.cadence)) return { error: 'Choose how often this task repeats.' }
  const cadence = r.cadence

  const startsOn = typeof r.startsOn === 'string' && r.startsOn.trim() ? r.startsOn.trim() : todayYmd
  if (!isValidYmd(startsOn)) return { error: 'Choose a valid start date.' }

  let dayOfWeek: number | null = null
  let dayOfMonth: number | null = null
  if (cadence === 'weekly' || cadence === 'biweekly') {
    const rawDow = r.dayOfWeek === undefined || r.dayOfWeek === '' || r.dayOfWeek === null
      ? dayOfWeekYmd(startsOn)
      : Number(r.dayOfWeek)
    if (!Number.isInteger(rawDow) || rawDow < 0 || rawDow > 6) return { error: 'Choose a day of the week.' }
    dayOfWeek = rawDow
  } else if (cadence === 'monthly') {
    const rawDom = r.dayOfMonth === undefined || r.dayOfMonth === '' || r.dayOfMonth === null
      ? Math.min(28, Number(startsOn.slice(8, 10)))
      : Number(r.dayOfMonth)
    if (!Number.isInteger(rawDom) || rawDom < 1 || rawDom > 28) return { error: 'Choose a day of the month between 1 and 28.' }
    dayOfMonth = rawDom
  }

  const endMode: EndMode = isEndMode(r.endMode) ? r.endMode : 'never'
  let endsOn: string | null = null
  let maxOccurrences: number | null = null
  if (endMode === 'date') {
    if (!isValidYmd(r.endsOn)) return { error: 'Choose a valid end date.' }
    if (r.endsOn < startsOn) return { error: 'The end date must be on or after the start date.' }
    endsOn = r.endsOn
  } else if (endMode === 'count') {
    const n = Number(r.maxOccurrences)
    if (!Number.isInteger(n) || n < 1 || n > MAX_OCCURRENCES_CAP) {
      return { error: `Choose between 1 and ${MAX_OCCURRENCES_CAP} cycles.` }
    }
    maxOccurrences = n
  }

  const defaultDays = isCategory(taskMeta.category) && isComplexity(taskMeta.complexity)
    ? taskDefaults(taskMeta.category, taskMeta.complexity).deadlineDays
    : 3
  const rawDuration = r.durationDays === undefined || r.durationDays === '' || r.durationDays === null
    ? defaultDays
    : Number(r.durationDays)
  if (!Number.isInteger(rawDuration) || rawDuration < DURATION_DAYS_MIN || rawDuration > DURATION_DAYS_MAX) {
    return { error: `Deadline window per cycle must be between ${DURATION_DAYS_MIN} and ${DURATION_DAYS_MAX} days.` }
  }

  const assignmentMode: RecurringAssignmentMode =
    r.assignmentMode === 'one' || r.assignmentMode === 'group' || r.assignmentMode === 'draft'
      ? r.assignmentMode
      : 'draft'
  const rawIds = Array.isArray(r.assigneeIds) ? r.assigneeIds : []
  const assigneeIds = [...new Set(rawIds.filter((x): x is string => typeof x === 'string' && UUID.test(x)))]
  if (assignmentMode === 'one' && assigneeIds.length !== 1) return { error: 'Choose a member to assign each cycle to.' }
  if (assignmentMode === 'group' && assigneeIds.length < 2) return { error: 'Choose at least 2 members for a recurring group task.' }
  if (assignmentMode === 'group' && assigneeIds.length > 25) return { error: 'A recurring group task can include at most 25 people.' }

  const skipAutomatedReview = r.skipAutomatedReview !== false

  const nextRun = firstOccurrenceOnOrAfter(
    { cadence, day_of_week: dayOfWeek, day_of_month: dayOfMonth, starts_on: startsOn, ends_on: endsOn, max_occurrences: maxOccurrences, occurrences_created: 0 },
    startsOn,
  )
  if (!nextRun) return { error: 'No scheduled dates fall within that start and end range.' }

  return {
    options: {
      cadence,
      day_of_week: dayOfWeek,
      day_of_month: dayOfMonth,
      starts_on: startsOn,
      ends_on: endsOn,
      max_occurrences: maxOccurrences,
      duration_days: rawDuration,
      assignment_mode: assignmentMode,
      assignee_ids: assignmentMode === 'draft' ? [] : assigneeIds,
      skip_automated_review: skipAutomatedReview,
      next_run_on: nextRun,
    },
  }
}

export interface LifecycleTask {
  recurring_task_id?: string | null
  status: string
  deadline_at: string | null
  extended_deadline_at?: string | null
  extension_status?: string | null
  grace_reminder_sent_at?: string | null
  grace_draft_at?: string | null
  expires_at?: string | null
}

export type RecurringLifecycleAction = 'none' | 'send_reminder' | 'move_to_draft' | 'auto_delete'

/**
 * Evaluates what lifecycle transition (if any) an unsubmitted recurring task
 * requires right now:
 *   1. After deadline passes -> send 24-hour reminder
 *   2. 24h after deadline (and ≥ 24h after reminder) -> save as 3-day draft
 *   3. 3 days in draft with still no submission -> auto-delete
 * Never acts on non-recurring tasks or tasks that have any submission.
 */
export function evaluateRecurringTaskLifecycle(
  task: LifecycleTask,
  hasSubmission: boolean,
  now: Date = new Date(),
): RecurringLifecycleAction {
  if (!task.recurring_task_id || hasSubmission || task.status !== 'assigned') return 'none'
  const nowMs = now.getTime()

  // Already in 3-day draft grace window: auto-delete once expires_at passes.
  if (task.grace_draft_at) {
    if (task.expires_at && nowMs >= new Date(task.expires_at).getTime()) return 'auto_delete'
    return 'none'
  }

  const effectiveDueIso =
    task.extension_status === 'granted' && task.extended_deadline_at
      ? task.extended_deadline_at
      : task.deadline_at
  if (!effectiveDueIso) return 'none'
  const dueMs = new Date(effectiveDueIso).getTime()
  if (Number.isNaN(dueMs) || nowMs < dueMs) return 'none'

  // Deadline has passed with nothing submitted: first send the 24h reminder.
  if (!task.grace_reminder_sent_at) return 'send_reminder'

  // Give a full 24 hours after both the deadline and the reminder email before moving to draft.
  const reminderMs = new Date(task.grace_reminder_sent_at).getTime()
  const graceEndsMs = Math.max(dueMs, reminderMs) + REMINDER_GRACE_HOURS * 60 * 60_000
  if (nowMs >= graceEndsMs) return 'move_to_draft'

  return 'none'
}

/** True when a recurring task is currently in its 3-day draft window before auto-deletion. */
export function isRecurringGraceDraft(task: Pick<LifecycleTask, 'recurring_task_id' | 'status' | 'grace_draft_at'>): boolean {
  return !!task.recurring_task_id && task.status === 'assigned' && !!task.grace_draft_at
}

/** Human-readable countdown for a recurring task in its 3-day draft window. */
export function draftExpiryLabel(expiresAt: string | null | undefined, now: Date = new Date()): string {
  if (!expiresAt) return 'Expires in 3 days'
  const diffMs = new Date(expiresAt).getTime() - now.getTime()
  if (diffMs <= 0) return 'Removing soon'
  const hours = Math.max(1, Math.round(diffMs / 3_600_000))
  if (hours >= 48) return `Removes in ${Math.round(hours / 24)} days`
  return `Removes in ${hours} hour${hours === 1 ? '' : 's'}`
}

/** Human-readable summary of a schedule's cadence and range for lists and banners. */
export function describeSchedule(s: {
  cadence: Cadence
  day_of_week: number | null
  day_of_month: number | null
  starts_on: string
  ends_on: string | null
  max_occurrences: number | null
}): string {
  let freq: string = CADENCE_LABELS[s.cadence]
  if ((s.cadence === 'weekly' || s.cadence === 'biweekly') && s.day_of_week !== null) {
    freq = `${freq} on ${DAY_OF_WEEK_LABELS[s.day_of_week]}s`
  } else if (s.cadence === 'monthly' && s.day_of_month !== null) {
    freq = `Monthly on day ${s.day_of_month}`
  }
  const range = s.ends_on
    ? `${s.starts_on} → ${s.ends_on}`
    : s.max_occurrences !== null
      ? `From ${s.starts_on} (${s.max_occurrences} cycles)`
      : `From ${s.starts_on} (ongoing)`
  return `${freq} · ${range}`
}
