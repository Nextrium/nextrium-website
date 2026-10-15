'use server'

import { brand } from '@nextrium/brand'
import { parseSubmission } from '@nextrium/contributions-core/submission'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { getActiveContributor } from '@/lib/portal'
import { isUuid } from '@/lib/publicData'
import { parseProfileFields } from '@/lib/registration'
import { reviewSubmission } from '@/lib/reviewService'
import { basePointsFor } from '@/lib/submissionRules'
import { submissionState } from '@/lib/submissionView'
import { canRequestExtension, effectiveDeadline } from '@/lib/deadline'

// Everything a contributor does from their dashboard. Each action looks up
// the approved contributor from the session and only ever touches that
// contributor's own tasks and submissions.
//
// Actions do not revalidate: that would re-render the page under the open
// dialog (a finished task's card disappears) and lose the result. The pages
// are always rendered live, and the components refresh after showing it.

export type WorkState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'done'; message: string; outcome?: 'ai_approved' | 'rejected' | 'under_review' | 'pending' }

const NOT_ALLOWED: WorkState = { status: 'error', message: 'Only approved contributors can do this. Reload the page and sign in again.' }
const GENERIC: WorkState = { status: 'error', message: `Something went wrong. Try again, or contact ${brand.emails.contributors} if it persists.` }

const REVIEW_MESSAGES = {
  ai_approved: 'Your work passed the automated review. The core team will do a final check before awarding points.',
  rejected: 'The automated review asked for changes. Read the feedback, update your work and resubmit.',
  under_review: 'Your submission is with the core team for review.',
  pending: 'Your work is saved, but the automated review did not finish. You can run it again from your submissions.',
} as const

