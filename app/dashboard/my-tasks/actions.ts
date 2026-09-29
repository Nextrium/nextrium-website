'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireMember } from '@/lib/contributions/auth'
import { describeDbError } from '@/lib/contributions/errors'

type Result = { ok: true } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const db = () => createServiceClient() as any

/**
 * Asks for one extension on the caller's own task, before its deadline.
 * The database function checks ownership, status, the one-extension limit
 * and the deadline.
 */
export async function requestExtension(taskId: string, reason: string): Promise<Result> {
  const auth = await requireMember()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (text.length < 5) return { ok: false, error: 'Tell the team briefly why you need more time.' }

  const { data, error } = await db().rpc('request_task_extension', {
    p_task_id: taskId, p_member: auth.caller.userId, p_reason: text.slice(0, 1000),
  })
  if (error) return { ok: false, error: describeDbError(error, 'Could not request an extension.') }

  await logActivity({
    action: 'task_extension_requested', targetType: 'task', targetId: taskId, details: { title: data?.title },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  revalidatePath('/dashboard/my-tasks')
  revalidatePath(`/dashboard/my-tasks/${taskId}`)
  return { ok: true }
}
