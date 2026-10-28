import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeSupabase } from '../testing/fakeSupabase'
import { staffAlreadyRequestedChanges } from './decisionState'

const reviews = [{ id: 'r-ai', source: 'service' }, { id: 'r-staff', source: 'staff' }]
const check = (contribution: Record<string, unknown> | null) => {
  const { client } = createFakeSupabase({ contributions: contribution ? [{ id: 'c1', ...contribution }] : [], contribution_reviews: reviews })
  return staffAlreadyRequestedChanges(client, 'c1')
}

test('the automated review asked for changes: staff may still send their own note', async () => {
  assert.equal(await check({ status: 'changes_requested', latest_review_id: 'r-ai' }), false)
})

test('staff already asked for changes: a repeated click', async () => {
  assert.equal(await check({ status: 'changes_requested', latest_review_id: 'r-staff' }), true)
})

test('any other state, no review, a missing review row or no submission is not a repeat', async () => {
  for (const status of ['needs_human', 'ai_approved', 'review_failed', 'verified', 'rejected']) {
    assert.equal(await check({ status, latest_review_id: 'r-staff' }), false, status)
  }
  assert.equal(await check({ status: 'changes_requested', latest_review_id: null }), false, 'no review')
  assert.equal(await check({ status: 'changes_requested', latest_review_id: 'gone' }), false, 'review row missing')
  assert.equal(await check(null), false, 'no submission')
})
