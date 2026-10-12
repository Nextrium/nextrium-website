// Review analytics for staff, computed from the contributor program tables.
// Pure, so every metric is tested in one place; the page only loads rows.

import { CONTRIBUTION_STATUSES, REVIEW_DECISIONS, type ContributionStatus, type ReviewDecision } from './constants'

export interface AnalyticsContributionRow {
  id: string
  status: string
  submission_count: number
  submitted_at: string
  review_failure_count: number | null
}

export interface AnalyticsReviewRow {
  contribution_id: string
  submission_number: number
  source: string
  decision: string
  overall_score: number | string | null
  created_at: string
}

export const SCORE_BUCKETS = [
  { label: '0–19', min: 0, max: 20 },
  { label: '20–39', min: 20, max: 40 },
  { label: '40–59', min: 40, max: 60 },
  { label: '60–79', min: 60, max: 80 },
  { label: '80–100', min: 80, max: Infinity },
] as const

export interface ReviewAnalytics {
  contributions: number
  submissions: number
  serviceReviews: number
  staffReviews: number
  decisionMix: Record<ReviewDecision, number>
  statusMix: Record<ContributionStatus, number>
  scoreBuckets: { label: string; count: number }[]
  averageScore: number | null
  failures: number
  /** Failed service calls over all service calls (failed + answered); null with no calls. */
  failureRate: number | null
  /** Hours from submission to the service result, current submissions only. */
  turnaroundHours: { median: number | null; p90: number | null; samples: number }
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[i]
}

export function computeReviewAnalytics(
  contributions: AnalyticsContributionRow[],
  reviews: AnalyticsReviewRow[],
): ReviewAnalytics {
  const decisionMix = Object.fromEntries(REVIEW_DECISIONS.map((d) => [d, 0])) as Record<ReviewDecision, number>
  const statusMix = Object.fromEntries(CONTRIBUTION_STATUSES.map((s) => [s, 0])) as Record<ContributionStatus, number>
  const scoreBuckets = SCORE_BUCKETS.map((b) => ({ label: b.label, count: 0 }))

  let submissions = 0
  let failures = 0
  const byId = new Map<string, AnalyticsContributionRow>()
  for (const c of contributions) {
    byId.set(c.id, c)
    submissions += Math.max(1, c.submission_count)
    failures += Math.max(0, c.review_failure_count ?? 0)
    if (Object.hasOwn(statusMix, c.status)) statusMix[c.status as ContributionStatus]++
  }

  let serviceReviews = 0
  let staffReviews = 0
  let scoreSum = 0
  let scored = 0
  const turnarounds: number[] = []
  for (const r of reviews) {
    if (r.source === 'staff') {
      staffReviews++
      continue
    }
    if (r.source !== 'service') continue
    serviceReviews++
    if (Object.hasOwn(decisionMix, r.decision)) decisionMix[r.decision as ReviewDecision]++

    const score = r.overall_score === null ? NaN : Number(r.overall_score)
    if (Number.isFinite(score)) {
      scoreSum += score
      scored++
      const bucket = SCORE_BUCKETS.findIndex((b) => score >= b.min && score < b.max)
      scoreBuckets[bucket === -1 ? 0 : bucket].count++
    }

    // submitted_at is reset on each resubmission, so only the current
    // submission's result has a known start time.
    const c = byId.get(r.contribution_id)
    if (c && c.submission_count === r.submission_number) {
      const hours = (new Date(r.created_at).getTime() - new Date(c.submitted_at).getTime()) / 3_600_000
      if (Number.isFinite(hours) && hours >= 0) turnarounds.push(hours)
    }
  }

  turnarounds.sort((a, b) => a - b)
  const calls = serviceReviews + failures
  return {
    contributions: contributions.length,
    submissions,
    serviceReviews,
    staffReviews,
    decisionMix,
    statusMix,
    scoreBuckets,
    averageScore: scored ? scoreSum / scored : null,
    failures,
    failureRate: calls ? failures / calls : null,
    turnaroundHours: {
      median: percentile(turnarounds, 0.5),
      p90: percentile(turnarounds, 0.9),
      samples: turnarounds.length,
    },
  }
}

/** "45 min", "3.2 h" or "2.5 d" for a duration in hours. */
export function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
  if (hours < 48) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} d`
}
