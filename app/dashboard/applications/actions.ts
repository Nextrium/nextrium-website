'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchAgentsEngine } from '@/lib/agentsEngine'
import { logActivity } from '@/lib/activityLog'
import type { AgentScreeningResult } from '@/lib/types/database'

export interface ReviewedInfo {
  firstReviewedByEmail: string | null
  firstReviewedAt: string | null
  lastReviewedByEmail: string | null
  lastReviewedAt: string | null
}

/**
 * Stamps an application as human-reviewed. first_* is set once and never
 * overwritten (there's no point re-reviewing what's already been looked
 * at - this is who originally reviewed it); last_* refreshes on every
 * call, so who most recently acted on it is always visible too. Called
 * after the two actions that actually constitute "a human looked at
 * this": a manual status change, and resolving a rebuttal.
 */
export async function markApplicationReviewed(applicationId: string): Promise<{ reviewed?: ReviewedInfo; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not signed in.' }

    const serviceClient = createServiceClient()
    const { data: existing } = await (serviceClient.from('applications') as any)
      .select('first_reviewed_by, first_reviewed_by_email, first_reviewed_at')
      .eq('id', applicationId)
      .maybeSingle()

    const now = new Date().toISOString()
    const isFirstReview = !existing?.first_reviewed_by

    const { data: updated, error } = await (serviceClient.from('applications') as any)
      .update({
        ...(isFirstReview
          ? { first_reviewed_by: user.id, first_reviewed_by_email: user.email, first_reviewed_at: now }
          : {}),
        last_reviewed_by: user.id,
        last_reviewed_by_email: user.email,
        last_reviewed_at: now,
      })
      .eq('id', applicationId)
      .select('first_reviewed_by_email, first_reviewed_at, last_reviewed_by_email, last_reviewed_at')
      .single()

    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/applications')
    return {
      reviewed: {
        firstReviewedByEmail: updated.first_reviewed_by_email,
        firstReviewedAt: updated.first_reviewed_at,
        lastReviewedByEmail: updated.last_reviewed_by_email,
        lastReviewedAt: updated.last_reviewed_at,
      },
    }
  } catch (err) {
    console.error('[markApplicationReviewed] Error:', err)
    return { error: err instanceof Error ? err.message : 'Failed to mark application as reviewed.' }
  }
}

