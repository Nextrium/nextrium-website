'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchAgentsEngine } from '@/lib/agentsEngine'
import { logActivity } from '@/lib/activityLog'
import { getVerifiedDashboardRole } from '@/lib/dashboard/getRole'
import { roleDenial, STAFF_ROLES } from '@/lib/dashboard/requireRole'
import { findAuthUserIdByEmail, grantDashboardAccess, isEmailAlreadyRegistered } from '@/lib/dashboard/teamAccounts'
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
    const denied = await roleDenial(STAFF_ROLES)
    if (denied) return { error: denied }
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

    // No revalidatePath here (or in archive/unarchive): the client already
    // applies the returned info to its own state, and revalidating re-runs
    // the whole heavy applications page on the server for every click.
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

export interface ArchivedInfo {
  archived: boolean
  archivedAt: string | null
  archivedReason: string | null
  archivedByEmail: string | null
}

/**
 * Archives an application: takes it out of the active pipeline entirely and
 * suppresses all future contact (screening, rescreening, and every email
 * trigger, enforced server-side in agents-engine and at the /api/email
 * chokepoint - this action only sets the flag those checks read). Reason is
 * optional; recorded for context but never required, since the trigger is
 * often "a human read a reply and needs to act immediately," not a formal
 * review process.
 */
export async function archiveApplication(applicationId: string, reason?: string): Promise<{ archived?: ArchivedInfo; error?: string }> {
  try {
    const denied = await roleDenial(STAFF_ROLES)
    if (denied) return { error: denied }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not signed in.' }

    const serviceClient = createServiceClient()
    const now = new Date().toISOString()

    const { data: updated, error } = await (serviceClient.from('applications') as any)
      .update({
        archived: true,
        archived_at: now,
        archived_reason: reason?.trim() || null,
        archived_by: user.id,
        archived_by_email: user.email,
      })
      .eq('id', applicationId)
      .select('archived, archived_at, archived_reason, archived_by_email')
      .single()

    if (error) throw new Error(error.message)

    logActivity({
      action: 'application_archived',
      targetType: 'application',
      targetId: applicationId,
      details: { reason: updated.archived_reason },
    }).catch(() => {})

    return {
      archived: {
        archived: updated.archived,
        archivedAt: updated.archived_at,
        archivedReason: updated.archived_reason,
        archivedByEmail: updated.archived_by_email,
      },
    }
  } catch (err) {
    console.error('[archiveApplication] Error:', err)
    return { error: err instanceof Error ? err.message : 'Failed to archive application.' }
  }
}

export async function unarchiveApplication(applicationId: string): Promise<{ archived?: ArchivedInfo; error?: string }> {
  try {
    const denied = await roleDenial(STAFF_ROLES)
    if (denied) return { error: denied }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not signed in.' }

    const serviceClient = createServiceClient()
    const { data: updated, error } = await (serviceClient.from('applications') as any)
      .update({
        archived: false,
        archived_at: null,
        archived_reason: null,
        archived_by: null,
        archived_by_email: null,
      })
      .eq('id', applicationId)
      .select('archived, archived_at, archived_reason, archived_by_email')
      .single()

    if (error) throw new Error(error.message)

    logActivity({
      action: 'application_unarchived',
      targetType: 'application',
      targetId: applicationId,
    }).catch(() => {})

    return {
      archived: {
        archived: updated.archived,
        archivedAt: updated.archived_at,
        archivedReason: updated.archived_reason,
        archivedByEmail: updated.archived_by_email,
      },
    }
  } catch (err) {
    console.error('[unarchiveApplication] Error:', err)
    return { error: err instanceof Error ? err.message : 'Failed to unarchive application.' }
  }
}

