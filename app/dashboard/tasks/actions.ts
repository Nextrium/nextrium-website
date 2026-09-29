'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireStaff } from '@/lib/contributions/auth'
import { parseTaskInput } from '@/lib/contributions/taskInput'
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
