import { briefToText } from '@nextrium/contributions-core/sanitize'
import { mapReviewResponse } from '@nextrium/contributions-core/reviewMapping'
import { signReviewBody } from '@nextrium/contributions-core/reviewSignature'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { communityStatus, type CommunityReviewStatus } from './submissionRules'

// Server-only client for the automated review service. URL and secret are
// server-only env vars. Same contract and signing as the main dashboard.

// Pages that call this run with maxDuration 60; time out first so a slow
// review leaves the submission waiting (retryable) instead of the function
// being killed mid-call.
const TIMEOUT_MS = 55_000
const TASK_BRIEF_MAX = 8_000

// A submission waiting for its automated review: just submitted, or claimed by a retry.
const AWAITING = ['submitted', 'under_review']

export type ReviewOutcome =
  | { kind: 'reviewed'; status: CommunityReviewStatus }
  | { kind: 'failed'; reason: 'not_configured' | 'rate_limited' | 'timeout' | 'service_error' | 'bad_response' | 'stale' }

async function callService(payload: Record<string, unknown>) {
  const url = process.env.REVIEW_SERVICE_URL
  const secret = process.env.REVIEW_SERVICE_SECRET
  if (!url || !secret) return 'not_configured' as const
  const rawBody = JSON.stringify(payload)
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Zivana-Signature': signReviewBody(rawBody, secret) },
      body: rawBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  } catch (err) {
    return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError') ? ('timeout' as const) : ('network' as const)
  }
}

/**
 * Reviews the submission's current attempt and stores the result. Only a
 * submission still waiting for its review (submitted or under_review with no
 * decision yet, same attempt number) is updated, so a late or repeated result never
 * overwrites a newer attempt or a reviewer's decision. When the review
 * passes or goes to the team, the task is marked completed and stops
 * counting against the contributor's running tasks.
 */
export async function reviewSubmission(contributionId: string): Promise<ReviewOutcome> {
  const db = createCommunityServiceClient()
  const { data: c } = await db
    .from('contributions')
    .select('id, contributor_id, task_id, title, description, evidence_url, submission_count, status, review_decision, review_feedback, created_at, updated_at')
    .eq('id', contributionId)
    .maybeSingle()
  if (!c || !AWAITING.includes(c.status ?? '') || c.review_decision) return { kind: 'failed', reason: 'stale' }

  const { data: task } = c.task_id
    ? await db.from('tasks').select('id, description, category, complexity, assigned_to').eq('id', c.task_id).maybeSingle()
    : { data: null }
  if (!task) return { kind: 'failed', reason: 'bad_response' }

  const attempt = c.submission_count ?? 1
  // On a resubmission the stored feedback is the previous attempt's: the service compares against it.
  const prev = attempt > 1 && c.review_feedback && typeof c.review_feedback === 'object' ? (c.review_feedback as Record<string, unknown>) : null
  const previousFeedback = prev && typeof prev.summary === 'string'
    ? { summary: prev.summary, issues: Array.isArray(prev.issues) ? prev.issues : [], what_to_do: typeof prev.what_to_do === 'string' ? prev.what_to_do : '' }
    : null

  const payload: Record<string, unknown> = {
    contribution_id: c.id,
    contributor_id: c.contributor_id,
    title: c.title,
    description: c.description,
    category: task.category,
    complexity: task.complexity,
    evidence_url: c.evidence_url,
    submission_count: attempt,
    submitted_at: c.updated_at ?? c.created_at,
    task_brief: task.description ? briefToText(task.description).slice(0, TASK_BRIEF_MAX) : null,
    ...(previousFeedback ? { previous_feedback: previousFeedback } : {}),
  }

  const failed = (reason: Extract<ReviewOutcome, { kind: 'failed' }>['reason']): ReviewOutcome => {
    console.error(`[contribute] review ${c.id} attempt ${attempt}: ${reason}`)
    return { kind: 'failed', reason }
  }

  const result = await callService(payload)
  if (result === 'not_configured') return failed('not_configured')
  if (result === 'timeout') return failed('timeout')
  if (result === 'network') return failed('service_error')
  if (result.status === 429) return failed('rate_limited')
  if (result.status !== 200) return failed('service_error')

  const mapped = mapReviewResponse(result.body)
  if (!mapped) return failed('bad_response')
  const status = communityStatus(mapped.status)

  const { data: updated, error } = await db
    .from('contributions')
    .update({
      status,
      review_decision: mapped.decision,
      review_score: mapped.score,
      // Everything the service returned, for the core team. Members only ever
      // see it through memberFeedback(), which drops staff-only items.
      review_feedback: {
        ...(mapped.feedback ?? {}),
        checks: mapped.checks,
        code_audit: mapped.codeAudit,
        model: mapped.modelUsed,
      } as never,
    })
    .eq('id', c.id)
    .in('status', AWAITING)
    .eq('submission_count', attempt)
    .is('review_decision', null)
    .select('id')
  if (error) return failed('service_error')
  if (!updated || updated.length === 0) return failed('stale')

  if (status !== 'rejected') {
    await db.from('tasks').update({ status: 'completed' }).eq('id', task.id).eq('assigned_to', c.contributor_id ?? '').eq('status', 'assigned')
  }
  return { kind: 'reviewed', status }
}
