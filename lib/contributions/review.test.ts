import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasMemberFixableFailure, isStaffOnlyIssue, mapReviewResponse } from './reviewMapping'
import { signReviewBody } from './reviewSignature'

const base = {
  overall_score: 85,
  checks: { title_descriptive: true },
  feedback: { summary: 'Good', issues: [{ check: 'x', message: 'y' }, { bad: true }], what_to_do: 'Nothing' },
  review_metadata: { model_used: 'gemini-2.5-flash' },
}

test('signature matches the review service contract test vector', () => {
  assert.equal(
    signReviewBody('{"a":1}', 'test-secret'),
    'sha256=179bf20a8b9040a32368814a68b0dc270823b5968498e0a73796c4202708ed8d',
  )
})

test('rejected with a failed member check maps to changes_requested', () => {
  assert.equal(mapReviewResponse({ ...base, decision: 'rejected', checks: { title_descriptive: false } })?.status, 'changes_requested')
})

test('human_required maps to needs_human', () => {
  assert.equal(mapReviewResponse({ ...base, decision: 'human_required', overall_score: 0 })?.status, 'needs_human')
})

test('approved with no security issues maps to ai_approved', () => {
  const m = mapReviewResponse({ ...base, decision: 'approved', code_audit: { security_issues: [] } })
  assert.equal(m?.status, 'ai_approved')
  assert.equal(m?.decision, 'approved')
  assert.equal(m?.score, 85)
  assert.equal(m?.modelUsed, 'gemini-2.5-flash')
})

test('approved with any security issue goes to a human', () => {
  for (const severity of ['low', 'medium', 'high', 'critical']) {
    const m = mapReviewResponse({ ...base, decision: 'approved', code_audit: { security_issues: [{ severity, description: 'd' }] } })
    assert.equal(m?.status, 'needs_human', severity)
  }
  assert.equal(mapReviewResponse({ ...base, decision: 'approved', code_audit: { security_issues: [], has_critical_security_issue: true } })?.status, 'needs_human')
})

test('malformed or unknown responses are not reviews', () => {
  for (const body of [null, 'x', {}, { decision: 'maybe' }, { decision: 'verified' }, []]) {
    assert.equal(mapReviewResponse(body), null, JSON.stringify(body))
  }
})

test('feedback is normalised and bad issues dropped', () => {
  const m = mapReviewResponse({ ...base, decision: 'rejected' })
  assert.deepEqual(m?.feedback?.issues, [{ check: 'x', message: 'y' }])
})

test('score is clamped and non-numbers become null', () => {
  assert.equal(mapReviewResponse({ ...base, decision: 'rejected', overall_score: 140 })?.score, 100)
  assert.equal(mapReviewResponse({ ...base, decision: 'rejected', overall_score: 'high' })?.score, null)
})

test('a rejection for scope alone goes to staff, not back to the member', () => {
  const body = { decision: 'rejected', overall_score: 70, checks: { title_descriptive: true, complexity_proportionate: false, evidence_url_present: true } }
  assert.equal(mapReviewResponse(body)?.status, 'needs_human')
})

test('a rejection with every check passing goes to staff', () => {
  const body = { decision: 'rejected', overall_score: 100, checks: { title_descriptive: true, complexity_proportionate: true },
    feedback: { summary: 'Excellent', issues: [{ check: 'security_high', message: '[HIGH] ...' }], what_to_do: '' } }
  assert.equal(mapReviewResponse(body)?.status, 'needs_human')
})

test('a rejection with no checks reported goes to staff', () => {
  assert.equal(mapReviewResponse({ decision: 'rejected' })?.status, 'needs_human')
})

test('a rejection with any member-fixable failure goes back to the member', () => {
  assert.equal(mapReviewResponse({ decision: 'rejected', checks: { complexity_proportionate: false, description_substance: false } })?.status, 'changes_requested')
  assert.equal(mapReviewResponse({ decision: 'rejected', checks: { description_substance: false } })?.status, 'changes_requested')
})

test('hasMemberFixableFailure ignores scope and security checks', () => {
  assert.equal(hasMemberFixableFailure({ description_substance: false }), true)
  assert.equal(hasMemberFixableFailure({ complexity_proportionate: false }), false)
  assert.equal(hasMemberFixableFailure({ security_high: false }), false)
  assert.equal(hasMemberFixableFailure({ a: true }), false)
  assert.equal(hasMemberFixableFailure(null), false)
})

test('isStaffOnlyIssue covers scope and every security note', () => {
  for (const c of ['complexity_proportionate', 'security_high', 'security_medium', 'security']) assert.equal(isStaffOnlyIssue(c), true, c)
  for (const c of ['title_descriptive', 'description_substance', '', null, undefined]) assert.equal(isStaffOnlyIssue(c), false, String(c))
})