export async function deleteApplication(id: string): Promise<{ error?: string }> {
  try {
    const denied = await roleDenial(STAFF_ROLES)
    if (denied) return { error: denied }
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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
    last_emailed_recommendation: (screeningRecord as any)?.last_emailed_recommendation ?? null,
    last_emailed_at: (screeningRecord as any)?.last_emailed_at ?? null,
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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
  needsTrackAssignment?: boolean
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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
    const denied = await roleDenial(STAFF_ROLES)
    if (denied) return { error: denied }
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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
  const denied = await roleDenial(STAFF_ROLES)
  if (denied) return { error: denied }

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
  if (await roleDenial(STAFF_ROLES)) return {}
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

// Invites an accepted applicant onto the dashboard as a "member" — reuses
// the same raw Supabase invite endpoint Team Access uses for staff
// invites. Re-checks status server-side (not just trusting the UI only
// showing this button for accepted applications) and checks
// invited_to_team_at first so a double-click or a stale page can't send a
// second invite email or create a duplicate dashboard_users row.
export async function inviteApplicantToTeam(
  applicationId: string
): Promise<{ error?: string; existingAccount?: boolean; existingRole?: string }> {
  try {
    // Creating accounts is staff-only. Signed-in is not enough now that
    // low-privilege member accounts exist, and server actions can be called
    // outside the page that renders them, so the role is checked here, with
    // a verified identity, not left to the page's middleware gate.
    const role = await getVerifiedDashboardRole()
    if (role !== 'admin' && role !== 'moderator') {
      return { error: 'You do not have permission to invite applicants.' }
    }

    const supabase = createServiceClient()

    const { data: application, error: fetchError } = await (supabase.from('applications') as any)
      .select('id, name, email, status, invited_to_team_at')
      .eq('id', applicationId)
      .single()
    if (fetchError || !application) throw new Error(fetchError?.message ?? 'Application not found.')
    if (application.status !== 'accepted') throw new Error('Only accepted applicants can be invited to the team.')
    if (application.invited_to_team_at) throw new Error('This applicant has already been invited.')

    const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY!
    const siteUrl        = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nextrium.org'
    const redirectTo     = `${siteUrl}/auth/callback`

    const res = await fetch(`${supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        supabaseSecret,
        'Authorization': `Bearer ${supabaseSecret}`,
      },
      body: JSON.stringify({
        email: application.email,
        data: { role: 'member' },
        redirect_to: redirectTo,
      }),
    })

    const rawText = await res.text()
    let json: any = {}
    try {
      json = JSON.parse(rawText)
    } catch {
      throw new Error(`Supabase returned unexpected response (${res.status}): ${rawText.slice(0, 200)}`)
    }
    let existingAccount = false
    let existingRole: string | undefined

    if (!res.ok) {
      if (!isEmailAlreadyRegistered(json)) {
        throw new Error(json.message ?? json.error_description ?? json.msg ?? 'Failed to invite applicant.')
      }
      // The applicant already has an account: give it team access directly
      // (an account that already has a dashboard role keeps that role).
      const existingId = await findAuthUserIdByEmail(application.email)
      if (!existingId) throw new Error('This email already has an account that could not be found. Please try again.')
      const grant = await grantDashboardAccess(existingId, 'member', applicationId, true)
      if (grant.status === 'archived') {
        throw new Error('This person has an archived team account. Unarchive it in Team Access first.')
      }
      existingAccount = true
      if (grant.status === 'exists') existingRole = grant.role
    } else {
      const userId = json.id
      if (!userId) throw new Error('Invite succeeded but no user ID was returned.')
      const { error: insertError } = await (supabase.from('dashboard_users') as any).insert({
        user_id: userId,
        role: 'member',
        is_team_member: true,
        application_id: applicationId,
      })
      if (insertError) {
        // The invite email has already gone out by this point, so say so instead of
        // showing a raw database error that implies nothing happened.
        throw new Error(
          `The invitation email was sent, but dashboard access could not be saved (${insertError.message}). ` +
          'Click Invite to Team again to finish granting access; the applicant does not need a new email.'
        )
      }
    }

    const now = new Date().toISOString()

    const { error: updateError } = await (supabase.from('applications') as any)
      .update({ invited_to_team_at: now })
      .eq('id', applicationId)
    if (updateError) throw new Error(updateError.message)

    revalidatePath('/dashboard/applications')
    logActivity({
      action: 'applicant_invited_to_team',
      targetType: 'application',
      targetId: applicationId,
      details: { email: application.email, existingAccount },
    }).catch(() => {})
    return { existingAccount, existingRole }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite applicant.' }
  }
}
