import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TIE_RULE, displayNameFromEmail, leaderboardName, leaderboardStats, pointsBarPercent, rankLeaderboard, submissionMarks, submittedLabel } from './leaderboard'

test('every person gets their own position; equal points go to whoever submitted first', () => {
  const ranked = rankLeaderboard([
    { userId: 'a', name: 'ann', points: 150, verified: 1, reachedAt: '2026-10-20T10:00:00Z' },
    { userId: 'b', name: 'bob', points: 440, verified: 3, reachedAt: '2026-10-25T10:00:00Z' },
    { userId: 'c', name: 'cat', points: 150, verified: 1, reachedAt: '2026-10-18T09:30:00Z' },
    { userId: 'd', name: 'dan', points: 150, verified: 1, reachedAt: '2026-10-18T09:31:00Z' },
    { userId: 'e', name: 'eve', points: 50, verified: 1, reachedAt: '2026-10-01T10:00:00Z' },
  ])
  assert.deepEqual(ranked.map((r) => [r.userId, r.rank]), [['b', 1], ['c', 2], ['d', 3], ['a', 4], ['e', 5]])
  assert.deepEqual(ranked.map((r) => r.tied), [false, true, true, true, false])
})

test('submission time beats verification count and name; one minute is enough', () => {
  const ranked = rankLeaderboard([
    { userId: 'z', name: 'Zed', points: 100, verified: 1, reachedAt: '2026-10-01T10:00:00Z' },
    { userId: 'a', name: 'Amy', points: 100, verified: 4, reachedAt: '2026-10-01T10:01:00Z' },
  ])
  assert.deepEqual(ranked.map((r) => r.userId), ['z', 'a'])
})

test('identical submission times fall back to more contributions, then earlier first work, then name', () => {
  const at = '2026-10-01T10:00:00Z'
  assert.deepEqual(rankLeaderboard([
    { userId: 'a', name: 'A', points: 100, verified: 1, reachedAt: at },
    { userId: 'b', name: 'B', points: 100, verified: 2, reachedAt: at },
  ]).map((r) => r.userId), ['b', 'a'])
  assert.deepEqual(rankLeaderboard([
    { userId: 'a', name: 'A', points: 100, verified: 2, reachedAt: at, firstAt: '2026-09-02T00:00:00Z' },
    { userId: 'b', name: 'B', points: 100, verified: 2, reachedAt: at, firstAt: '2026-09-01T00:00:00Z' },
  ]).map((r) => r.userId), ['b', 'a'])
  assert.deepEqual(rankLeaderboard([
    { userId: 'x2', name: 'Same', points: 100, verified: 1, reachedAt: at },
    { userId: 'x1', name: 'Same', points: 100, verified: 1, reachedAt: at },
  ]).map((r) => r.userId), ['x1', 'x2'], 'stable even with the same name')
})

test('a missing or broken submission time goes after known times, never first', () => {
  assert.deepEqual(rankLeaderboard([
    { userId: 'n', name: 'A', points: 100, verified: 1, reachedAt: null },
    { userId: 'j', name: 'B', points: 100, verified: 1, reachedAt: 'not a date' },
    { userId: 'k', name: 'C', points: 100, verified: 1, reachedAt: '2026-10-30T00:00:00Z' },
  ]).map((r) => r.userId), ['k', 'n', 'j'])
})

test('submissionMarks: latest counted submission is when the score was reached; earliest is the first', () => {
  const m = submissionMarks([
    { contributor_id: 'a', submitted_at: '2026-10-05T10:00:00Z' },
    { contributor_id: 'a', submitted_at: '2026-10-01T10:00:00Z' },
    { contributor_id: 'a', submitted_at: '2026-10-09T10:00:00Z' },
    { contributor_id: 'b', submitted_at: null },
    { contributor_id: 'b', submitted_at: 'garbage' },
  ])
  assert.deepEqual(m.get('a'), { reachedAt: '2026-10-09T10:00:00Z', firstAt: '2026-10-01T10:00:00Z' })
  assert.equal(m.has('b'), false)
})

test('submittedLabel: Lagos time to the minute', () => {
  assert.equal(submittedLabel('2026-10-28T13:32:00Z'), '28 Oct 2026, 14:32 (Lagos)')
  assert.equal(submittedLabel(null), '—')
  assert.equal(submittedLabel('nope'), '—')
})

test('the tie rule says submission time counts, not verification', () => {
  assert.match(TIE_RULE, /submitted/)
  assert.match(TIE_RULE, /not when the team verified/)
})

test('people with no points are left off', () => {
  assert.deepEqual(rankLeaderboard([{ userId: 'z', name: 'z', points: 0, verified: 0 }]), [])
})

test('leaderboardName uses the display name and never an email', () => {
  assert.equal(leaderboardName(' Ada Lovelace '), 'Ada Lovelace')
  assert.equal(leaderboardName(null), 'Unnamed contributor')
  assert.equal(leaderboardName('  '), 'Unnamed contributor')
})

test('leaderboardName falls back to another name they gave us, in order, never inventing one', () => {
  assert.equal(leaderboardName(null, null, 'Kamarudeen Fad', 'Account Name'), 'Kamarudeen Fad')
  assert.equal(leaderboardName('Chosen', 'Application'), 'Chosen', 'their own choice wins')
  assert.equal(leaderboardName('', '  ', undefined, 'Acc'), 'Acc')
  assert.equal(leaderboardName(null, null, null), 'Unnamed contributor')
  assert.equal(leaderboardName('x'.repeat(200)).length, 60)
})

test('displayNameFromEmail uses the local part', () => {
  assert.equal(displayNameFromEmail('ada.lovelace@example.com'), 'ada.lovelace')
  assert.equal(displayNameFromEmail(null), 'Member')
  assert.equal(displayNameFromEmail('@x.com'), 'Member')
})

test('leaderboardStats totals the people shown', () => {
  assert.deepEqual(leaderboardStats([]), { contributors: 0, points: 0, verified: 0 })
  assert.deepEqual(leaderboardStats([{ points: 120, verified: 2 }, { points: 30, verified: 1 }]), { contributors: 2, points: 150, verified: 3 })
})

test('pointsBarPercent scales to the leader and stays visible', () => {
  assert.equal(pointsBarPercent(200, 200), 100)
  assert.equal(pointsBarPercent(100, 200), 50)
  assert.equal(pointsBarPercent(1, 1000), 4)
  assert.equal(pointsBarPercent(0, 200), 4)
  assert.equal(pointsBarPercent(50, 0), 4)
  assert.equal(pointsBarPercent(300, 200), 100)
})
