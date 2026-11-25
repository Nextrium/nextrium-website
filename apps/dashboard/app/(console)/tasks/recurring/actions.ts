'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { isContributorRole, requireStaff } from '@/lib/contributions/auth'
import { liveRecurringDeps, spawnScheduleOccurrence } from '@/lib/contributions/recurringServer'
import { parseTaskInput } from '@nextrium/contributions-core/taskInput'
import {
  firstOccurrenceOnOrAfter,
  isScheduleStatus,
  lagosToday,
  nextOccurrenceAfter,
  parseRecurringOptions,
  type ScheduleStatus,
} from '@nextrium/contributions-core/recurring'
import type { RecurringTask } from '@nextrium/supabase/database'

const db = () => createServiceClient() as any
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

async function verifyEligibleAssignees(ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null
  const { data } = await db()
    .from('dashboard_users')
    .select('user_id, role, archived, onboarding_completed_at')
    .in('user_id', ids)
  const ok = new Set(
    ((data ?? []) as { user_id: string; role: string; archived: boolean; onboarding_completed_at: string | null }[])
      .filter((r) => isContributorRole(r.role) && !r.archived && !!r.onboarding_completed_at)
      .map((r) => r.user_id),
  )
  const bad = ids.filter((id) => !ok.has(id)).length
  if (bad > 0) return `${bad} of the chosen people cannot take tasks right now (archived or not onboarded).`
  return null
}

/**
 * Creates a recurring task schedule from the normal New Task flow.
 * If the first scheduled occurrence falls on or before today (Africa/Lagos),
 * Cycle 1 is created and assigned immediately on save.
 */
export async function createRecurringTask(
  taskRaw: unknown,
  scheduleRaw: unknown,
): Promise<Result<{ id: string; spawnedNow: number }>> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }

  const parsedTask = parseTaskInput(taskRaw)
  if ('error' in parsedTask) return { ok: false, error: parsedTask.error }
  const today = lagosToday()
  const parsedSched = parseRecurringOptions(scheduleRaw, parsedTask.fields, today)
  if ('error' in parsedSched) return { ok: false, error: parsedSched.error }

  const o = parsedSched.options
  const eligibilityError = await verifyEligibleAssignees(o.assignee_ids)
  if (eligibilityError) return { ok: false, error: eligibilityError }

  const f = parsedTask.fields
  const { data: created, error }: { data: RecurringTask | null; error: any } = await db()
    .from('recurring_tasks')
    .insert({
      title: f.title,
      description: f.description,
      category: f.category,
      complexity: f.complexity,
      point_range_min: f.point_range_min,
      point_range_max: f.point_range_max,
      duration_days: o.duration_days,
      links: f.links,
      cadence: o.cadence,
      day_of_week: o.day_of_week,
      day_of_month: o.day_of_month,
      starts_on: o.starts_on,
      ends_on: o.ends_on,
      max_occurrences: o.max_occurrences,
      occurrences_created: 0,
      next_run_on: o.next_run_on,
      last_run_on: null,
      assignment_mode: o.assignment_mode,
      assignee_ids: o.assignee_ids,
      skip_automated_review: o.skip_automated_review,
      status: 'active',
      created_by: auth.caller.userId,
    })
    .select('*')
    .single()
  if (error || !created) {
    console.error('[recurring] create failed:', error?.message)
    return { ok: false, error: 'Could not create the recurring schedule.' }
  }

  await logActivity({
    action: 'recurring_task_created',
    targetType: 'recurring_task',
    targetId: created.id,
    details: { title: f.title, cadence: o.cadence, startsOn: o.starts_on, endsOn: o.ends_on, directReview: o.skip_automated_review },
    actorId: auth.caller.userId,
    actorEmail: auth.caller.email ?? undefined,
  })

  // Create Cycle 1 immediately if the start/first occurrence is today (or earlier).
  let spawnedNow = 0
  if (created.next_run_on && created.next_run_on <= today) {
    const res = await spawnScheduleOccurrence(liveRecurringDeps(), created, created.next_run_on, auth.caller)
    if (res.outcome === 'spawned') spawnedNow = res.taskIds.length
  }

  revalidatePath('/tasks')
  revalidatePath('/tasks/recurring')
  revalidatePath('/my-tasks')
  return { ok: true, id: created.id, spawnedNow }
}

