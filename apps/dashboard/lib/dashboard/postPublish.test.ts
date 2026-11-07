import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publishFields, unpublishesLivePost } from './postPublish'

const NOW = '2026-11-07T10:00:00.000Z'
const FIRST = '2026-01-15T09:00:00.000Z'

test('publishing a new post stamps it now', () => {
  assert.deepEqual(publishFields(true, null, NOW), { is_published: true, published_at: NOW })
  assert.deepEqual(publishFields(true, undefined, NOW), { is_published: true, published_at: NOW })
})

test('updating a live post keeps its first publish date', () => {
  assert.deepEqual(publishFields(true, FIRST, NOW), { is_published: true, published_at: FIRST })
})

test('saving a draft clears the publish date', () => {
  assert.deepEqual(publishFields(false, FIRST, NOW), { is_published: false, published_at: null })
  assert.deepEqual(publishFields(false, null, NOW), { is_published: false, published_at: null })
})

test('only "Save draft" on a live post needs confirming', () => {
  assert.equal(unpublishesLivePost(false, true), true)
  assert.equal(unpublishesLivePost(true, true), false)
  assert.equal(unpublishesLivePost(false, false), false)
  assert.equal(unpublishesLivePost(true, false), false)
})
