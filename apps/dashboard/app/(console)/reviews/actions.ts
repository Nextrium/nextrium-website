'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireStaff, resolveCallerName, type Caller } from '@/lib/contributions/auth'
import { describeDbError } from '@nextrium/contributions-core/errors'
import { reviewContribution } from '@/lib/contributions/reviewService'
import { changesRequestedEmail, rejectedEmail, staffFeedbackEmail, verifiedEmail } from '@nextrium/contributions-core/emails'
import { notifyMember, notifyReviewResult, dashboardUrl } from '@/lib/contributions/notify'
import { isReviewStale } from '@nextrium/contributions-core/taskView'
import { POINT_RANGES, isComplexity } from '@nextrium/contributions-core/constants'
import { OWN_SUBMISSION_MESSAGE, canDecideOnSubmission } from '@nextrium/contributions-core/decisionRules'
import { canPostThreadMessage, canRequestMoreChanges, parseMessageBody, type ThreadMessageKind } from '@nextrium/contributions-core/thread'
import { staffAlreadyRequestedChanges } from '@/lib/contributions/decisionState'

/** Null when the caller may decide on this submission, otherwise the reason they can't. */
async function decisionDenial(caller: { userId: string; role: string }, contributionId: string): Promise<string | null> {
  const { data } = await db().from('contributions').select('contributor_id').eq('id', contributionId).maybeSingle()
  if (!data) return 'That submission could not be found.'
  return canDecideOnSubmission(caller, data.contributor_id) ? null : OWN_SUBMISSION_MESSAGE
}

/** True when the contribution is already in `status` — a repeated click, so no second log or email. */
async function alreadyIn(contributionId: string, status: string): Promise<boolean> {
  const { data } = await db().from('contributions').select('status').eq('id', contributionId).maybeSingle()
  return data?.status === status
}

async function taskTitle(taskId: string): Promise<string> {
  const { data } = await db().from('tasks').select('title').eq('id', taskId).maybeSingle()
  return data?.title ?? 'your task'
}

type Result = { ok: true } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTES_MAX = 4000
const db = () => createServiceClient() as any

function revalidate(contributionId: string, taskId?: string | null) {
  revalidatePath('/reviews')
  revalidatePath(`/reviews/${contributionId}`)
  revalidatePath('/my-tasks')
  if (taskId) revalidatePath(`/my-tasks/${taskId}`)
  revalidatePath('/tasks')
}

async function recordDecisionMessage(p: {
  contributionId: string
  submissionNumber: number
  caller: Caller
  kind: Extract<ThreadMessageKind, 'decision_verified' | 'decision_changes' | 'decision_rejected'>
  body: string | null | undefined
}) {
  const clean = typeof p.body === 'string' ? p.body.trim().slice(0, NOTES_MAX) : ''
  if (!clean) return
  const supabase = db()
  const authorName = await resolveCallerName(supabase, p.caller)
  const { error } = await supabase.from('contribution_messages').insert({
    contribution_id: p.contributionId,
    submission_number: p.submissionNumber || 1,
    author_role: 'staff',
    author_user_id: p.caller.userId,
    author_name: authorName,
    kind: p.kind,
    body: clean,
  })
  if (error) console.error('[reviews] could not store decision message:', error.message)
}

async function log(action: string, contributionId: string, details: Record<string, unknown>, caller: { userId: string; email: string | null }) {
  await logActivity({
    action, targetType: 'contribution', targetId: contributionId, details,
    actorId: caller.userId, actorEmail: caller.email ?? undefined,
  })
}

/**
 * Verifies a contribution and awards points. The database function clamps
 * the points to the task's range, writes the ledger and completes the task
 * — idempotently.
 */
