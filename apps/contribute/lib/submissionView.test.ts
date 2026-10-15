import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkLabel, memberFeedback, submissionState } from './submissionView'

const s = (status: string, extra: Partial<{ review_decision: string | null; notes: string | null; submission_count: number }> = {}) =>
  submissionState({ status, review_decision: null, notes: null, submission_count: 1, ...extra })

test('automated rejections can be resubmitted until attempts run out', () => {
  assert.equal(s('rejected', { review_decision: 'rejected' }).canResubmit, true)
  assert.equal(s('rejected', { review_decision: 'rejected', submission_count: 2 }).canResubmit, true)
  const last = s('rejected', { review_decision: 'rejected', submission_count: 3 })
  assert.equal(last.canResubmit, false)
  assert.equal(last.label, 'Not accepted')
})

test('a reviewer note makes a rejection final', () => {
  const final = s('rejected', { review_decision: 'rejected', notes: 'Plagiarised.' })
  assert.equal(final.canResubmit, false)
  assert.equal(final.tone, 'bad')
})

test('a review that never completed can be retried, not resubmitted', () => {
  const stuck = s('submitted')
  assert.equal(stuck.canRetryReview, true)
  assert.equal(stuck.canResubmit, false)
  assert.equal(s('under_review').canRetryReview, true)
  const escalated = s('under_review', { review_decision: 'human_required' })
  assert.equal(escalated.canRetryReview, false)
  assert.equal(escalated.label, 'With the team')
})

test('approved and verified states offer no actions', () => {
  for (const st of ['ai_approved', 'verified']) {
    const v = s(st, { review_decision: 'approved' })
    assert.equal(v.canResubmit || v.canRetryReview, false, st)
  }
})

test('feedback hides staff-only checks, security issues and duplicates', () => {
  const fb = memberFeedback({
    summary: 'Good work.',
    issues: [
      { check: 'evidence_quality', message: 'Link the PR.' },
      { check: 'evidence_quality', message: 'link the PR.' },
      { check: 'complexity_proportionate', message: 'Too small for large.' },
      { check: 'security_secrets', message: 'Key in repo.' },
      { nope: true },
    ],
    what_to_do: 'Add the PR link.',
    checks: { evidence_quality: false, brief_alignment: true, complexity_proportionate: false, security_scan: false },
    code_audit: { security_issues: [{ severity: 'high' }] },
    resubmission_assessment: { summary: 'Better.', previous_issues_resolved: [{ check: 'brief_alignment', status: 'resolved', explanation: 'Done' }] },
  })
  assert.ok(fb)
  assert.deepEqual(fb!.issues, [{ check: 'evidence_quality', message: 'Link the PR.' }])
  assert.deepEqual(fb!.checks.map((c) => c.name), ['evidence_quality', 'brief_alignment'])
  assert.ok(!JSON.stringify(fb).includes('severity'))
  assert.equal(fb!.resubmission?.summary, 'Better.')
})

test('empty or malformed feedback shows nothing', () => {
  assert.equal(memberFeedback(null), null)
  assert.equal(memberFeedback('x'), null)
  assert.equal(memberFeedback({ issues: [{ check: 'security_x', message: 'hidden' }] }), null)
  assert.equal(checkLabel('evidence_quality'), 'Evidence quality')
})
