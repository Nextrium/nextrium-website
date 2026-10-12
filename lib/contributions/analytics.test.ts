import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReviewAnalytics, formatHours, type AnalyticsContributionRow, type AnalyticsReviewRow } from './analytics'

const contribution = (over: Partial<AnalyticsContributionRow>): AnalyticsContributionRow => ({
  id: 'c1',
  status: 'ai_approved',
  submission_count: 1,
  submitted_at: '2026-09-01T10:00:00Z',
  review_failure_count: 0,
  ...over,
})

const review = (over: Partial<AnalyticsReviewRow>): AnalyticsReviewRow => ({
  contribution_id: 'c1',
  submission_number: 1,
  source: 'service',
  decision: 'approved',
  overall_score: 80,
  created_at: '2026-09-01T12:00:00Z',
  ...over,
})

test('empty data gives zeros and nulls, not NaN', () => {
  const a = computeReviewAnalytics([], [])
  assert.equal(a.contributions, 0)
  assert.equal(a.failureRate, null)
  assert.equal(a.averageScore, null)
  assert.deepEqual(a.turnaroundHours, { median: null, p90: null, samples: 0 })
})

test('decision mix, staff reviews and score buckets', () => {
  const a = computeReviewAnalytics(
    [contribution({ id: 'c1' }), contribution({ id: 'c2', status: 'changes_requested' })],
    [
      review({ contribution_id: 'c1', decision: 'approved', overall_score: '92.50' }),
      review({ contribution_id: 'c2', decision: 'rejected', overall_score: 15 }),
      review({ contribution_id: 'c2', source: 'staff', decision: 'changes_requested', overall_score: null }),
      review({ contribution_id: 'c2', decision: 'something_new', overall_score: null }),
    ],
  )
  assert.equal(a.serviceReviews, 3)
  assert.equal(a.staffReviews, 1)
  assert.deepEqual(a.decisionMix, { approved: 1, rejected: 1, human_required: 0 })
  assert.deepEqual(a.scoreBuckets.map((b) => b.count), [1, 0, 0, 0, 1])
  assert.equal(a.averageScore, (92.5 + 15) / 2)
  assert.equal(a.statusMix.ai_approved, 1)
  assert.equal(a.statusMix.changes_requested, 1)
})

test('score of exactly 100 lands in the top bucket, out-of-range low scores in the bottom', () => {
  const a = computeReviewAnalytics([contribution({})], [review({ overall_score: 100 }), review({ overall_score: -3 })])
  assert.deepEqual(a.scoreBuckets.map((b) => b.count), [1, 0, 0, 0, 1])
})

test('failure rate counts failed calls against all calls', () => {
  const a = computeReviewAnalytics(
    [contribution({ id: 'c1', review_failure_count: 2 }), contribution({ id: 'c2', review_failure_count: null })],
    [review({ contribution_id: 'c1' }), review({ contribution_id: 'c2' })],
  )
  assert.equal(a.failures, 2)
  assert.equal(a.failureRate, 0.5)
})

test('turnaround uses the current submission only', () => {
  const a = computeReviewAnalytics(
    [contribution({ id: 'c1', submission_count: 2, submitted_at: '2026-09-02T00:00:00Z' })],
    [
      review({ submission_number: 1, created_at: '2026-09-01T01:00:00Z' }),
      review({ submission_number: 2, created_at: '2026-09-02T03:00:00Z' }),
    ],
  )
  assert.deepEqual(a.turnaroundHours, { median: 3, p90: 3, samples: 1 })
  assert.equal(a.submissions, 2)
})

test('unknown statuses and prototype keys are ignored', () => {
  const a = computeReviewAnalytics([contribution({ status: 'toString' })], [review({ decision: 'constructor' })])
  assert.equal(Object.values(a.statusMix).reduce((s, n) => s + n, 0), 0)
  assert.equal(Object.values(a.decisionMix).reduce((s, n) => s + n, 0), 0)
})

test('formatHours', () => {
  assert.equal(formatHours(null), '—')
  assert.equal(formatHours(0.001), '1 min')
  assert.equal(formatHours(0.5), '30 min')
  assert.equal(formatHours(3.24), '3.2 h')
  assert.equal(formatHours(60), '2.5 d')
})
