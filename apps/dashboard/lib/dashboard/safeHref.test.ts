import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { safeHref } from './safeHref'

test('plain web links are kept', () => {
  assert.equal(safeHref('https://github.com/nextrium/x'), 'https://github.com/nextrium/x')
  assert.equal(safeHref('  http://example.com/a?b=1  '), 'http://example.com/a?b=1')
})

test('script, data and other schemes are refused, in any spelling', () => {
  for (const raw of [
    'javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'file:///etc/passwd', 'ftp://example.com',
  ]) assert.equal(safeHref(raw), null, raw)
})

test('credentials, garbage and non-strings are refused', () => {
  for (const raw of ['https://user:pass@example.com', 'https://user@example.com', 'not a url', '', '   ', 'https://' + 'a'.repeat(2000), null, undefined, 42, {}]) {
    assert.equal(safeHref(raw), null, String(raw))
  }
})

test('both evidence lists render links through safeHref', () => {
  for (const file of ['../../app/(console)/applications/RebuttalPanel.tsx', '../../app/(console)/reviews/[id]/page.tsx']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(src.includes('safeHref('), `${file} renders raw links`)
  }
})
