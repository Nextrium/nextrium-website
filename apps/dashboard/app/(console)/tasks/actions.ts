'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { isContributorRole, requireStaff, type Caller } from '@/lib/contributions/auth'
import { groupDeadline, groupOutcome, parseGroupAssignees } from '@/lib/contributions/groupRules'
import { getMemberDirectory } from '@/lib/contributions/members'
import { parseAssignment, parseTaskInput } from '@nextrium/contributions-core/taskInput'
import { describeDbError } from '@nextrium/contributions-core/errors'
import { extensionDecidedEmail, taskAssignedEmail } from '@nextrium/contributions-core/emails'
import { notifyMember, dashboardUrl } from '@/lib/contributions/notify'
import type { Task } from '@nextrium/supabase/database'

// The generated Database type doesn't satisfy supabase-js's schema shape
// (tables lack Relationships), so queries are cast like elsewhere in the
// codebase and results are typed explicitly.
const db = () => createServiceClient() as any

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

// Category and complexity set the point range and deadline, so they can only
// change while the task is still a draft.
const LOCKED_AFTER_ASSIGNMENT = ['category', 'complexity'] as const

export async function createTask(raw: unknown): Promise<Result<{ id: string }>> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }

  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const { data, error }: { data: Pick<Task, 'id'> | null; error: any } = await db()
    .from('tasks')
    .insert({ ...parsed.fields, status: 'draft', created_by: auth.caller.userId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[tasks] create failed:', error?.message)
    return { ok: false, error: 'Could not create the task.' }
  }

  await logActivity({
    action: 'task_created', targetType: 'task', targetId: data.id,
    details: { title: parsed.fields.title, category: parsed.fields.category },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks')
  return { ok: true, id: data.id }
}

export async function updateTask(taskId: string, raw: unknown): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const supabase = db()
  const { data: task }: { data: Pick<Task, 'status' | 'category' | 'complexity'> | null } = await supabase
    .from('tasks').select('status, category, complexity').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  if (task.status === 'completed' || task.status === 'cancelled') {
    return { ok: false, error: 'Completed or cancelled tasks cannot be edited.' }
  }
  if (task.status !== 'draft' && LOCKED_AFTER_ASSIGNMENT.some((k) => task[k] !== parsed.fields[k])) {
    return { ok: false, error: 'Category and complexity can only change while the task is a draft.' }
  }

  // Only save if the status is still what was checked above, so a task
  // assigned in the meantime can't have its category or complexity changed.
  const { data: saved, error } = await supabase.from('tasks').update(parsed.fields)
    .eq('id', taskId).eq('status', task.status).select('id')
  if (error) {
    console.error('[tasks] update failed:', error.message)
    return { ok: false, error: 'Could not save the task.' }
  }
  if (!saved || saved.length === 0) return { ok: false, error: 'This task changed while you were editing. Reload and try again.' }

  await logActivity({
    action: 'task_updated', targetType: 'task', targetId: taskId,
    details: { title: parsed.fields.title },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}

/** Cancels a task that has no submission. Tasks with one go through review. */
export async function cancelTask(taskId: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const supabase = db()
  const { data: task }: { data: Pick<Task, 'status' | 'title'> | null } = await supabase
    .from('tasks').select('status, title').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  if (task.status === 'cancelled') return { ok: true }
  if (task.status !== 'draft' && task.status !== 'assigned') {
    return { ok: false, error: 'Only draft or assigned tasks can be cancelled.' }
  }
  const { count } = await supabase.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', taskId)
  if (count) return { ok: false, error: 'This task has a submission. Reject it from the review queue instead.' }

  const { error } = await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', taskId).in('status', ['draft', 'assigned'])
  if (error) {
    console.error('[tasks] cancel failed:', error.message)
    return { ok: false, error: 'Could not cancel the task.' }
  }

  await logActivity({
    action: 'task_cancelled', targetType: 'task', targetId: taskId, details: { title: task.title },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Assigns (or reassigns) a task to an active member. The database function
 * enforces the rules: draft/assigned task, no submission yet, assignee is an
 * onboarded, non-archived member, deadline in the future.
 */
// Assigns through the database function (which enforces the rules: draft or
// assigned task, no submission, active onboarded assignee, future deadline),
// then logs and emails the assignee once.
async function assignAndNotify(taskId: string, assigneeId: string, deadline: string | null, caller: { userId: string; email: string | null }): Promise<Result> {
  const { data, error } = await db().rpc('assign_contribution_task', {
    p_task_id: taskId, p_assignee: assigneeId, p_actor: caller.userId, p_deadline_at: deadline,
  })
  if (error) return { ok: false, error: describeDbError(error, 'Could not assign the task.') }

  await logActivity({
    action: 'task_assigned', targetType: 'task', targetId: taskId,
    details: { title: data?.title, assignee: assigneeId, deadline: data?.deadline_at },
    actorId: caller.userId, actorEmail: caller.email ?? undefined,
  })
  await notifyMember(assigneeId, taskAssignedEmail({
    taskTitle: data?.title ?? 'a task',
    points: `${data?.point_range_min}–${data?.point_range_max}`,
    deadlineAt: data?.deadline_at ?? null,
    url: dashboardUrl(`/my-tasks/${taskId}`),
  }))
  return { ok: true }
}

/** Assigns (or reassigns) an existing task to an active member. */
export async function assignTask(taskId: string, assigneeId: string, deadlineAt?: string | null): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }
  const assignment = parseAssignment(assigneeId, deadlineAt)
  if ('error' in assignment) return { ok: false, error: assignment.error }

  // A copy in a group can't go to someone who already holds another copy of it.
  const { data: task }: { data: Pick<Task, 'group_id'> | null } = await db().from('tasks').select('group_id').eq('id', taskId).maybeSingle()
  if (task?.group_id) {
    const { count } = await db().from('tasks').select('id', { count: 'exact', head: true })
      .eq('group_id', task.group_id).eq('assigned_to', assignment.assigneeId).neq('id', taskId).neq('status', 'cancelled')
    if (count) return { ok: false, error: 'This person already has a copy of this task.' }
  }

  const res = await assignAndNotify(taskId, assignment.assigneeId, assignment.deadline, auth.caller)
  if (!res.ok) return res
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}

/**
 * Creates a task and assigns it in one step. Everything is checked before the
 * task is written, including that the assignee is active, so a bad choice
 * never leaves a stray draft. If assignment still fails afterwards (for
 * example the person was archived a moment ago), the task stays a draft and
 * the error says so, with its id so the editor can open it.
 */
export async function createAndAssignTask(raw: unknown, assigneeId: string, deadlineAt?: string | null): Promise<Result<{ id: string }> | { ok: false; error: string; draftId: string }> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }

  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const assignment = parseAssignment(assigneeId, deadlineAt)
  if ('error' in assignment) return { ok: false, error: assignment.error }

  const { data: person } = await db().from('dashboard_users')
    .select('archived, onboarding_completed_at').eq('user_id', assignment.assigneeId).maybeSingle()
  if (!person || person.archived || !person.onboarding_completed_at) {
    return { ok: false, error: 'Tasks can only be assigned to active members (onboarded and not archived).' }
  }

  const { data, error }: { data: Pick<Task, 'id'> | null; error: any } = await db()
    .from('tasks')
    .insert({ ...parsed.fields, status: 'draft', created_by: auth.caller.userId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[tasks] create failed:', error?.message)
    return { ok: false, error: 'Could not create the task.' }
  }
  await logActivity({
    action: 'task_created', targetType: 'task', targetId: data.id,
    details: { title: parsed.fields.title, category: parsed.fields.category },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks')

  const assigned = await assignAndNotify(data.id, assignment.assigneeId, assignment.deadline, auth.caller)
  if (!assigned.ok) {
    return { ok: false, error: `The task was saved as a draft but could not be assigned: ${assigned.error}`, draftId: data.id }
  }
  revalidatePath(`/tasks/${data.id}`)
  return { ok: true, id: data.id }
}

// ── One task for several people ─────────────────────────────────────────────
// Each person gets their own copy (same brief, same deadline), linked by a
// group id. Copies are ordinary one-owner tasks, so every existing check
// (who can see it, submit to it, extend it) applies to each one unchanged.

type GroupResult = { ok: true; firstId: string; assigned: number; total: number; message: string } | { ok: false; error: string }

/** The subset of ids that can take tasks right now: a contributor role, onboarded, not archived. */
async function eligibleMembers(ids: string[]): Promise<Set<string>> {
  const { data } = await db().from('dashboard_users')
    .select('user_id, role, archived, onboarding_completed_at').in('user_id', ids)
  const rows: { user_id: string; role: string; archived: boolean; onboarding_completed_at: string | null }[] = data ?? []
  return new Set(rows.filter((r) => isContributorRole(r.role) && !r.archived && !!r.onboarding_completed_at).map((r) => r.user_id))
}

/** Assigns each copy to its person through the usual database function, one at a time. */
async function assignCopies(copyIds: string[], people: string[], deadline: string, caller: Caller) {
  const failed: { id: string; error: string }[] = []
  for (let i = 0; i < people.length; i++) {
    const res = await assignAndNotify(copyIds[i], people[i], deadline, caller)
    if (!res.ok) failed.push({ id: people[i], error: res.error })
  }
  if (failed.length === 0) return { assigned: people.length, failed: [] }
  const names = new Map((await getMemberDirectory()).map((m) => [m.userId, m.name]))
  return { assigned: people.length - failed.length, failed: failed.map((f) => ({ name: names.get(f.id) ?? 'A member', error: f.error })) }
}

/** Checks the people and the deadline shared by every way of making a group. */
async function checkGroup(assigneeIds: unknown, deadlineAt: unknown): Promise<{ ids: string[]; chosen: string | null } | { error: string }> {
  const group = parseGroupAssignees(assigneeIds)
  if ('error' in group) return group
  const when = parseAssignment(group.ids[0], deadlineAt)
  if ('error' in when) return when
  const eligible = await eligibleMembers(group.ids)
  const missing = group.ids.filter((id) => !eligible.has(id)).length
  if (missing > 0) {
    return { error: `${missing} of the people chosen can't take tasks right now (not onboarded or archived). Reload and choose again.` }
  }
  return { ids: group.ids, chosen: when.deadline }
}

/** Creates a task and gives a copy of it to each chosen person, all with the same deadline. */
export async function createTaskForGroup(raw: unknown, assigneeIds: unknown, deadlineAt?: string | null): Promise<GroupResult> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const group = await checkGroup(assigneeIds, deadlineAt)
  if ('error' in group) return { ok: false, error: group.error }

  const groupId = randomUUID()
  const { data, error }: { data: Pick<Task, 'id'>[] | null; error: any } = await db()
    .from('tasks')
    .insert(group.ids.map(() => ({ ...parsed.fields, status: 'draft', created_by: auth.caller.userId, group_id: groupId })))
    .select('id')
  if (error || !data || data.length !== group.ids.length) {
    console.error('[tasks] group create failed:', error?.message)
    return { ok: false, error: 'Could not create the task.' }
  }
  await logActivity({
    action: 'task_group_created', targetType: 'task', targetId: data[0].id,
    details: { title: parsed.fields.title, category: parsed.fields.category, group: groupId, people: group.ids.length },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })

  const deadline = groupDeadline(group.chosen, parsed.fields.deadline_days)
  const outcome = await assignCopies(data.map((r) => r.id), group.ids, deadline, auth.caller)
  revalidatePath('/tasks')
  if (outcome.assigned === 0) return { ok: false, error: `The task was saved but no one could be assigned. ${groupOutcome(0, outcome.failed)}` }
  return { ok: true, firstId: data[0].id, assigned: outcome.assigned, total: group.ids.length, message: groupOutcome(outcome.assigned, outcome.failed) }
}

/** Gives a copy of an existing draft to each chosen person. The draft itself becomes the first copy. */
export async function assignDraftToGroup(taskId: string, assigneeIds: unknown, deadlineAt?: string | null): Promise<GroupResult> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }
  const group = await checkGroup(assigneeIds, deadlineAt)
  if ('error' in group) return { ok: false, error: group.error }

  const supabase = db()
  const { data: task }: { data: Task | null } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  if (task.status !== 'draft' || task.group_id) return { ok: false, error: 'Only a draft that is not already shared can be given to several people.' }
  const { count } = await supabase.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', taskId)
  if (count) return { ok: false, error: 'This task has a submission, so it cannot be shared.' }

  // Mark the draft as the first copy, only if it is still an unshared draft.
  const groupId = randomUUID()
  const { data: claimed } = await supabase.from('tasks').update({ group_id: groupId })
    .eq('id', taskId).eq('status', 'draft').is('group_id', null).select('id')
  if (!claimed || claimed.length === 0) return { ok: false, error: 'This task changed while you were editing. Reload and try again.' }

  const copy = {
    title: task.title, description: task.description, category: task.category, complexity: task.complexity,
    point_range_min: task.point_range_min, point_range_max: task.point_range_max, deadline_days: task.deadline_days,
    links: task.links, created_by: task.created_by, status: 'draft', group_id: groupId,
  }
  const { data: extra, error } = await supabase.from('tasks').insert(group.ids.slice(1).map(() => copy)).select('id')
  if (error || !extra || extra.length !== group.ids.length - 1) {
    console.error('[tasks] group copies failed:', error?.message)
    // Put the draft back as it was, so nothing is left half-shared.
    await supabase.from('tasks').update({ group_id: null }).eq('id', taskId).eq('group_id', groupId).eq('status', 'draft')
    return { ok: false, error: 'Could not share the task.' }
  }
  await logActivity({
    action: 'task_group_created', targetType: 'task', targetId: taskId,
    details: { title: task.title, category: task.category, group: groupId, people: group.ids.length },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })

  const deadline = groupDeadline(group.chosen, task.deadline_days)
  const outcome = await assignCopies([taskId, ...extra.map((r: { id: string }) => r.id)], group.ids, deadline, auth.caller)
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  if (outcome.assigned === 0) return { ok: false, error: `No one could be assigned. ${groupOutcome(0, outcome.failed)}` }
  return { ok: true, firstId: taskId, assigned: outcome.assigned, total: group.ids.length, message: groupOutcome(outcome.assigned, outcome.failed) }
}

/** Returns an assigned task (with no submission) to draft. */
export async function unassignTask(taskId: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const { data, error } = await db().rpc('unassign_contribution_task', { p_task_id: taskId })
  if (error) return { ok: false, error: describeDbError(error, 'Could not unassign the task.') }

  await logActivity({
    action: 'task_unassigned', targetType: 'task', targetId: taskId, details: { title: data?.title },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}

/** Grants or denies a member's pending extension request. */
export async function decideExtension(taskId: string, approve: boolean): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const { data, error } = await db().rpc('decide_task_extension', { p_task_id: taskId, p_approve: approve === true })
  if (error) return { ok: false, error: describeDbError(error, 'Could not update the extension.') }

  await logActivity({
    action: approve ? 'task_extension_granted' : 'task_extension_denied', targetType: 'task', targetId: taskId,
    details: { title: data?.title, extendedTo: data?.extended_deadline_at },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  await notifyMember(data?.assigned_to, extensionDecidedEmail({
    taskTitle: data?.title ?? 'your task',
    granted: approve === true,
    deadlineAt: (approve ? data?.extended_deadline_at : data?.deadline_at) ?? null,
    url: dashboardUrl(`/my-tasks/${taskId}`),
  }))
  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  return { ok: true }
}
