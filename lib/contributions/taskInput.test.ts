import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTaskInput, TITLE_MAX, LINKS_MAX } from './taskInput'
import { sanitizeBrief, briefToText } from './sanitize'
import { describeDbError } from './errors'

const valid = {
  title: '  Build the task list page  ',
  description: '<p>List tasks with <strong>filters</strong>.</p>',
  category: 'technical',
  complexity: 'medium',
  links: [{ label: 'Spec', url: 'https://example.com/spec' }],
}

test('parseTaskInput normalises valid input and derives points and deadline', () => {
  const r = parseTaskInput(valid)
  assert.ok('fields' in r)
  assert.equal(r.fields.title, 'Build the task list page')
  assert.equal(r.fields.point_range_min, 150)
  assert.equal(r.fields.point_range_max, 280)
  assert.equal(r.fields.deadline_days, 6)
  assert.deepEqual(r.fields.links, [{ label: 'Spec', url: 'https://example.com/spec' }])
})

test('parseTaskInput rejects missing or invalid fields', () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ ...valid, title: ' ' }, 'Title is required.'],
    [{ ...valid, title: 'x'.repeat(TITLE_MAX + 1) }, `Title must be ${TITLE_MAX} characters or fewer.`],
    [{ ...valid, category: 'marketing' }, 'Choose a category.'],
    [{ ...valid, complexity: 'huge' }, 'Choose a complexity.'],
    [{ ...valid, description: '<p>  </p>' }, 'A brief is required.'],
    [{ ...valid, description: '<script>alert(1)</script>' }, 'A brief is required.'],
    [{ ...valid, links: [{ label: 'x', url: 'javascript:alert(1)' }] }, 'Not a valid link: javascript:alert(1)'],
    [{ ...valid, links: Array.from({ length: LINKS_MAX + 1 }, () => ({ url: 'https://a.b' })) }, `At most ${LINKS_MAX} links.`],
  ]
  for (const [input, message] of cases) {
    const r = parseTaskInput(input)
    assert.ok('error' in r, JSON.stringify(input).slice(0, 80))
    assert.equal(r.error, message)
  }
  assert.ok('error' in parseTaskInput(null))
})

test('parseTaskInput drops empty links and labels a link by its url', () => {
  const r = parseTaskInput({ ...valid, links: [{ label: '', url: 'https://a.example' }, { label: 'x', url: '' }] })
  assert.ok('fields' in r)
  assert.deepEqual(r.fields.links, [{ label: 'https://a.example', url: 'https://a.example' }])
})

test('sanitizeBrief removes scripts, handlers and javascript: links', () => {
  const dirty = '<p onclick="steal()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)">'
  const clean = sanitizeBrief(dirty)
  assert.ok(!/script|onclick|onerror|javascript:/i.test(clean), clean)
  assert.ok(clean.includes('<p>Hi</p>'))
})

test('sanitizeBrief keeps editor formatting and hardens links', () => {
  const clean = sanitizeBrief('<h2 style="text-align: center">T</h2><p><mark style="background-color: #ff0">m</mark> <a href="https://x.dev">l</a></p>')
  assert.ok(clean.includes('<h2 style="text-align:center">T</h2>'), clean)
  assert.ok(clean.includes('<mark style="background-color:#ff0">m</mark>'), clean)
  assert.ok(clean.includes('rel="noopener noreferrer"') && clean.includes('target="_blank"'), clean)
})

test('sanitizeBrief allows only YouTube iframes and safe styles', () => {
  assert.ok(sanitizeBrief('<iframe src="https://www.youtube.com/embed/abc"></iframe>').includes('youtube.com/embed/abc'))
  assert.equal(sanitizeBrief('<iframe src="https://evil.example/x"></iframe>').includes('evil.example'), false)
  assert.equal(sanitizeBrief('<p style="position:fixed;color:red">x</p>'), '<p>x</p>')
})

test('briefToText strips all markup', () => {
  assert.equal(briefToText('<p>Hello&nbsp;<strong>there</strong></p>'), 'Hello there')
})

test('describeDbError maps known codes and hides unknown errors', () => {
  assert.match(describeDbError({ message: 'assignee_not_active_member' }), /active members/)
  assert.equal(describeDbError({ message: 'duplicate key value violates…' }), 'Something went wrong. Please try again.')
  assert.equal(describeDbError(null, 'fallback'), 'fallback')
})