/** Submits work for a task the contributor holds, or resubmits after an automated rejection, then runs the review. */
export async function submitWork(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const me = await getActiveContributor()
  if (!me) return NOT_ALLOWED
  const taskId = formData.get('taskId')
  if (!isUuid(taskId)) return { status: 'error', message: 'Choose the task you are submitting for.' }

  const parsed = parseSubmission({ title: formData.get('title'), description: formData.get('description'), evidenceUrl: formData.get('evidenceUrl') })
  if ('error' in parsed) return { status: 'error', message: parsed.error }
  const { title, description, evidenceUrl } = parsed.submission

  const db = createCommunityServiceClient()
  const { data: task, error: taskError } = await db
    .from('tasks')
    .select('id, status, assigned_to, category, complexity, point_range_min, point_range_max, deadline_at, extended_deadline_at, extension_granted, claimed_at, deadline_days, extension_requested_at')
    .eq('id', taskId)
    .maybeSingle()
  if (taskError) return GENERIC
  if (!task || task.assigned_to !== me.id || task.status !== 'assigned') {
    return { status: 'error', message: 'You can only submit work for a task you are currently working on.' }
  }

  const { data: previous, error: prevError } = await db
    .from('contributions')
    .select('id, status, review_decision, notes, submission_count')
    .eq('task_id', task.id)
    .eq('contributor_id', me.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (prevError) return GENERIC

  let contributionId: string
  if (previous) {
    const state = submissionState(previous)
    if (!state.canResubmit) {
      return { status: 'error', message: previous.status === 'rejected' ? 'This submission can no longer be resubmitted.' : 'You have already submitted work for this task.' }
    }
    // rejected → submitted: the database counts the attempt and refuses a fourth.
    const { data: updated, error } = await db
      .from('contributions')
      .update({ title, description, evidence_url: evidenceUrl, status: 'submitted', review_decision: null, review_score: null })
      .eq('id', previous.id)
      .eq('contributor_id', me.id)
      .eq('status', 'rejected')
      .is('notes', null)
      .select('id')
    if (error) {
      if (/submission limit/i.test(error.message)) return { status: 'error', message: 'You have used all three attempts for this task.' }
      console.error('[contribute] resubmission failed:', error.code)
      return GENERIC
    }
    if (!updated || updated.length === 0) return { status: 'error', message: 'This submission changed meanwhile. Reload the page to see it.' }
    contributionId = previous.id
  } else {
    const deadline = effectiveDeadline({ ...task, complexity: task.complexity })
    const { data: inserted, error } = await db
      .from('contributions')
      .insert({
        contributor_id: me.id,
        task_id: task.id,
        title,
        description,
        category: task.category,
        complexity: task.complexity,
        base_points: basePointsFor(task.point_range_min, task.point_range_max),
        final_points: null,
        multiplier: 1,
        timing_multiplier: 1,
        deadline_at: deadline ? deadline.toISOString() : null,
        evidence_url: evidenceUrl,
        status: 'submitted',
        submission_count: 1,
      })
      .select('id')
      .single()
    if (error || !inserted) {
      console.error('[contribute] submission failed:', error?.code)
      return GENERIC
    }
    contributionId = inserted.id
  }

  const outcome = await reviewSubmission(contributionId)
  const key = outcome.kind === 'reviewed' ? outcome.status : 'pending'
  return { status: 'done', outcome: key, message: REVIEW_MESSAGES[key] }
}

// A retry is refused while a review may still be running (the first call can take up to a minute).
const RETRY_AFTER_MS = 90_000

/** Runs the automated review again for a submission whose review never completed. Does not use an attempt. */
export async function retryReview(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const me = await getActiveContributor()
  if (!me) return NOT_ALLOWED
  const id = formData.get('contributionId')
  if (!isUuid(id)) return GENERIC

  const db = createCommunityServiceClient()
  const { data: c } = await db.from('contributions').select('id, status, review_decision, notes, submission_count, updated_at').eq('id', id).eq('contributor_id', me.id).maybeSingle()
  if (!c || !submissionState(c).canRetryReview) return { status: 'error', message: 'This submission is not waiting for a review.' }

  // Claim the retry: move the row to under_review, only if nothing touched it in
  // the last 90 s. Atomic, so a double click or a review still running is refused.
  // (Never write a row back to 'submitted' from 'submitted': the database would
  // count that as an attempt; moving between submitted and under_review does not.)
  const cutoff = new Date(Date.now() - RETRY_AFTER_MS).toISOString()
  const { data: claimed, error: claimError } = await db
    .from('contributions')
    .update({ status: 'under_review' })
    .eq('id', c.id)
    .eq('contributor_id', me.id)
    .in('status', ['submitted', 'under_review'])
    .is('review_decision', null)
    .lt('updated_at', cutoff)
    .select('id')
  if (claimError) return GENERIC
  if (!claimed || claimed.length === 0) return { status: 'error', message: 'The review may still be running. Wait a minute, then try again.' }

  const outcome = await reviewSubmission(c.id)
  if (outcome.kind === 'failed') {
    await db.from('contributions').update({ status: 'submitted' }).eq('id', c.id).eq('status', 'under_review').is('review_decision', null)
  }
  const key = outcome.kind === 'reviewed' ? outcome.status : 'pending'
  return { status: 'done', outcome: key, message: REVIEW_MESSAGES[key] }
}

/** Gives a running task back to the board. The contributor cannot claim it again for 48 hours. */
export async function unclaimTask(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const me = await getActiveContributor()
  if (!me) return NOT_ALLOWED
  const taskId = formData.get('taskId')
  if (!isUuid(taskId)) return GENERIC

  const db = createCommunityServiceClient()
  const { data: task } = await db.from('tasks').select('id, status, assigned_to').eq('id', taskId).maybeSingle()
  if (!task || task.assigned_to !== me.id || task.status !== 'assigned') return { status: 'error', message: 'This task is not one of your running tasks.' }

  const { data: waiting } = await db
    .from('contributions')
    .select('id')
    .eq('task_id', task.id)
    .eq('contributor_id', me.id)
    .in('status', ['submitted', 'under_review', 'ai_approved', 'verified'])
    .limit(1)
  if (waiting && waiting.length > 0) return { status: 'error', message: 'You have work under review for this task, so it cannot be unclaimed.' }

  const { error } = await db.rpc('unclaim_task', { task_id: task.id, contributor_id: me.id })
  if (error) {
    console.error('[contribute] unclaim failed:', error.code)
    return GENERIC
  }
  return { status: 'done', message: 'Task unclaimed. It is back on the open board.' }
}

/** Asks the core team for one deadline extension, before the deadline passes. */
export async function requestExtension(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const me = await getActiveContributor()
  if (!me) return NOT_ALLOWED
  const taskId = formData.get('taskId')
  if (!isUuid(taskId)) return GENERIC

  const db = createCommunityServiceClient()
  const { data: task } = await db
    .from('tasks')
    .select('id, status, assigned_to, complexity, claimed_at, deadline_at, deadline_days, extension_granted, extension_requested_at, extended_deadline_at')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || task.assigned_to !== me.id || task.status !== 'assigned') return { status: 'error', message: 'This task is not one of your running tasks.' }
  if (!canRequestExtension(task)) return { status: 'error', message: 'An extension can be requested once per task, before the deadline.' }

  const { data: updated, error } = await db
    .from('tasks')
    .update({ extension_requested_at: new Date().toISOString() })
    .eq('id', task.id)
    .eq('assigned_to', me.id)
    .eq('status', 'assigned')
    .is('extension_requested_at', null)
    .select('id')
  if (error) return GENERIC
  if (!updated || updated.length === 0) return { status: 'error', message: 'An extension has already been requested for this task.' }
  return { status: 'done', message: 'Extension requested. The core team will review it.' }
}

/** Updates the editable parts of the contributor's own profile. */
export async function updateProfile(_prev: WorkState, formData: FormData): Promise<WorkState> {
  const me = await getActiveContributor()
  if (!me) return NOT_ALLOWED
  const parsed = parseProfileFields(formData)
  if (!parsed.ok) return { status: 'error', message: parsed.error }

  const db = createCommunityServiceClient()
  const { error } = await db.from('contributors').update(parsed.value).eq('id', me.id).eq('status', 'active')
  if (error) {
    console.error('[contribute] profile update failed:', error.code)
    return GENERIC
  }
  return { status: 'done', message: 'Profile updated.' }
}
