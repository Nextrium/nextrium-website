import { test } from 'node:test'
import assert from 'node:assert/strict'
import { claimersLabel, oneOfLabel, sharedClaimMessage, sharedState, sharedUnclaimMessage, windowLabel } from './sharedTasks'

const NOW = new Date('2026-10-26T12:00:00Z')
const at = (mins: number) => new Date(NOW.getTime() + mins * 60_000).toISOString()

test('state: open, closed at the exact moment, full only with a cap', () => {
  assert.equal(sharedState({ closesAt: at(60), claimers: 3, maxClaimers: null }, NOW), 'open')
  assert.equal(sharedState({ closesAt: at(0), claimers: 0, maxClaimers: null }, NOW), 'closed')
  assert.equal(sharedState({ closesAt: at(-1), claimers: 0, maxClaimers: 5 }, NOW), 'closed', 'closed wins over full')
  assert.equal(sharedState({ closesAt: at(60), claimers: 5, maxClaimers: 5 }, NOW), 'full')
  assert.equal(sharedState({ closesAt: at(60), claimers: 4, maxClaimers: 5 }, NOW), 'open')
  assert.equal(sharedState({ closesAt: 'not a date', claimers: 0, maxClaimers: null }, NOW), 'closed', 'an unreadable date fails closed')
})

test('window label: days, hours, minutes, closed', () => {
  assert.equal(windowLabel(at(72 * 60), NOW), 'closes in 3d 0h')
  assert.equal(windowLabel(at(2 * 1440 + 5 * 60 + 30), NOW), 'closes in 2d 5h')
  assert.equal(windowLabel(at(190), NOW), 'closes in 3h 10m')
  assert.equal(windowLabel(at(4), NOW), 'closes in 4m')
  assert.equal(windowLabel(at(0.2), NOW), 'closes in 1m', 'under a minute rounds up')
  assert.equal(windowLabel(at(0), NOW), 'claims closed')
  assert.equal(windowLabel(at(-60), NOW), 'claims closed')
  assert.equal(windowLabel('nonsense', NOW), 'claims closed')
})

test('claimers label and one-of-N (count only)', () => {
  assert.equal(claimersLabel({ closesAt: at(1), claimers: 0, maxClaimers: null }), 'Be the first to claim it')
  assert.equal(claimersLabel({ closesAt: at(1), claimers: 4, maxClaimers: null }), '4 working on it')
  assert.equal(claimersLabel({ closesAt: at(1), claimers: 3, maxClaimers: 10 }), '3 of 10 places taken')
  assert.equal(oneOfLabel(1), null)
  assert.match(oneOfLabel(4)!, /one of 4 people/)
})

test('every database refusal has its own message', () => {
  const cases: [string, RegExp][] = [
    ['claim_window_closed', /closed/], ['already_claimed', /already claimed/], ['claimers_full', /places/],
    ['cooldown', /48 hours/], ['claim_limit_reached', /2 running tasks/], ['not_active', /approved/],
    ['not_shared', /no longer open/], ['anything else', /could not be claimed/],
  ]
  for (const [code, re] of cases) assert.match(sharedClaimMessage(`ERROR: ${code}`), re, code)
  assert.match(sharedClaimMessage('claim_limit_reached', { maxClaims: 1 }), /1 running task\./)
  assert.match(sharedClaimMessage(undefined), /could not be claimed/)
  assert.match(sharedUnclaimMessage('has_submission'), /stays with you/)
  assert.match(sharedUnclaimMessage('not_yours'), /not one of your/)
  assert.match(sharedUnclaimMessage(undefined), /went wrong/)
})

test('contributors never read the word "copy": everyone simply holds the task', () => {
  const codes = ['claim_window_closed', 'already_claimed', 'claimers_full', 'cooldown', 'claim_limit_reached', 'not_active', 'not_shared', 'other']
  const texts = [
    ...codes.map((c) => sharedClaimMessage(c)),
    ...['has_submission', 'not_yours', 'other'].map((c) => sharedUnclaimMessage(c)),
    oneOfLabel(5)!, claimersLabel({ closesAt: at(60), claimers: 3, maxClaimers: null }), windowLabel(at(60), NOW),
  ]
  for (const t of texts) assert.doesNotMatch(t, /\bcop(y|ies)\b/i, t)
})
