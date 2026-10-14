import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTaskLinks, safeExternalUrl } from './links'

test('keeps http(s) links and adds https to bare hosts', () => {
  assert.equal(safeExternalUrl('https://github.com/org/repo'), 'https://github.com/org/repo')
  assert.equal(safeExternalUrl('http://example.com/a?b=1'), 'http://example.com/a?b=1')
  assert.equal(safeExternalUrl('github.com/org/repo'), 'https://github.com/org/repo')
})

test('drops anything that is not a plain web link', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'https://user:pw@example.com', 'not a url', 'localhost', '', '   ', null, 42]) {
    assert.equal(safeExternalUrl(bad), null, String(bad))
  }
})

test('task links keep only safe, well-formed entries', () => {
  const links = parseTaskLinks([
    { label: 'Repo', url: 'https://github.com/org/repo' },
    { label: '', url: 'docs.example.com' },
    { label: 'Bad', url: 'javascript:alert(1)' },
    'nope',
    null,
    { url: 7 },
  ])
  assert.deepEqual(links, [
    { label: 'Repo', url: 'https://github.com/org/repo' },
    { label: 'https://docs.example.com/', url: 'https://docs.example.com/' },
  ])
  assert.deepEqual(parseTaskLinks(null), [])
  assert.deepEqual(parseTaskLinks({ label: 'x' }), [])
})
