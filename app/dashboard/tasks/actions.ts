'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireStaff } from '@/lib/contributions/auth'
import { parseTaskInput } from '@/lib/contributions/taskInput'
import { describeDbError } from '@/lib/contributions/errors'
import { extensionDecidedEmail, taskAssignedEmail } from '@/lib/contributions/emails'
import { notifyMember, siteUrl } from '@/lib/contributions/notify'
import type { Task } from '@/lib/types/database'

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
  revalidatePath('/dashboard/tasks')
  return { ok: true, id: data.id }
}

export async function updateTask(taskId: string, raw: unknown): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }

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

  const { error } = await supabase.from('tasks').update(parsed.fields).eq('id', taskId)
  if (error) {
    console.error('[tasks] update failed:', error.message)
    return { ok: false, error: 'Could not save the task.' }
  }

  await logActivity({
    action: 'task_updated', targetType: 'task', targetId: taskId,
    details: { title: parsed.fields.title },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/tasks/${taskId}`)
  return { ok: true }
}

/** Cancels a task that has no submission. Tasks with one go through review. */
export async function cancelTask(taskId: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }

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
  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/tasks/${taskId}`)
  return { ok: true }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Assigns (or reassigns) a task to an active member. The database function
 * enforces the rules: draft/assigned task, no submission yet, assignee is an
 * onboarded, non-archived member, deadline in the future.
 */
export async function assignTask(taskId: string, assigneeId: string, deadlineAt?: string | null): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId) || !UUID.test(assigneeId)) return { ok: false, error: 'Choose a member to assign.' }
  let deadline: string | null = null
  if (deadlineAt) {
    const d = new Date(deadlineAt)
    if (Number.isNaN(d.getTime())) return { ok: false, error: 'That deadline is not a valid date.' }
    deadline = d.toISOString()
  }

  const { data, error } = await db().rpc('assign_contribution_task', {
    p_task_id: taskId, p_assignee: assigneeId, p_actor: auth.caller.userId, p_deadline_at: deadline,
  })
  if (error) return { ok: false, error: describeDbError(error, 'Could not assign the task.') }

  await logActivity({
    action: 'task_assigned', targetType: 'task', targetId: taskId,
    details: { title: data?.title, assignee: assigneeId, deadline: data?.deadline_at },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  await notifyMember(assigneeId, taskAssignedEmail({
    taskTitle: data?.title ?? 'a task',
    points: `${data?.point_range_min}–${data?.point_range_max}`,
    deadlineAt: data?.deadline_at ?? null,
    url: siteUrl(`/dashboard/my-tasks/${taskId}`),
  }))
  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/tasks/${taskId}`)
  return { ok: true }
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
  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/tasks/${taskId}`)
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
    url: siteUrl(`/dashboard/my-tasks/${taskId}`),
  }))
  revalidatePath('/dashboard/tasks')
  revalidatePath(`/dashboard/tasks/${taskId}`)
  return { ok: true }
}
