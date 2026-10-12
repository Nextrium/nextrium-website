// Maps a review service response to the contribution status we store.
// Pure, so the mapping table is reviewed and tested in one place.
//
//   service decision  condition                          contribution status
//   ─────────────────────────────────────────────────────────────────────────
//   rejected          any                                changes_requested
//   human_required    any (incl. the service's escalation
//                     on the third submission)           needs_human
//   approved          any code-audit security issue      needs_human
//   approved          no security issues                 ai_approved
//   anything else     malformed / unknown                (null → review_failed)
//
// No mapping ever produces 'verified': points and completion need a staff
// verification.

export type ReviewedStatus = 'changes_requested' | 'needs_human' | 'ai_approved'

export interface MappedReview {
  status: ReviewedStatus
  decision: 'approved' | 'rejected' | 'human_required'
  score: number | null
  checks: Record<string, boolean> | null
  feedback: { summary: string; issues: { check: string; message: string }[]; what_to_do: string; resubmission_assessment?: unknown } | null
  codeAudit: unknown
  modelUsed: string | null
}

function hasSecurityIssues(codeAudit: unknown): boolean {
  if (!codeAudit || typeof codeAudit !== 'object') return false
  const a = codeAudit as { security_issues?: unknown; has_critical_security_issue?: unknown }
  return a.has_critical_security_issue === true || (Array.isArray(a.security_issues) && a.security_issues.length > 0)
}

/** Returns the mapped review, or null when the response isn't a usable review. */
export function mapReviewResponse(body: unknown): MappedReview | null {
  if (!body || typeof body !== 'object') return null
  const r = body as Record<string, any>
  const decision = r.decision
  if (decision !== 'approved' && decision !== 'rejected' && decision !== 'human_required') return null

  let status: ReviewedStatus
  if (decision === 'rejected') status = 'changes_requested'
  else if (decision === 'human_required') status = 'needs_human'
  else status = hasSecurityIssues(r.code_audit) ? 'needs_human' : 'ai_approved'

  const score = typeof r.overall_score === 'number' && Number.isFinite(r.overall_score)
    ? Math.max(0, Math.min(100, r.overall_score)) : null
  const f = r.feedback && typeof r.feedback === 'object' ? r.feedback : null

  return {
    status,
    decision,
    score,
    checks: r.checks && typeof r.checks === 'object' ? r.checks : null,
    feedback: f ? {
      summary: typeof f.summary === 'string' ? f.summary : '',
      issues: Array.isArray(f.issues)
        ? f.issues.filter((i: any) => i && typeof i.check === 'string' && typeof i.message === 'string')
            .map((i: any) => ({ check: i.check, message: i.message }))
        : [],
      what_to_do: typeof f.what_to_do === 'string' ? f.what_to_do : '',
      ...(f.resubmission_assessment ? { resubmission_assessment: f.resubmission_assessment } : {}),
    } : null,
    codeAudit: r.code_audit ?? null,
    modelUsed: typeof r.review_metadata?.model_used === 'string' ? r.review_metadata.model_used : null,
  }
}
