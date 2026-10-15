import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barPercent, publicName, rankContributors } from './ranking'

const c = (name: string, total_points: number, verified_contributions = 1) => ({ name, total_points, verified_contributions })

test('ranks by points with shared ranks for ties', () => {
  const ranked = rankContributors([c('Bo', 100), c('Ade', 300), c('Cy', 100, 3), c('Di', 0, 0)])
  assert.deepEqual(ranked.map((r) => [r.name, r.rank]), [['Ade', 1], ['Cy', 2], ['Bo', 2], ['Di', 4]])
})

test('does not change the input order', () => {
  const list = [c('A', 1), c('B', 2)]
  rankContributors(list)
  assert.deepEqual(list.map((x) => x.name), ['A', 'B'])
})

test('public name prefers the team name for teams only', () => {
  assert.equal(publicName({ name: 'Ada', contributor_type: 'team', team_name: 'Lagos Devs' }), 'Lagos Devs')
  assert.equal(publicName({ name: 'Ada', contributor_type: 'team', team_name: '  ' }), 'Ada')
  assert.equal(publicName({ name: 'Ada', contributor_type: 'individual', team_name: 'Ignored' }), 'Ada')
})

test('bar width is relative to the leader and never vanishes', () => {
  assert.equal(barPercent(50, 100), 50)
  assert.equal(barPercent(0, 100), 4)
  assert.equal(barPercent(1, 1000), 4)
  assert.equal(barPercent(10, 0), 4)
  assert.equal(barPercent(200, 100), 100)
})
