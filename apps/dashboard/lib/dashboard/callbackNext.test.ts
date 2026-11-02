import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeNext } from '@nextrium/utils/safeNext'

const ORIGIN = 'https://dash.invalid'

test('real landing pages keep working', () => {
  assert.equal(safeNext(null), '/')
  assert.equal(safeNext('/'), '/')
  assert.equal(safeNext('/set-password'), '/set-password')
  assert.equal(safeNext('/people/me?tab=profile#top'), '/people/me?tab=profile#top')
})

test('every value stays on the dashboard', () => {
  for (const value of ['@other.invalid', '.other.invalid', ':8080', '//other.invalid', '/\\other.invalid', 'https://other.invalid', '/\tother', '/auth/callback', 'set-password']) {
    const url = new URL(safeNext(value), ORIGIN)
    assert.equal(url.origin, ORIGIN, value)
    assert.equal(url.pathname, '/', value)
  }
})
