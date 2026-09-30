'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireMember } from '@/lib/contributions/auth'
import { describeDbError } from '@/lib/contributions/errors'
import { parseSubmission } from '@/lib/contributions/submission'
import { reviewContribution } from '@/lib/contributions/reviewService'
import { notifyReviewResult } from '@/lib/contributions/notify'

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

export interface SubmitResult {
  ok: true
  contributionId: string
  status: string
  submissionCount: number
}

/**
 * Submits (or, after changes were requested, resubmits) work for the
 * caller's own open task. Validated on the server; the database function
 * checks ownership and status and writes the contribution and task status in
 * one transaction, so the submission is committed before any review call.
 * The client receives only the stored result.
 */
export async function submitContribution(taskId: string, raw: unknown): Promise<SubmitResult | { ok: false; error: string }> {
  const auth = await requireMember()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const parsed = parseSubmission(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const s = parsed.submission

  const { data, error } = await db().rpc('submit_contribution', {
    p_task_id: taskId, p_member: auth.caller.userId,
    p_title: s.title, p_description: s.description, p_evidence_url: s.evidenceUrl,
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not submit your work.') }

  await logActivity({
    action: data.submission_count > 1 ? 'contribution_resubmitted' : 'contribution_submitted',
    targetType: 'contribution', targetId: data.id,
    details: { title: s.title, taskId, submission: data.submission_count },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  // The submission is committed above; now review it on the server. A
  // failed review leaves it 'review_failed' for staff to retry.
  const outcome = await reviewContribution(data.id)
  if (outcome.kind === 'reviewed') await notifyReviewResult(data.id, outcome.status)

  revalidatePath('/dashboard/my-tasks')
  revalidatePath(`/dashboard/my-tasks/${taskId}`)
  const status = outcome.kind === 'reviewed' ? outcome.status : 'review_failed'
  return { ok: true, contributionId: data.id, status, submissionCount: data.submission_count }
}
