import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeNext } from './safeNext'

test('keeps same-site paths with their query and hash', () => {
  assert.equal(safeNext('/dashboard'), '/dashboard')
  assert.equal(safeNext('/tasks/abc?x=1#top'), '/tasks/abc?x=1#top')
  assert.equal(safeNext('/register'), '/register')
})

test('rejects anything that could leave the site', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '\\\\evil', 'evil.example', 'javascript:alert(1)', '/%0d%0aSet-Cookie:x', '/\tevil', '/x\u0000']) {
    const out = safeNext(bad)
    assert.ok(out === '/dashboard' || out.startsWith('/') && !out.startsWith('//'), `${bad} -> ${out}`)
    assert.ok(!/evil\.example/.test(new URL(out, 'http://portal.invalid').host), bad)
  }
  assert.equal(safeNext('//evil.example'), '/dashboard')
  assert.equal(safeNext('/\\evil.example'), '/dashboard')
  assert.equal(safeNext('https://evil.example'), '/dashboard')
})

test('rejects auth routes, non-strings, empty and oversized values', () => {
  assert.equal(safeNext('/auth/callback?code=x'), '/dashboard')
  assert.equal(safeNext('/auth'), '/dashboard')
  assert.equal(safeNext(undefined), '/dashboard')
  assert.equal(safeNext(['/x']), '/dashboard')
  assert.equal(safeNext(''), '/dashboard')
  assert.equal(safeNext('/' + 'a'.repeat(600)), '/dashboard')
  assert.equal(safeNext('nope', '/'), '/')
})

test('normalises dot segments without escaping the site', () => {
  assert.equal(safeNext('/a/../dashboard'), '/dashboard')
  assert.equal(safeNext('/a/../auth/callback'), '/dashboard')
})
