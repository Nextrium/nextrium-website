import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canDecideOnPortalSubmission, clampPoints, isDecidable, parseNote, queueTab } from './reviewRules'

const s = (status: string, notes: string | null = null, submission_count = 1) => ({ status, notes, submission_count })

test('submissions land in the right queue tab', () => {
  assert.equal(queueTab(s('under_review')), 'team')
  assert.equal(queueTab(s('ai_approved')), 'passed')
  assert.equal(queueTab(s('submitted')), 'pending')
  assert.equal(queueTab(s('verified')), 'verified')
  assert.equal(queueTab(s('rejected')), 'changes')
  assert.equal(queueTab(s('rejected', null, 3)), 'rejected')
  assert.equal(queueTab(s('rejected', 'final')), 'rejected')
})

test('only unfinished submissions can be decided', () => {
  for (const st of ['under_review', 'ai_approved', 'submitted']) assert.equal(isDecidable(s(st)), true, st)
  assert.equal(isDecidable(s('rejected')), true) // overriding an automated rejection
  assert.equal(isDecidable(s('rejected', 'final')), false)
  assert.equal(isDecidable(s('verified')), false)
})

test('moderators never decide on their own submission', () => {
  assert.equal(canDecideOnPortalSubmission({ role: 'admin', email: 'a@x.org' }, 'a@x.org'), true)
  assert.equal(canDecideOnPortalSubmission({ role: 'moderator', email: 'm@x.org' }, 'c@x.org'), true)
  assert.equal(canDecideOnPortalSubmission({ role: 'moderator', email: 'M@x.org' }, 'm@x.org'), false)
  assert.equal(canDecideOnPortalSubmission({ role: 'moderator', email: null }, 'c@x.org'), false)
  assert.equal(canDecideOnPortalSubmission({ role: 'content', email: 'z@x.org' }, 'c@x.org'), false)
})

test('points stay inside the task range', () => {
  assert.equal(clampPoints(500, 10, 30), 30)
  assert.equal(clampPoints(-5, 10, 30), 10)
  assert.equal(clampPoints('22.6', 10, 30), 23)
  assert.equal(clampPoints('abc', 10, 30), null)
  assert.equal(clampPoints('', 10, 30), null)
  assert.equal(clampPoints(Infinity, 10, 30), null)
})

test('notes: trimmed, length-limited, required when asked', () => {
  assert.deepEqual(parseNote('  ok ', false), { note: 'ok' })
  assert.deepEqual(parseNote('', false), { note: null })
  assert.ok('error' in parseNote(' ', true))
  assert.ok('error' in parseNote('x'.repeat(4001), false))
})