export async function deleteApplication(id: string): Promise<{ error?: string }> {
  try {
    const supabase = createServiceClient()
    const { data: existing } = await (supabase.from('applications') as any)
      .select('name, email')
      .eq('id', id)
      .maybeSingle()

    const { error } = await (supabase.from('applications') as any)
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/applications')
    logActivity({
      action: 'application_deleted',
      targetType: 'application',
      targetId: id,
      details: { name: existing?.name, email: existing?.email },
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete application.' }
  }
}

export async function screenCandidateAction(
  applicationId: string,
  forceRescan: boolean = false
): Promise<{ error?: string; result?: any; screeningRecord?: AgentScreeningResult; statusUpdated?: string | null }> {
  const res = await fetchAgentsEngine('/api/v1/agents/hr/screen-consensus', {
    method: 'POST',
    body: JSON.stringify({
      applicationId,
      forceRescan,
      updateStatus: true,
      emailDispatch: false,
    }),
  })

  if (!res.ok) {
    return { error: res.error }
  }

  const data = res.data

  // Query the stored record for the client
  const supabase = createServiceClient()
  const { data: screeningRecord } = await supabase
    .from('agent_screening_results')
    .select('*')
    .eq('application_id', applicationId)
    .order('screened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const consensus = data.consensus || data
  const fallbackRecord: AgentScreeningResult = {
    id: (screeningRecord as any)?.id || crypto.randomUUID(),
    application_id: applicationId,
    input_hash: (screeningRecord as any)?.input_hash || data.inputHash || '',
    composite_score: (screeningRecord as any)?.composite_score ?? consensus.compositeMatchScore ?? 0,
    consensus_tier: (screeningRecord as any)?.consensus_tier ?? consensus.consensusTier ?? 'Tier 3',
    recommendation: (screeningRecord as any)?.recommendation ?? consensus.finalRecommendation ?? 'Manual Review',
    evaluation_track: (screeningRecord as any)?.evaluation_track ?? consensus.evaluationTrack ?? '',
    full_result: (screeningRecord as any)?.full_result ?? { consensus },
    screened_at: (screeningRecord as any)?.screened_at ?? new Date().toISOString(),
    email_sent: (screeningRecord as any)?.email_sent ?? false,
    webhook_sent: (screeningRecord as any)?.webhook_sent ?? false,
  }

  revalidatePath('/dashboard/applications')
  logActivity({
    action: forceRescan ? 'application_rescanned' : 'application_screened',
    targetType: 'application',
    targetId: applicationId,
    details: {
      compositeScore: consensus.compositeMatchScore,
      recommendation: consensus.finalRecommendation,
      statusUpdated: data.statusUpdated,
    },
  }).catch(() => {})
  return {
    result: consensus,
    screeningRecord: (screeningRecord as unknown as AgentScreeningResult) || fallbackRecord,
    statusUpdated: data.statusUpdated ?? null,
  }
}

export interface DispatchEmailsResult {
  error?: string
  sentCount?: number
  skippedCount?: number
  failedCount?: number
  results?: {
    applicationId: string | null
    candidateName: string
    candidateEmail: string | null
    status: 'sent' | 'skipped' | 'failed'
    reason?: string
  }[]
}

export async function dispatchEmailsAction(applicationIds: string[] = []): Promise<DispatchEmailsResult> {
  const res = await fetchAgentsEngine('/api/v1/agents/hr/dispatch-emails', {
    method: 'POST',
    body: JSON.stringify({ applicationIds }),
  })

  if (!res.ok) {
    return { error: res.error }
  }

  revalidatePath('/dashboard/applications')
  logActivity({
    action: 'feedback_emails_dispatched',
    targetType: 'application',
    targetId: applicationIds.length === 1 ? applicationIds[0] : undefined,
    details: {
      applicationIds,
      sentCount: res.data.sentCount,
      skippedCount: res.data.skippedCount,
      failedCount: res.data.failedCount,
    },
  }).catch(() => {})
  return {
    sentCount: res.data.sentCount,
    skippedCount: res.data.skippedCount,
    failedCount: res.data.failedCount,
    results: res.data.results,
  }
}

export interface BulkScreenOutcome {
  applicationId: string
  candidateName: string
  success: boolean
  error?: string
  compositeScore?: number
  consensusTier?: string
  recommendation?: string
  evaluationTrack?: string
  statusUpdated?: string | null
  reportId?: string
}

export interface BulkScreenJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  application_ids: string[]
  total: number
  succeeded: number
  failed: number
  current_index: number
  results: BulkScreenOutcome[]
  error: string | null
}

export async function startBulkScreenAction(
  applicationIds: string[],
  trackOverrides?: Record<string, string>
): Promise<{ jobId?: string; total?: number; error?: string }> {
  const res = await fetchAgentsEngine('/api/v1/agents/hr/bulk-screen', {
    method: 'POST',
    body: JSON.stringify({ applicationIds, trackOverrides }),
  })

  // 409 means a job is already running — surface its jobId so the client can resume polling it.
  if (res.status === 409 && res.data?.jobId) {
    return { jobId: res.data.jobId, error: res.error }
  }

  if (!res.ok) {
    return { error: res.error }
  }

  logActivity({
    action: 'bulk_screen_started',
    targetType: 'bulk_screen_job',
    targetId: res.data.jobId,
    details: { applicationCount: applicationIds.length, total: res.data.total },
  }).catch(() => {})

  return { jobId: res.data.jobId, total: res.data.total }
}

export async function getBulkScreenJobStatus(
  jobId: string
): Promise<{ job?: BulkScreenJob; error?: string }> {
  const res = await fetchAgentsEngine(`/api/v1/agents/hr/bulk-screen/${jobId}`, {
    method: 'GET',
  })

  if (!res.ok) {
    return { error: res.error }
  }

  if (res.data.job?.status === 'completed') {
    revalidatePath('/dashboard/applications')
  }

  return { job: res.data.job }
}

export interface RebuttalDetail {
  id: string
  reportId: string
  applicationId: string | null
  disputedDimensions: string[]
  evidenceStatement: string
  evidenceUrls: string[]
  status: 'pending' | 'rescreening' | 'in_review' | 'rescreened' | 'resolved' | 'dismissed'
  previousScore: number | null
  newScore: number | null
  deltaSummary: string | null
  rescreenError: string | null
  createdAt: string
}

export async function getRebuttalDetail(reportId: string): Promise<{ rebuttal?: RebuttalDetail; error?: string }> {
  try {
    const supabase = createServiceClient()
    // screening_rebuttals' actual timestamp column is submitted_at, not
    // created_at (the live schema drifted from what supabase/schema.sql
    // documents) — ordering by created_at here made this query fail
    // outright every time, which is why a candidate with a genuinely
    // submitted rebuttal showed the "submitted" badge but the rebuttal
    // panel itself never rendered any content.
    const { data, error } = await (supabase.from('screening_rebuttals') as any)
      .select('*')
      .eq('report_id', reportId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return {}

    return {
      rebuttal: {
        id: data.id,
        reportId: data.report_id,
        applicationId: data.application_id ?? null,
        disputedDimensions: data.disputed_dimensions ?? [],
        evidenceStatement: data.evidence_statement ?? '',
        evidenceUrls: data.evidence_urls ?? [],
        status: data.status ?? 'pending',
        previousScore: data.previous_score ?? null,
        newScore: data.new_score ?? null,
        deltaSummary: data.delta_summary ?? null,
        rescreenError: data.rescreen_error ?? null,
        createdAt: data.submitted_at,
      },
    }
  } catch (err) {
    console.error('[getRebuttalDetail] Error:', err)
    return { error: err instanceof Error ? err.message : 'Failed to load rebuttal detail.' }
  }
}

export async function triggerRebuttalRescreen(
  rebuttalId: string
): Promise<{ error?: string; status?: string; httpStatus?: number }> {
  const res = await fetchAgentsEngine(`/api/v1/agents/copilot/rebuttals/${rebuttalId}/rescreen`, {
    method: 'POST',
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    // 409 while one is already in flight isn't a failure worth alarming over —
    // the caller should just resume polling instead of showing a hard error.
    return { error: res.error, httpStatus: res.status }
  }

  return { status: res.data.status }
}

export interface ResolveRebuttalOutcome {
  error?: string
  status?: string
  updatedScore?: number
  applicationStatus?: string
  emailDispatched?: boolean
}

export async function resolveRebuttalAction(
  rebuttalId: string,
  action: 'accept' | 'refine' | 'decline',
  recruiterNotes?: string,
  manualOverrides?: { compositeScore?: number; recommendation?: string }
): Promise<ResolveRebuttalOutcome> {
  const res = await fetchAgentsEngine(`/api/v1/agents/copilot/rebuttals/${rebuttalId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, recruiterNotes, dispatchEmail: true, manualOverrides }),
  })

  if (!res.ok) {
    return { error: res.error }
  }

  revalidatePath('/dashboard/applications')
  logActivity({
    action: `rebuttal_${action}`,
    targetType: 'rebuttal',
    targetId: rebuttalId,
    details: { recruiterNotes, updatedScore: res.data.result?.updatedScore },
  }).catch(() => {})

  return {
    status: res.data.result?.status,
    updatedScore: res.data.result?.updatedScore,
    applicationStatus: res.data.result?.applicationStatus,
    emailDispatched: res.data.result?.emailDispatched,
  }
}

export interface FreshFeedbackLetter {
  subject: string
  greeting: string
  executiveFeedback: string
  body: string
  verifiedStrengthsHighlighted?: string[]
  growthOpportunitiesAndGaps?: string[]
  closingNote?: string
}

export async function getFreshFeedbackLetter(
  applicationId: string
): Promise<{ letter?: FreshFeedbackLetter; error?: string }> {
  const res = await fetchAgentsEngine(`/api/v1/agents/hr/feedback-letter/${applicationId}`, {
    method: 'GET',
  })

  if (!res.ok) {
    return { error: res.error }
  }

  return { letter: res.data.letter }
}

export async function getScreeningResultsForApplications(
  applicationIds: string[]
): Promise<Record<string, AgentScreeningResult>> {
  if (applicationIds.length === 0) return {}
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('agent_screening_results')
      .select('*')
      .in('application_id', applicationIds)
      .order('screened_at', { ascending: false })

    const map: Record<string, AgentScreeningResult> = {}
    data?.forEach((row: any) => {
      if (!map[row.application_id]) map[row.application_id] = row as AgentScreeningResult
    })
    return map
  } catch (err) {
    console.error('[getScreeningResultsForApplications] Error:', err)
    return {}
  }
}
