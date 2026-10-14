import type { ReviewedStatus } from '@nextrium/contributions-core/reviewMapping'

// Rules for storing a submission in the community database, which has fewer
// statuses than the main program: submitted, under_review, ai_approved,
// verified, rejected.

export type CommunityReviewStatus = 'under_review' | 'ai_approved' | 'rejected'

/**
 * Where a reviewed submission goes. The mapping itself is the program-wide
 * one from contributions-core:
 *   changes_requested → rejected, with no reviewer note, so the contributor may resubmit
 *   needs_human       → under_review, waiting for the core team (scope and security doubts land here)
 *   ai_approved       → ai_approved, waiting for the core team to verify and award points
 * Nothing here ever produces 'verified': points always need a person.
 *
 * Never 'submitted': the database counts an attempt (enforce_submission_count)
 * on any update that leaves a row at 'submitted', so storing a result there
 * would use up one of the contributor's three attempts.
 */
export function communityStatus(status: ReviewedStatus): CommunityReviewStatus {
  if (status === 'changes_requested') return 'rejected'
  if (status === 'ai_approved') return 'ai_approved'
  return 'under_review'
}

/**
 * Points recorded with a new submission: the middle of the task's range.
 * The core team sets the final score at verification; until then this is
 * only an estimate, never awarded on its own.
 */
export function basePointsFor(min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return Math.round((lo + hi) / 2)
}
