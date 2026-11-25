'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireMember, resolveCallerName } from '@/lib/contributions/auth'
import { describeDbError } from '@nextrium/contributions-core/errors'
import { parseSubmission } from '@nextrium/contributions-core/submission'
import { canPostThreadMessage, canRequestMoreChanges, parseMessageBody } from '@nextrium/contributions-core/thread'
import { reviewContribution } from '@/lib/contributions/reviewService'
import { notifyReviewResult } from '@/lib/contributions/notify'
import { liveAlertDeps } from '@/lib/alerts/live'
import { alertTeamExtension, alertTeamReply, alertTeamSubmission } from '@/lib/alerts/server'

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
  // Tell the task's creator (sent after the response).
  const actor = auth.caller.email
  after(() => alertTeamExtension(liveAlertDeps(), taskId, actor))
  revalidatePath('/my-tasks')
  revalidatePath(`/my-tasks/${taskId}`)
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

  // Belt-and-suspenders 3-attempt check ahead of the database trigger.
  const { data: existing } = await db().from('contributions')
    .select('submission_count').eq('task_id', taskId).eq('contributor_id', auth.caller.userId).maybeSingle()
  if (existing && !canRequestMoreChanges(existing.submission_count ?? 1)) {
    return { ok: false, error: 'You have used all 3 submission attempts for this task.' }
  }

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
  // The submission is committed above. The review can take up to a minute,
  // so it runs after the response is sent; the member's page refreshes until
  // the result lands. A failed review leaves it 'review_failed' for staff to
  // retry, and one cut off mid-call stays 'pending_review' until staff retry it.
  const contributionId: string = data.id
  after(async () => {
    try {
      const outcome = await reviewContribution(contributionId)
      if (outcome.kind === 'reviewed') await notifyReviewResult(contributionId, outcome.status)
    } catch (err) {
      console.error('[review] background review failed:', err instanceof Error ? err.message : err)
    }
    // Whatever the review did, tell the task's creator if the work now waits on them.
    await alertTeamSubmission(liveAlertDeps(), contributionId, auth.caller.email)
  })

  revalidatePath('/my-tasks')
  revalidatePath(`/my-tasks/${taskId}`)
  return { ok: true, contributionId, status: data.status, submissionCount: data.submission_count }
}

/**
 * Posts a contributor's reply on their own submission thread and notifies the
 * staff reviewer who last engaged (or the task creator / admin fallback).
 */
export async function postContributorReply(contributionId: string, body: string): Promise<Result> {
  const auth = await requireMember()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  const parsed = parseMessageBody(body)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const supabase = db()
  const { data: c } = await supabase.from('contributions')
    .select('id, task_id, contributor_id, title, submission_count, thread_closed_at')
    .eq('id', contributionId).maybeSingle()
  const isOwner = !!c && c.contributor_id === auth.caller.userId
  if (!isOwner) return { ok: false, error: 'That submission could not be found.' }

  const { count } = await supabase.from('contribution_messages')
    .select('id', { count: 'exact', head: true }).eq('contribution_id', c.id)
  const gate = canPostThreadMessage({
    authorRole: 'contributor',
    isOwner: true,
    threadClosed: !!c.thread_closed_at,
    messageCount: count ?? 0,
  })
  if (!gate.ok) return { ok: false, error: gate.error }

  const authorName = await resolveCallerName(supabase, auth.caller)
  const { data: inserted, error } = await supabase.from('contribution_messages').insert({
    contribution_id: c.id,
    submission_number: c.submission_count ?? 1,
    author_role: 'contributor',
    author_user_id: auth.caller.userId,
    author_name: authorName,
    kind: 'reply',
    body: parsed.body,
  }).select('id').single()
  if (error || !inserted) {
    console.error('[my-tasks] postContributorReply failed:', error?.message)
    return { ok: false, error: 'Could not send your reply right now. Please try again.' }
  }

  await logActivity({
    action: 'contribution_reply_posted', targetType: 'contribution', targetId: c.id,
    details: { title: c.title, taskId: c.task_id },
    actorId: auth.caller.userId, actorEmail: auth.caller.email ?? undefined,
  })
  const actor = auth.caller.email
  after(() => alertTeamReply(liveAlertDeps(), c.id, inserted.id, actor))

  revalidatePath(`/my-tasks/${c.task_id}`)
  revalidatePath(`/reviews/${c.id}`)
  return { ok: true }
}
