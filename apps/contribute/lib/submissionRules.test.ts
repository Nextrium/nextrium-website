import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapReviewResponse } from '@nextrium/contributions-core/reviewMapping'
import { basePointsFor, communityStatus } from './submissionRules'

const status = (body: unknown) => {
  const m = mapReviewResponse(body)
  return m ? communityStatus(m.status) : null
}

test('a fixable rejection goes back to the contributor', () => {
  assert.equal(status({ decision: 'rejected', checks: { evidence_quality: false } }), 'rejected')
})

test('scope-only or security-only rejections wait for the team instead', () => {
  assert.equal(status({ decision: 'rejected', checks: { complexity_proportionate: false } }), 'under_review')
  assert.equal(status({ decision: 'rejected', checks: { security_scan: false, evidence_quality: true } }), 'under_review')
})

test('escalations and flagged approvals wait for the team', () => {
  assert.equal(status({ decision: 'human_required' }), 'under_review')
  assert.equal(status({ decision: 'approved', code_audit: { security_issues: [{ severity: 'low' }] } }), 'under_review')
  assert.equal(status({ decision: 'approved', code_audit: { has_critical_security_issue: true } }), 'under_review')
})

test('a clean approval is pre-approved, never verified', () => {
  assert.equal(status({ decision: 'approved', code_audit: { security_issues: [] } }), 'ai_approved')
  assert.equal(status({ decision: 'verified' }), null)
  assert.equal(status(null), null)
})

test('base points sit in the middle of the task range', () => {
  assert.equal(basePointsFor(150, 280), 215)
  assert.equal(basePointsFor(50, 120), 85)
  assert.equal(basePointsFor(10, 30), 20)
  assert.equal(basePointsFor(30, 10), 20)
})
