import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { dashboardUrl, notifyMember } from '@/lib/contributions/notify'
import { isContributorRole } from '@/lib/contributions/auth'
import {
  recurringDeadlineReminderEmail,
  recurringMovedToDraftEmail,
  taskAssignedEmail,
  type EmailContent,
} from '@nextrium/contributions-core/emails'
import {
  DRAFT_RETENTION_DAYS,
  cycleDeadlineAt,
  evaluateRecurringTaskLifecycle,
  formatOccurrenceTitle,
  isScheduleDue,
  lagosToday,
  nextOccurrenceAfter,
} from '@nextrium/contributions-core/recurring'
import type { RecurringTask } from '@nextrium/supabase/database'

export interface RecurringDeps {
  db: any
  notify: (userId: string, content: EmailContent) => Promise<boolean>
  link: (path: string) => string
  log: (entry: {
    action: string
    targetType: string
    targetId: string
    details?: Record<string, unknown>
    actorId?: string
    actorEmail?: string
  }) => Promise<void>
}

export function liveRecurringDeps(): RecurringDeps {
  return {
    db: createServiceClient() as any,
    notify: notifyMember,
    link: dashboardUrl,
    log: logActivity,
  }
}

export interface SpawnResult {
  outcome: 'spawned' | 'already_spawned' | 'failed'
  taskIds: string[]
  assignedCount: number
}

/** Active onboarded contributor subset of `ids`. */
async function activeMemberIds(db: any, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const { data } = await db
    .from('dashboard_users')
    .select('user_id, role, archived, onboarding_completed_at')
    .in('user_id', ids)
  const eligible = new Set(
    ((data ?? []) as { user_id: string; role: string; archived: boolean; onboarding_completed_at: string | null }[])
      .filter((r) => isContributorRole(r.role) && !r.archived && !!r.onboarding_completed_at)
      .map((r) => r.user_id),
  )
  return ids.filter((id) => eligible.has(id))
}

/**
 * Spawns one cycle of a recurring schedule into normal `tasks` rows.
 * Deduplicated atomically via `recurring_task_runs (recurring_task_id, occurrence_date)`
 * so retries or concurrent cron runs can never create duplicate tasks or emails.
 */
