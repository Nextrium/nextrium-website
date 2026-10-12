import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canDecideOnSubmission } from './decisionRules'

test('admin decides on anyone, including themselves', () => {
  assert.equal(canDecideOnSubmission({ userId: 'a', role: 'admin' }, 'm'), true)
  assert.equal(canDecideOnSubmission({ userId: 'a', role: 'admin' }, 'a'), true)
})

test('moderator decides on others but never on their own submission', () => {
  assert.equal(canDecideOnSubmission({ userId: 'mod', role: 'moderator' }, 'member'), true)
  assert.equal(canDecideOnSubmission({ userId: 'mod', role: 'moderator' }, 'other-mod'), true)
  assert.equal(canDecideOnSubmission({ userId: 'mod', role: 'moderator' }, 'mod'), false)
})

test('moderator is refused when the contributor is unknown', () => {
  assert.equal(canDecideOnSubmission({ userId: 'mod', role: 'moderator' }, null), false)
  assert.equal(canDecideOnSubmission({ userId: 'mod', role: 'moderator' }, ''), false)
})

test('no other role decides', () => {
  for (const role of ['content', 'community', 'member', 'archived', 'none', '']) {
    assert.equal(canDecideOnSubmission({ userId: 'x', role }, 'someone'), false, role)
  }
})
