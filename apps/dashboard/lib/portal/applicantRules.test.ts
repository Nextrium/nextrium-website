import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actionsFor, canDecideOnApplicant, isApplicantAction, planDecision } from './applicantRules'

test('each status offers only its own decisions', () => {
  assert.deepEqual(actionsFor('pending'), ['approve', 'request_revision', 'reject'])
  assert.deepEqual(actionsFor('revision_requested'), ['approve', 'reject'])
  assert.deepEqual(actionsFor('rejected'), ['approve'])
  assert.deepEqual(actionsFor('active'), ['deactivate'])
  assert.deepEqual(actionsFor('inactive'), ['reactivate'])
  assert.deepEqual(actionsFor('weird'), [])
  assert.deepEqual(actionsFor(null), [])
})

test('approving clears old notes; a revision needs a note', () => {
  const ok = planDecision('approve', 'revision_requested', 'ignored')
  assert.deepEqual(ok, { ok: true, to: 'active', update: { status: 'active', revision_notes: null, rejection_reason: null } })
  assert.equal(planDecision('request_revision', 'pending', '  ').ok, false)
  const rev = planDecision('request_revision', 'pending', ' Add your GitHub. ')
  assert.ok(rev.ok && rev.update.revision_notes === 'Add your GitHub.')
})

test('rejection reason is optional; deactivation touches status only', () => {
  const r = planDecision('reject', 'pending', '')
  assert.ok(r.ok && r.update.rejection_reason === null)
  assert.deepEqual(planDecision('deactivate', 'active', 'x'), { ok: true, to: 'inactive', update: { status: 'inactive' } })
})

test('stale or impossible transitions are refused', () => {
  assert.equal(planDecision('approve', 'active', '').ok, false)
  assert.equal(planDecision('deactivate', 'pending', '').ok, false)
  assert.equal(planDecision('reactivate', 'rejected', '').ok, false)
  assert.equal(planDecision('request_revision', 'pending', 'x'.repeat(2001)).ok, false)
})

test('admins decide on anyone; moderators on anyone but themselves', () => {
  assert.equal(canDecideOnApplicant({ role: 'admin', email: 'a@x.org' }, 'a@x.org'), true)
  assert.equal(canDecideOnApplicant({ role: 'moderator', email: 'm@x.org' }, 'someone@x.org'), true)
  assert.equal(canDecideOnApplicant({ role: 'moderator', email: 'M@x.org' }, ' m@x.org '), false)
  assert.equal(canDecideOnApplicant({ role: 'moderator', email: null }, 'someone@x.org'), false)
  for (const role of ['content', 'community', 'member', 'none']) assert.equal(canDecideOnApplicant({ role, email: 'z@x.org' }, 'y@x.org'), false, role)
})

test('only known actions are accepted', () => {
  assert.equal(isApplicantAction('approve'), true)
  assert.equal(isApplicantAction('delete'), false)
  assert.equal(isApplicantAction(undefined), false)
})