export async function spawnScheduleOccurrence(
  deps: RecurringDeps,
  schedule: RecurringTask,
  occurrenceYmd: string,
  actor?: { userId?: string | null; email?: string | null },
  now: Date = new Date(),
): Promise<SpawnResult> {
  // Claim this occurrence date first.
  const { error: claimError } = await deps.db
    .from('recurring_task_runs')
    .insert({ recurring_task_id: schedule.id, occurrence_date: occurrenceYmd, outcome: 'spawned', task_count: 0 })
  if (claimError?.code === '23505') return { outcome: 'already_spawned', taskIds: [], assignedCount: 0 }
  if (claimError) {
    console.error('[recurring] claim failed:', claimError.message)
    return { outcome: 'failed', taskIds: [], assignedCount: 0 }
  }

  const title = formatOccurrenceTitle(schedule.title, occurrenceYmd)
  const deadlineIso = cycleDeadlineAt(occurrenceYmd, schedule.duration_days, now)
  const activeIds = schedule.assignment_mode === 'draft'
    ? []
    : await activeMemberIds(deps.db, schedule.assignee_ids ?? [])

  const targetCount = Math.max(1, activeIds.length)
  const groupId = activeIds.length >= 2 ? randomUUID() : null
  const baseRow = {
    title,
    description: schedule.description,
    category: schedule.category,
    complexity: schedule.complexity,
    point_range_min: schedule.point_range_min,
    point_range_max: schedule.point_range_max,
    deadline_days: schedule.duration_days,
    links: schedule.links ?? [],
    status: 'draft' as const,
    created_by: schedule.created_by,
    group_id: groupId,
    skip_automated_review: schedule.skip_automated_review,
    recurring_task_id: schedule.id,
    occurrence_date: occurrenceYmd,
  }

  const { data: created, error: createError } = await deps.db
    .from('tasks')
    .insert(Array.from({ length: targetCount }, () => ({ ...baseRow })))
    .select('id')
  if (createError || !created || created.length !== targetCount) {
    console.error('[recurring] task insert failed:', createError?.message)
    await deps.db.from('recurring_task_runs').delete().eq('recurring_task_id', schedule.id).eq('occurrence_date', occurrenceYmd)
    return { outcome: 'failed', taskIds: [], assignedCount: 0 }
  }

  const taskIds: string[] = created.map((r: { id: string }) => r.id)
  const actorId = actor?.userId ?? schedule.created_by ?? activeIds[0] ?? null
  let assignedCount = 0

  for (let i = 0; i < activeIds.length; i++) {
    const taskId = taskIds[i]
    const assigneeId = activeIds[i]
    const { data: assignedRow, error: assignErr } = await deps.db.rpc('assign_contribution_task', {
      p_task_id: taskId,
      p_assignee: assigneeId,
      p_actor: actorId ?? assigneeId,
      p_deadline_at: deadlineIso,
    })
    if (assignErr) {
      console.error('[recurring] assign failed:', assignErr.message)
      continue
    }
    assignedCount++
    await deps.notify(
      assigneeId,
      taskAssignedEmail({
        taskTitle: title,
        points: `${schedule.point_range_min}–${schedule.point_range_max}`,
        deadlineAt: assignedRow?.deadline_at ?? deadlineIso,
        url: deps.link(`/my-tasks/${taskId}`),
      }),
    )
  }

  await deps.db
    .from('recurring_task_runs')
    .update({ task_count: taskIds.length })
    .eq('recurring_task_id', schedule.id)
    .eq('occurrence_date', occurrenceYmd)

  const nextCount = (schedule.occurrences_created ?? 0) + 1
  const nextRun = nextOccurrenceAfter(
    {
      cadence: schedule.cadence,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      starts_on: schedule.starts_on,
      ends_on: schedule.ends_on,
      max_occurrences: schedule.max_occurrences,
      occurrences_created: nextCount,
    },
    occurrenceYmd,
  )
  await deps.db
    .from('recurring_tasks')
    .update({
      occurrences_created: nextCount,
      last_run_on: occurrenceYmd,
      next_run_on: nextRun,
      status: nextRun ? 'active' : 'completed',
    })
    .eq('id', schedule.id)

  await deps.log({
    action: 'recurring_task_spawned',
    targetType: 'recurring_task',
    targetId: schedule.id,
    details: { title, occurrenceDate: occurrenceYmd, tasks: taskIds.length, assigned: assignedCount },
    actorId: actor?.userId ?? undefined,
    actorEmail: actor?.email ?? undefined,
  })

  return { outcome: 'spawned', taskIds, assignedCount }
}

/** Runs all active recurring schedules due on or before today (Africa/Lagos). */
export async function runDueRecurringSchedules(
  deps: RecurringDeps,
  now: Date = new Date(),
): Promise<{ checked: number; spawned: number; skipped: number; failed: number }> {
  const tally = { checked: 0, spawned: 0, skipped: 0, failed: 0 }
  const today = lagosToday(now)
  const { data, error } = await deps.db
    .from('recurring_tasks')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_on', today)
  if (error) {
    // Graceful no-op if the recurring_tasks table hasn't been created yet.
    if (error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('[recurring] load due schedules failed:', error.message)
    }
    return tally
  }

  for (const s of (data ?? []) as RecurringTask[]) {
    tally.checked++
    if (!isScheduleDue(s, today) || !s.next_run_on) {
      tally.skipped++
      continue
    }
    try {
      const res = await spawnScheduleOccurrence(deps, s, s.next_run_on, undefined, now)
      if (res.outcome === 'spawned') tally.spawned++
      else if (res.outcome === 'already_spawned') tally.skipped++
      else tally.failed++
    } catch (err) {
      console.error('[recurring] schedule spawn error:', err instanceof Error ? err.message : err)
      tally.failed++
    }
  }
  return tally
}

/**
 * Enforces the dedicated recurring-task lifecycle on unsubmitted cycles:
 *   1. After deadline -> 24-hour reminder email
 *   2. 24h after deadline & reminder -> saved as 3-day draft (visible to contributor & reviewers)
 *   3. 3 days in draft with zero submissions -> auto-deleted safely
 * Never touches non-recurring tasks or any task that has a submission.
 */