export async function verifyContribution(contributionId: string, basePoints: number, notes?: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  if (!Number.isInteger(basePoints) || basePoints < 0) return { ok: false, error: 'Choose the base points to award.' }
  const denied = await decisionDenial(auth.caller, contributionId)
  if (denied) return { ok: false, error: denied }
  if (await alreadyIn(contributionId, 'verified')) return { ok: true }

  const cleanNotes = typeof notes === 'string' && notes.trim() ? notes.replace(/\r\n/g, '\n').trim().slice(0, NOTES_MAX) : null
  const { data, error } = await db().rpc('verify_contribution', {
    p_contribution_id: contributionId, p_actor: auth.caller.userId, p_base_points: basePoints,
    p_notes: cleanNotes,
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not verify the submission.') }

  if (cleanNotes) {
    await recordDecisionMessage({
      contributionId,
      submissionNumber: data.submission_count ?? 1,
      caller: auth.caller,
      kind: 'decision_verified',
      body: cleanNotes,
    })
  }
  await log('contribution_verified', contributionId, { title: data.title, points: data.final_points }, auth.caller)
  await notifyMember(data.contributor_id, verifiedEmail({
    taskTitle: await taskTitle(data.task_id),
    points: data.final_points ?? 0,
    notes: cleanNotes,
    url: dashboardUrl(`/my-tasks/${data.task_id}`),
  }))
  revalidate(contributionId, data.task_id)
  return { ok: true }
}

/** Sends the submission back to the member with a note; they can resubmit (up to 3 attempts total). */
export async function requestChanges(contributionId: string, notes: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  const denied = await decisionDenial(auth.caller, contributionId)
  if (denied) return { ok: false, error: denied }
  const parsed = parseMessageBody(notes)
  if ('error' in parsed) return { ok: false, error: 'Write a note for the member first.' }

  const { data: current } = await db().from('contributions').select('submission_count').eq('id', contributionId).maybeSingle()
  if (!current) return { ok: false, error: 'That submission could not be found.' }
  if (!canRequestMoreChanges(current.submission_count ?? 1)) {
    return { ok: false, error: 'This member has already used all 3 submission attempts. Verify or reject the submission instead.' }
  }
  if (await staffAlreadyRequestedChanges(db(), contributionId)) return { ok: true }

  const { data, error } = await db().rpc('request_contribution_changes', {
    p_contribution_id: contributionId, p_actor: auth.caller.userId, p_notes: parsed.body,
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not request changes.') }

  await recordDecisionMessage({
    contributionId,
    submissionNumber: data.submission_count ?? 1,
    caller: auth.caller,
    kind: 'decision_changes',
    body: data.staff_notes ?? parsed.body,
  })
  await log('contribution_changes_requested', contributionId, { title: data.title }, auth.caller)
  await notifyMember(data.contributor_id, changesRequestedEmail({
    taskTitle: await taskTitle(data.task_id), notes: data.staff_notes ?? parsed.body, url: dashboardUrl(`/my-tasks/${data.task_id}`),
  }))
  revalidate(contributionId, data.task_id)
  return { ok: true }
}

/** Rejects the submission (final, no points) and cancels the task. */
export async function rejectContribution(contributionId: string, notes: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  const denied = await decisionDenial(auth.caller, contributionId)
  if (denied) return { ok: false, error: denied }
  const parsed = parseMessageBody(notes)
  if ('error' in parsed) return { ok: false, error: 'Write a note for the member first.' }
  if (await alreadyIn(contributionId, 'rejected')) return { ok: true }

  const { data, error } = await db().rpc('reject_contribution', {
    p_contribution_id: contributionId, p_actor: auth.caller.userId, p_notes: parsed.body,
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not reject the submission.') }

  await recordDecisionMessage({
    contributionId,
    submissionNumber: data.submission_count ?? 1,
    caller: auth.caller,
    kind: 'decision_rejected',
    body: data.staff_notes ?? parsed.body,
  })
  await log('contribution_rejected', contributionId, { title: data.title }, auth.caller)
  await notifyMember(data.contributor_id, rejectedEmail({
    taskTitle: await taskTitle(data.task_id), notes: data.staff_notes ?? parsed.body, url: dashboardUrl(`/my-tasks/${data.task_id}`),
  }))
  revalidate(contributionId, data.task_id)
  return { ok: true }
}

/** Posts a standalone staff feedback message or reply on a submission thread and notifies the member. */
export async function postStaffFeedback(contributionId: string, body: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  const denied = await decisionDenial(auth.caller, contributionId)
  if (denied) return { ok: false, error: denied }
  const parsed = parseMessageBody(body)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const supabase = db()
  const { data: c } = await supabase.from('contributions')
    .select('id, task_id, contributor_id, title, submission_count, thread_closed_at')
    .eq('id', contributionId).maybeSingle()
  if (!c) return { ok: false, error: 'That submission could not be found.' }

  const { count } = await supabase.from('contribution_messages')
    .select('id', { count: 'exact', head: true }).eq('contribution_id', contributionId)
  const gate = canPostThreadMessage({
    authorRole: 'staff',
    isOwner: false,
    threadClosed: !!c.thread_closed_at,
    messageCount: count ?? 0,
  })
  if (!gate.ok) return { ok: false, error: gate.error }

  const authorName = await resolveCallerName(supabase, auth.caller)
  const { error } = await supabase.from('contribution_messages').insert({
    contribution_id: c.id,
    submission_number: c.submission_count ?? 1,
    author_role: 'staff',
    author_user_id: auth.caller.userId,
    author_name: authorName,
    kind: 'feedback',
    body: parsed.body,
  })
  if (error) {
    console.error('[reviews] postStaffFeedback failed:', error.message)
    return { ok: false, error: 'Could not send your feedback right now. Please try again.' }
  }

  await log('contribution_feedback_posted', c.id, { title: c.title }, auth.caller)
  await notifyMember(c.contributor_id, staffFeedbackEmail({
    taskTitle: await taskTitle(c.task_id),
    authorName,
    body: parsed.body,
    url: dashboardUrl(`/my-tasks/${c.task_id}`),
  }))
  revalidate(c.id, c.task_id)
  return { ok: true }
}

/** Closes or reopens a submission's conversation thread (staff only, never on one's own submission). */
export async function toggleThreadClosed(contributionId: string, closed: boolean): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  const denied = await decisionDenial(auth.caller, contributionId)
  if (denied) return { ok: false, error: denied }

  const supabase = db()
  const { data: c } = await supabase.from('contributions').select('id, task_id, title').eq('id', contributionId).maybeSingle()
  if (!c) return { ok: false, error: 'That submission could not be found.' }

  const { error } = await supabase.from('contributions')
    .update({
      thread_closed_at: closed ? new Date().toISOString() : null,
      thread_closed_by: closed ? auth.caller.userId : null,
    })
    .eq('id', c.id)
  if (error) {
    console.error('[reviews] toggleThreadClosed failed:', error.message)
    return { ok: false, error: 'Could not update the conversation status.' }
  }

  await log(closed ? 'contribution_thread_closed' : 'contribution_thread_reopened', c.id, { title: c.title }, auth.caller)
  revalidate(c.id, c.task_id)
  return { ok: true }
}

/**
 * Re-runs the automated review for a submission whose review failed
 * (timeout, rate limit, service error) or was cut off and has been pending
 * too long. Staff-triggered only — there is no automatic retry. Safe if two
 * people click at once: the database stores at most one service review per
 * submission.
 */
export async function retryReview(contributionId: string): Promise<Result & { status?: string }> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }

  const { data: c } = await db().from('contributions').select('status, title, submitted_at').eq('id', contributionId).maybeSingle()
  if (!c) return { ok: false, error: 'That submission could not be found.' }
  if (c.status !== 'review_failed' && !isReviewStale(c)) return { ok: false, error: 'Only submissions whose review failed can be retried.' }

  const outcome = await reviewContribution(contributionId)
  await log('contribution_review_retried', contributionId, { title: c.title, result: outcome.kind === 'reviewed' ? outcome.status : outcome.reason }, auth.caller)
  revalidate(contributionId)
  if (outcome.kind === 'failed') {
    const why = outcome.reason === 'rate_limited'
      ? `The review service is rate limiting${outcome.retryAfterSeconds ? ` — try again in about ${Math.ceil(outcome.retryAfterSeconds / 60)} minute(s)` : ''}.`
      : outcome.reason === 'not_configured' ? 'The review service is not configured on this server.'
      : 'The review service did not respond. Try again later.'
    return { ok: false, error: why }
  }
  await notifyReviewResult(contributionId, outcome.status)
  return { ok: true, status: outcome.status }
}

const ADJUSTABLE_STATUSES = ['needs_human', 'ai_approved', 'review_failed', 'changes_requested']

/**
 * Changes the task's complexity (and so its points range) while its submission
 * waits for a staff decision. Complexity is otherwise fixed once a task is
 * assigned; this is the reviewer's correction when the work turned out bigger
 * or smaller than planned. The deadline is left as it is.
 */
export async function adjustTaskComplexity(contributionId: string, complexity: string): Promise<Result & { min?: number; max?: number }> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  if (!isComplexity(complexity)) return { ok: false, error: 'Choose a complexity.' }
  const denied = await decisionDenial(auth.caller, contributionId)
  if (denied) return { ok: false, error: denied }

  const { data: c } = await db().from('contributions').select('status, task_id, title').eq('id', contributionId).maybeSingle()
  if (!c) return { ok: false, error: 'That submission could not be found.' }
  if (!ADJUSTABLE_STATUSES.includes(c.status)) return { ok: false, error: 'Complexity can only be adjusted while the submission is waiting for a decision.' }

  const { data: task } = await db().from('tasks').select('id, title, category, complexity, status').eq('id', c.task_id).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  if (task.status === 'completed' || task.status === 'cancelled') return { ok: false, error: 'This task is already closed.' }
  if (task.complexity === complexity) return { ok: true }

  const range = POINT_RANGES[task.category as keyof typeof POINT_RANGES]?.[complexity]
  if (!range) return { ok: false, error: 'That task has an unknown category.' }

  const { data: updated, error } = await db().from('tasks')
    .update({ complexity, point_range_min: range.min, point_range_max: range.max })
    .eq('id', task.id).eq('complexity', task.complexity).not('status', 'in', '(completed,cancelled)')
    .select('id')
  if (error) {
    console.error('[reviews] complexity adjust failed:', error.message)
    return { ok: false, error: 'Could not change the complexity.' }
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'This task changed in the meantime. Reload and try again.' }

  await log('task_complexity_adjusted', contributionId, { title: task.title, from: task.complexity, to: complexity, points: `${range.min}–${range.max}` }, auth.caller)
  revalidate(contributionId)
  return { ok: true, min: range.min, max: range.max }
}
