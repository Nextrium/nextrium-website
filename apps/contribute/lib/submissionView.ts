import { isStaffOnlyIssue, memberResubmissionView, type ResubmissionAssessment } from '@nextrium/contributions-core/reviewMapping'

// How a contributor sees their own submission: its state in plain words,
// what they can do next, and the review feedback with staff-only items
// (scope and security notes) removed.

/** Attempts allowed per task; the database refuses a fourth. */
export const MAX_ATTEMPTS = 3

export interface OwnSubmission {
  status: string | null
  review_decision: string | null
  notes: string | null
  submission_count: number | null
}

export type SubmissionTone = 'pending' | 'progress' | 'good' | 'action' | 'bad'

export interface SubmissionState {
  label: string
  hint: string
  tone: SubmissionTone
  canResubmit: boolean
  canRetryReview: boolean
}

export function submissionState(s: OwnSubmission): SubmissionState {
  const attempts = s.submission_count ?? 1
  const none = { canResubmit: false, canRetryReview: false }

  if (s.status === 'verified') return { label: 'Verified', hint: 'Points awarded.', tone: 'good', ...none }
  if (s.status === 'ai_approved') {
    return { label: 'Passed review', hint: 'Passed the automated review. Awaiting final verification by the core team.', tone: 'progress', ...none }
  }
  if (s.status === 'rejected') {
    // A reviewer's note makes a rejection final; the automated review's does not.
    if (!s.notes && attempts < MAX_ATTEMPTS) {
      return { label: 'Changes requested', hint: 'Address the review feedback and resubmit your work.', tone: 'action', canResubmit: true, canRetryReview: false }
    }
    return { label: 'Not accepted', hint: s.notes ? 'The core team has made a final decision on this submission.' : 'No attempts left on this task.', tone: 'bad', ...none }
  }
  if ((s.status === 'submitted' || s.status === 'under_review') && !s.review_decision) {
    return { label: 'Awaiting review', hint: 'The automated review has not completed. You can run it again.', tone: 'pending', canResubmit: false, canRetryReview: true }
  }
  // under_review, or a review decision recorded by the old portal: with the team.
  return { label: 'With the team', hint: 'Your submission is with the core team for review.', tone: 'pending', ...none }
}

export interface MemberFeedback {
  summary: string
  issues: { check: string; message: string }[]
  whatToDo: string
  checks: { name: string; passed: boolean }[]
  resubmission: ResubmissionAssessment | null
}

/** Review feedback as the contributor may see it. Never includes staff-only items or the code audit. */
export function memberFeedback(raw: unknown): MemberFeedback | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  const issues = Array.isArray(f.issues)
    ? f.issues
        .filter((i): i is { check: string; message: string } => !!i && typeof (i as any).check === 'string' && typeof (i as any).message === 'string')
        .filter((i) => !isStaffOnlyIssue(i.check))
        .map((i) => ({ check: i.check, message: i.message }))
    : []
  const seen = new Set<string>()
  const uniqueIssues = issues.filter((i) => {
    const key = i.message.trim().toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const checks = f.checks && typeof f.checks === 'object'
    ? Object.entries(f.checks as Record<string, unknown>)
        .filter(([k, v]) => typeof v === 'boolean' && !isStaffOnlyIssue(k))
        .map(([name, passed]) => ({ name, passed: passed as boolean }))
    : []
  const summary = typeof f.summary === 'string' ? f.summary : ''
  const whatToDo = typeof f.what_to_do === 'string' ? f.what_to_do : ''
  const resubmission = memberResubmissionView(f.resubmission_assessment as ResubmissionAssessment | undefined)
  if (!summary && !whatToDo && uniqueIssues.length === 0 && checks.length === 0 && !resubmission) return null
  return { summary, issues: uniqueIssues, whatToDo, checks, resubmission }
}

/** "evidence_quality" → "Evidence quality". */
export function checkLabel(name: string): string {
  const s = name.replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