export async function processRecurringTaskLifecycle(
  deps: RecurringDeps,
  now: Date = new Date(),
): Promise<{ checked: number; reminded: number; movedToDraft: number; deleted: number }> {
  const tally = { checked: 0, reminded: 0, movedToDraft: 0, deleted: 0 }
  const { data: tasks, error } = await deps.db
    .from('tasks')
    .select('id, title, assigned_to, status, deadline_at, extended_deadline_at, extension_status, recurring_task_id, occurrence_date, grace_reminder_sent_at, grace_draft_at, expires_at')
    .eq('status', 'assigned')
    .not('recurring_task_id', 'is', null)
  if (error) {
    if (error.code !== '42703' && error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('[recurring] lifecycle query failed:', error.message)
    }
    return tally
  }

  const nowIso = now.toISOString()
  for (const t of (tasks ?? []) as any[]) {
    tally.checked++
    const { count } = await deps.db
      .from('contributions')
      .select('id', { count: 'exact', head: true })
      .eq('task_id', t.id)
    const hasSubmission = (count ?? 0) > 0
    const action = evaluateRecurringTaskLifecycle(t, hasSubmission, now)
    if (action === 'none') continue

    if (action === 'send_reminder') {
      const { data: updated, error: upErr } = await deps.db
        .from('tasks')
        .update({ grace_reminder_sent_at: nowIso })
        .eq('id', t.id)
        .eq('status', 'assigned')
        .is('grace_reminder_sent_at', null)
        .select('id')
      if (upErr || !updated || updated.length === 0) continue
      if (t.assigned_to) {
        const dueIso = t.extension_status === 'granted' && t.extended_deadline_at ? t.extended_deadline_at : t.deadline_at
        await deps.notify(
          t.assigned_to,
          recurringDeadlineReminderEmail({ taskTitle: t.title, deadlineAt: dueIso, url: deps.link(`/my-tasks/${t.id}`) }),
        )
      }
      tally.reminded++
    } else if (action === 'move_to_draft') {
      const expiresAt = new Date(now.getTime() + DRAFT_RETENTION_DAYS * 24 * 60 * 60_000).toISOString()
      const { data: updated, error: upErr } = await deps.db
        .from('tasks')
        .update({ grace_draft_at: nowIso, expires_at: expiresAt })
        .eq('id', t.id)
        .eq('status', 'assigned')
        .is('grace_draft_at', null)
        .select('id')
      if (upErr || !updated || updated.length === 0) continue
      if (t.assigned_to) {
        await deps.notify(
          t.assigned_to,
          recurringMovedToDraftEmail({ taskTitle: t.title, expiresAt, url: deps.link(`/my-tasks/${t.id}`) }),
        )
      }
      await deps.log({
        action: 'recurring_task_moved_to_draft',
        targetType: 'task',
        targetId: t.id,
        details: { title: t.title, recurringTaskId: t.recurring_task_id, expiresAt },
      })
      tally.movedToDraft++
    } else if (action === 'auto_delete') {
      // Double-check zero submissions right before deleting.
      const { count: recheck } = await deps.db
        .from('contributions')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', t.id)
      if ((recheck ?? 0) > 0) continue

      const { data: gone, error: delErr } = await deps.db
        .from('tasks')
        .delete()
        .eq('id', t.id)
        .eq('status', 'assigned')
        .not('recurring_task_id', 'is', null)
        .not('grace_draft_at', 'is', null)
        .select('id')
      if (delErr || !gone || gone.length === 0) continue

      await deps.log({
        action: 'recurring_task_expired_deleted',
        targetType: 'task',
        targetId: t.id,
        details: { title: t.title, recurringTaskId: t.recurring_task_id, occurrenceDate: t.occurrence_date },
      })

      // If no tasks remain for this schedule's occurrence date, mark the run row expired_deleted.
      if (t.recurring_task_id && t.occurrence_date) {
        const { count: remaining } = await deps.db
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('recurring_task_id', t.recurring_task_id)
          .eq('occurrence_date', t.occurrence_date)
        if ((remaining ?? 0) === 0) {
          await deps.db
            .from('recurring_task_runs')
            .update({ outcome: 'expired_deleted' })
            .eq('recurring_task_id', t.recurring_task_id)
            .eq('occurrence_date', t.occurrence_date)
        }
      }
      tally.deleted++
    }
  }

  return tally
}
