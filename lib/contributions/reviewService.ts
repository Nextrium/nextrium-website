// Server-only client for the contribution review service. The URL and secret
// are server-only environment variables (never NEXT_PUBLIC_). Built against
// the service's written API contract, not its source.
import { createServiceClient } from '@/lib/supabase/server'
import { briefToText } from './sanitize'
import { mapReviewResponse } from './reviewMapping'
import { signReviewBody } from './reviewSignature'
import type { Contribution } from '@/lib/types/database'

// The contract suggests 90 s, but callers run under a 60 s server limit
// (maxDuration on the task and review pages); timing out first marks the
// review failed instead of the function being killed mid-call.
const TIMEOUT_MS = 55_000
const TASK_BRIEF_MAX = 8_000       // contract limit

export type ReviewOutcome =
  | { kind: 'reviewed'; status: string }
  | { kind: 'failed'; reason: 'not_configured' | 'rate_limited' | 'timeout' | 'service_error' | 'bad_response'; retryAfterSeconds?: number }

const db = () => createServiceClient() as any

interface ServiceCallResult {
  status: number
  body: unknown
  retryAfter: number | null
}

async function callService(payload: Record<string, unknown>): Promise<ServiceCallResult | 'timeout' | 'not_configured' | 'network'> {
  const url = process.env.REVIEW_SERVICE_URL
  const secret = process.env.REVIEW_SERVICE_SECRET
  if (!url || !secret) return 'not_configured'

  const rawBody = JSON.stringify(payload)
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Zivana-Signature': signReviewBody(rawBody, secret) },
      body: rawBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    const retry = Number(res.headers.get('Retry-After'))
    const body = await res.json().catch(() => null)
    return { status: res.status, body, retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null }
  } catch (err) {
    return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError') ? 'timeout' : 'network'
  }
}

/**
 * Reviews the contribution's current submission and stores the result.
 * The submission is already committed; on timeout, 429 or error the
 * contribution becomes 'review_failed' for staff to retry — no automatic
 * retry loop. Safe to call twice: the database ignores a result for an older
 * submission and a repeat for the same one.
 */
export async function reviewContribution(contributionId: string): Promise<ReviewOutcome> {
  const supabase = db()
  const { data: c }: { data: Contribution | null } = await supabase.from('contributions').select('*').eq('id', contributionId).maybeSingle()
  if (!c) return { kind: 'failed', reason: 'bad_response' }
  const { data: task } = await supabase.from('tasks').select('description, category, complexity').eq('id', c.task_id).maybeSingle()

  // Previous feedback, for the resubmission assessment.
  let previousFeedback: unknown = undefined
  if (c.submission_count > 1) {
    const { data: prev } = await supabase.from('contribution_reviews')
      .select('feedback').eq('contribution_id', c.id).eq('source', 'service')
      .lt('submission_number', c.submission_count).order('submission_number', { ascending: false }).limit(1).maybeSingle()
    const f = prev?.feedback
    if (f && typeof f.summary === 'string') {
      previousFeedback = { summary: f.summary, issues: Array.isArray(f.issues) ? f.issues : [], what_to_do: f.what_to_do ?? '' }
    }
  }

  const payload: Record<string, unknown> = {
    contribution_id: c.id,
    contributor_id: c.contributor_id,
    title: c.title,
    description: c.description,
    category: task?.category,
    complexity: task?.complexity,
    evidence_url: c.evidence_url,
    submission_count: c.submission_count,
    submitted_at: c.submitted_at,
    task_brief: task?.description ? briefToText(task.description).slice(0, TASK_BRIEF_MAX) : null,
    ...(previousFeedback ? { previous_feedback: previousFeedback } : {}),
  }

  const markFailed = async (reason: Extract<ReviewOutcome, { kind: 'failed' }>['reason'], retryAfterSeconds?: number): Promise<ReviewOutcome> => {
    await supabase.rpc('mark_contribution_review_failed', { p_contribution_id: c.id, p_submission_number: c.submission_count })
    console.error(`[review] contribution ${c.id} submission ${c.submission_count}: ${reason}`)
    return { kind: 'failed', reason, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }
  }

  const result = await callService(payload)
  if (result === 'not_configured') return markFailed('not_configured')
  if (result === 'timeout') return markFailed('timeout')
  if (result === 'network') return markFailed('service_error')
  if (result.status === 429) return markFailed('rate_limited', result.retryAfter ?? undefined)
  if (result.status !== 200) return markFailed('service_error')

  const mapped = mapReviewResponse(result.body)
  if (!mapped) return markFailed('bad_response')

  const { data: updated, error } = await supabase.rpc('apply_contribution_review', {
    p_contribution_id: c.id,
    p_submission_number: c.submission_count,
    p_decision: mapped.decision,
    p_score: mapped.score,
    p_checks: mapped.checks,
    p_feedback: mapped.feedback,
    p_code_audit: mapped.codeAudit,
    p_model: mapped.modelUsed,
    p_status: mapped.status,
  })
  if (error || !updated) return markFailed('service_error')
  return { kind: 'reviewed', status: updated.status }
}
