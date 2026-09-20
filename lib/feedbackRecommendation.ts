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
