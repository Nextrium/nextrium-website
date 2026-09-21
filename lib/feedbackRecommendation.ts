// Mirrors agents-engine/src/lib/feedbackRecommendation.ts exactly — the
// feedback letter is one of exactly 4 fixed templates keyed by this
// normalized bucket, so this is the same content fingerprint used
// server-side to decide "was this exact result already emailed." Kept in
// sync by hand since the two repos don't share a package; if the backend's
// bucket rules ever change, this needs updating to match.
export function normalizeFeedbackRecommendation(rec: string | null | undefined): 'Strong Hire' | 'Proceed to Recruiter Screen' | 'Hold' | 'Reject' {
  const norm = (rec || '').trim().toLowerCase()
  if (norm.includes('technical interview') || norm.includes('strong hire') || norm.includes('founding team')) {
    return 'Strong Hire'
  }
  if (norm.includes('recruiter screen') || norm.includes('further review') || norm.includes('shortlist')) {
    return 'Proceed to Recruiter Screen'
  }
  if (norm.includes('hold') || norm.includes('pipeline') || norm.includes('future cohort') || norm.includes('ecosystem entry')) {
    return 'Hold'
  }
  return 'Reject'
}

// True when the current recommendation's bucket matches whatever bucket
// was actually last emailed for this screening result — i.e. resending now
// would produce a byte-identical email.
export function alreadyEmailedThisResult(screening: { email_sent?: boolean | null; recommendation?: string | null; last_emailed_recommendation?: string | null } | null | undefined): boolean {
  if (!screening?.email_sent || !screening.last_emailed_recommendation) return false
  return normalizeFeedbackRecommendation(screening.recommendation) === screening.last_emailed_recommendation
}

// Mirrors agents-engine/src/services/emailDispatch.ts's
// humanConfirmedCurrentResult gate exactly, so this dashboard's bulk-send
// count/badge never disagrees with what the backend will actually do.
// Strong Hire candidates are reserved for personal recruiter outreach
// until a human has reviewed (applications.last_reviewed_at) at or after
// the moment this specific recommendation was decided (screened_at,
// bumped on rebuttal-accept too) — a stale review from before a rescreen
// or rebuttal doesn't count as approving the current result.
export function isHeldForHumanConfirmation(
  screening: { recommendation?: string | null; screened_at?: string | null } | null | undefined,
  application: { last_reviewed_at?: string | null } | null | undefined
): boolean {
  if (!screening) return false
  if (normalizeFeedbackRecommendation(screening.recommendation) !== 'Strong Hire') return false
  const reviewedAt = application?.last_reviewed_at ? new Date(application.last_reviewed_at).getTime() : 0
  const decidedAt = screening.screened_at ? new Date(screening.screened_at).getTime() : Infinity
  return !(reviewedAt > 0 && reviewedAt >= decidedAt)
}
