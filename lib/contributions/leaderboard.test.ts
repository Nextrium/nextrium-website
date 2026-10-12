import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayNameFromEmail, leaderboardName, leaderboardStats, pointsBarPercent, rankLeaderboard } from './leaderboard'

test('ranks by points, ties share a rank', () => {
  const ranked = rankLeaderboard([
    { userId: 'a', name: 'ann', points: 100, verified: 1 },
    { userId: 'b', name: 'bob', points: 300, verified: 3 },
    { userId: 'c', name: 'cat', points: 100, verified: 2 },
    { userId: 'd', name: 'dan', points: 50, verified: 1 },
  ])
  assert.deepEqual(ranked.map((r) => [r.userId, r.rank]), [['b', 1], ['c', 2], ['a', 2], ['d', 4]])
})

test('people with no points are left off', () => {
  assert.deepEqual(rankLeaderboard([{ userId: 'z', name: 'z', points: 0, verified: 0 }]), [])
})

test('leaderboardName uses the display name and never an email', () => {
  assert.equal(leaderboardName(' Ada Lovelace '), 'Ada Lovelace')
  assert.equal(leaderboardName(null), 'Unnamed contributor')
  assert.equal(leaderboardName('  '), 'Unnamed contributor')
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
