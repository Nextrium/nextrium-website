import { test } from 'node:test'
import assert from 'node:assert/strict'
import { submissionNumbers } from './submissionNumber'

test('numbers follow first-submit order across all contributors', () => {
  const n = submissionNumbers([
    { id: 'c', created_at: '2026-10-12T18:33:00Z' },
    { id: 'a', created_at: '2026-10-07T20:44:00Z' },
    { id: 'b', created_at: '2026-10-12T17:25:00Z' },
  ])
  assert.equal(n.get('a'), 1)
  assert.equal(n.get('b'), 2)
  assert.equal(n.get('c'), 3)
})

test('identical timestamps are ordered by id, so the numbering is stable', () => {
  const rows = [{ id: 'y', created_at: '2026-10-12T00:00:00Z' }, { id: 'x', created_at: '2026-10-12T00:00:00Z' }]
  assert.deepEqual([...submissionNumbers(rows)], [['x', 1], ['y', 2]])
  assert.deepEqual([...submissionNumbers([...rows].reverse())], [['x', 1], ['y', 2]])
})

test('no rows, no numbers', () => {
  assert.equal(submissionNumbers([]).size, 0)
})
