import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSubmission, wordCount, SUBMISSION_MIN_WORDS } from './submission'

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')
const valid = { title: ' Leaderboard page ', description: words(SUBMISSION_MIN_WORDS), evidenceUrl: 'https://github.com/org/repo/pull/1' }

test('parseSubmission accepts valid input and trims', () => {
  const r = parseSubmission(valid)
  assert.ok('submission' in r)
  assert.equal(r.submission.title, 'Leaderboard page')
  assert.equal(r.submission.evidenceUrl, 'https://github.com/org/repo/pull/1')
})

test('parseSubmission enforces title, length and minimum words', () => {
  assert.ok('error' in parseSubmission({ ...valid, title: '' }))
  assert.ok('error' in parseSubmission({ ...valid, title: 'x'.repeat(201) }))
  assert.ok('error' in parseSubmission({ ...valid, description: words(SUBMISSION_MIN_WORDS - 1) }))
  assert.ok('error' in parseSubmission({ ...valid, description: 'x '.repeat(5001) + 'y'.repeat(10) }))
})

test('parseSubmission requires an https evidence link', () => {
  assert.ok('error' in parseSubmission({ ...valid, evidenceUrl: '' }))
  assert.ok('error' in parseSubmission({ ...valid, evidenceUrl: 'not a url' }))
  assert.ok('error' in parseSubmission({ ...valid, evidenceUrl: 'http://example.com' }))
  assert.ok('error' in parseSubmission({ ...valid, evidenceUrl: 'javascript:alert(1)' }))
  assert.ok('error' in parseSubmission({ ...valid, evidenceUrl: 'https://x.dev/' + 'a'.repeat(2100) }))
})

test('wordCount counts whitespace-separated words', () => {
  assert.equal(wordCount('  one two\n three\tfour  '), 4)
  assert.equal(wordCount(''), 0)
})
