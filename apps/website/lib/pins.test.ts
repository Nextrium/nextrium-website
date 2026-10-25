import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderWithPins } from './pins'

const posts = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

test('pins first in their order, the rest unchanged', () => {
  assert.deepEqual(ids(orderWithPins(posts, ['c', 'a'])), ['c', 'a', 'b', 'd'])
})

test('no pins → order unchanged (newest first as before)', () => {
  assert.deepEqual(ids(orderWithPins(posts, [])), ['a', 'b', 'c', 'd'])
})

test('pins for posts not in the list are skipped; duplicates count once', () => {
  assert.deepEqual(ids(orderWithPins(posts, ['zz', 'd', 'd'])), ['d', 'a', 'b', 'c'])
})

test('every post appears exactly once', () => {
  const out = orderWithPins(posts, ['b', 'c', 'a', 'd'])
  assert.equal(out.length, posts.length)
  assert.equal(new Set(ids(out)).size, posts.length)
})

test('empty list stays empty', () => {
  assert.deepEqual(orderWithPins([], ['a']), [])
})