/** Updates a recurring schedule for future cycles only (already-created tasks stay unchanged). */
export async function updateRecurringTask(
  scheduleId: string,
  taskRaw: unknown,
  scheduleRaw: unknown,
): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(scheduleId)) return { ok: false, error: 'That recurring schedule could not be found.' }

  const { data: existing }: { data: RecurringTask | null } = await db()
    .from('recurring_tasks').select('*').eq('id', scheduleId).maybeSingle()
  if (!existing) return { ok: false, error: 'That recurring schedule could not be found.' }

  const parsedTask = parseTaskInput(taskRaw)
  if ('error' in parsedTask) return { ok: false, error: parsedTask.error }
  const today = lagosToday()
  const parsedSched = parseRecurringOptions(scheduleRaw, parsedTask.fields, today)
  if ('error' in parsedSched) return { ok: false, error: parsedSched.error }

  const o = parsedSched.options
  const eligibilityError = await verifyEligibleAssignees(o.assignee_ids)
  if (eligibilityError) return { ok: false, error: eligibilityError }

  const spec = {
    cadence: o.cadence,
    day_of_week: o.day_of_week,
    day_of_month: o.day_of_month,
    starts_on: o.starts_on,
    ends_on: o.ends_on,
    max_occurrences: o.max_occurrences,
    occurrences_created: existing.occurrences_created ?? 0,
  }
  const nextRun = existing.last_run_on && existing.last_run_on >= today
    ? nextOccurrenceAfter(spec, existing.last_run_on)
    : firstOccurrenceOnOrAfter(spec, today)

  const f = parsedTask.fields
  const nextStatus: ScheduleStatus = !nextRun ? 'completed' : existing.status === 'completed' ? 'active' : existing.status
  const { error } = await db()
    .from('recurring_tasks')
    .update({
      title: f.title,
      description: f.description,
      category: f.category,
      complexity: f.complexity,
      point_range_min: f.point_range_min,
      point_range_max: f.point_range_max,
      duration_days: o.duration_days,
      links: f.links,
      cadence: o.cadence,
      day_of_week: o.day_of_week,
      day_of_month: o.day_of_month,
      starts_on: o.starts_on,
      ends_on: o.ends_on,
      max_occurrences: o.max_occurrences,
      next_run_on: nextRun,
      assignment_mode: o.assignment_mode,
      assignee_ids: o.assignee_ids,
      skip_automated_review: o.skip_automated_review,
      status: nextStatus,
    })
    .eq('id', scheduleId)
  if (error) {
    console.error('[recurring] update failed:', error.message)
    return { ok: false, error: 'Could not save the recurring schedule.' }
  }

  await logActivity({
    action: 'recurring_task_updated',
    targetType: 'recurring_task',
    targetId: scheduleId,
    details: { title: f.title, cadence: o.cadence, nextRun },
    actorId: auth.caller.userId,
    actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks/recurring')
  revalidatePath(`/tasks/recurring/${scheduleId}`)
  return { ok: true }
}

/** Pauses, resumes, or ends a recurring schedule. Resuming never back-spawns missed past dates. */
export async function setRecurringStatus(scheduleId: string, nextStatus: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(scheduleId) || !isScheduleStatus(nextStatus)) {
    return { ok: false, error: 'Invalid schedule update.' }
  }

  const { data: existing }: { data: RecurringTask | null } = await db()
    .from('recurring_tasks').select('*').eq('id', scheduleId).maybeSingle()
  if (!existing) return { ok: false, error: 'That recurring schedule could not be found.' }

  const patch: Record<string, unknown> = { status: nextStatus }
  if (nextStatus === 'active') {
    const today = lagosToday()
    const nextRun = existing.last_run_on && existing.last_run_on >= today
      ? nextOccurrenceAfter(existing, existing.last_run_on)
      : firstOccurrenceOnOrAfter(existing, today)
    if (!nextRun) return { ok: false, error: 'This schedule has no remaining dates in its range. Extend the end date or cycle limit to resume it.' }
    patch.next_run_on = nextRun
  } else if (nextStatus === 'completed') {
    patch.next_run_on = null
  }

  const { error } = await db().from('recurring_tasks').update(patch).eq('id', scheduleId)
  if (error) {
    console.error('[recurring] status update failed:', error.message)
    return { ok: false, error: 'Could not update the schedule status.' }
  }

  await logActivity({
    action: `recurring_task_${nextStatus}`,
    targetType: 'recurring_task',
    targetId: scheduleId,
    details: { title: existing.title },
    actorId: auth.caller.userId,
    actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks/recurring')
  revalidatePath(`/tasks/recurring/${scheduleId}`)
  return { ok: true }
}

/** Manually spawns the next scheduled cycle right away (useful for testing or starting a cycle early). */
export async function triggerNextRecurringCycle(scheduleId: string): Promise<Result<{ count: number }>> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(scheduleId)) return { ok: false, error: 'That recurring schedule could not be found.' }

  const { data: schedule }: { data: RecurringTask | null } = await db()
    .from('recurring_tasks').select('*').eq('id', scheduleId).maybeSingle()
  if (!schedule) return { ok: false, error: 'That recurring schedule could not be found.' }
  if (schedule.status !== 'active' || !schedule.next_run_on) {
    return { ok: false, error: 'Only active schedules with an upcoming date can spawn a cycle.' }
  }

  const res = await spawnScheduleOccurrence(liveRecurringDeps(), schedule, schedule.next_run_on, auth.caller)
  if (res.outcome === 'already_spawned') {
    return { ok: false, error: 'This cycle has already been created.' }
  }
  if (res.outcome === 'failed') {
    return { ok: false, error: 'Could not create the next cycle right now.' }
  }

  revalidatePath('/tasks')
  revalidatePath('/tasks/recurring')
  revalidatePath(`/tasks/recurring/${scheduleId}`)
  revalidatePath('/my-tasks')
  return { ok: true, count: res.taskIds.length }
}
