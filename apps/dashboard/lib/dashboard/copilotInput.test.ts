import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCopilotRequest } from './copilotInput'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const ok = (raw: unknown) => {
  const r = parseCopilotRequest(raw)
  assert.ok('request' in r, JSON.stringify(r))
  return r.request
}
const refused = (raw: unknown) => assert.ok('error' in parseCopilotRequest(raw), JSON.stringify(raw))

test('a normal chat message passes, with the domain fixed', () => {
  const r = ok({ resourceId: ID, reportId: null, prompt: '  Summarise the gaps  ' })
  assert.deepEqual(r, { domainType: 'hr_screening', resourceId: ID, prompt: 'Summarise the gaps' })
})

test('the caller cannot pick another domain', () => {
  refused({ domainType: 'code_review', resourceId: ID, prompt: 'x' })
  assert.equal(ok({ domainType: 'hr_screening', resourceId: ID, prompt: 'x' }).domainType, 'hr_screening')
})

test('ids must be single path-safe tokens', () => {
  for (const id of ['../x', 'a/b', '', null, 5]) refused({ resourceId: id, prompt: 'x' })
  refused({ resourceId: ID, reportId: '../../x', prompt: 'x' })
  assert.equal(ok({ resourceId: ID, reportId: 'NXT-2026-0001', prompt: 'x' }).reportId, 'NXT-2026-0001')
})

test('text is bounded and an empty prompt is refused', () => {
  refused({ resourceId: ID, prompt: '   ' })
  const r = ok({ resourceId: ID, prompt: 'p'.repeat(9000), pastedText: 't'.repeat(50000) })
  assert.equal(r.prompt.length, 4000)
  assert.equal(r.pastedText!.length, 20000)
})

test('links must be http(s), at most ten', () => {
  assert.deepEqual(ok({ resourceId: ID, prompt: 'x', manualUrls: ['https://github.com/a'] }).manualUrls, ['https://github.com/a'])
  refused({ resourceId: ID, prompt: 'x', manualUrls: ['javascript:alert(1)'] })
  refused({ resourceId: ID, prompt: 'x', manualUrls: ['file:///etc/passwd'] })
  refused({ resourceId: ID, prompt: 'x', manualUrls: ['https://user:pass@github.com/a'] })
  refused({ resourceId: ID, prompt: 'x', manualUrls: ['github.com/a'] })
  refused({ resourceId: ID, prompt: 'x', manualUrls: 'https://a.com' })
  refused({ resourceId: ID, prompt: 'x', manualUrls: Array(11).fill('https://a.com') })
})

test('documents are bounded and empty ones dropped', () => {
  const r = ok({ resourceId: ID, prompt: 'x', documentSnippets: [{ name: 'cv', content: 'c'.repeat(30000) }, { name: 'empty', content: ' ' }] })
  assert.equal(r.documentSnippets!.length, 1)
  assert.equal(r.documentSnippets![0].content.length, 20000)
  refused({ resourceId: ID, prompt: 'x', documentSnippets: Array(6).fill({ name: 'a', content: 'b' }) })
})

test('a score override must be a whole number from 0 to 100', () => {
  assert.deepEqual(ok({ resourceId: ID, prompt: 'x', manualOverrides: { compositeScore: 70 } }).manualOverrides, { compositeScore: 70, recommendation: undefined })
  assert.deepEqual(ok({ resourceId: ID, prompt: 'x', manualOverrides: { compositeScore: 0 } }).manualOverrides, { compositeScore: 0, recommendation: undefined })
  assert.deepEqual(ok({ resourceId: ID, prompt: 'x', manualOverrides: { compositeScore: 100 } }).manualOverrides, { compositeScore: 100, recommendation: undefined })
  assert.deepEqual(ok({ resourceId: ID, prompt: 'x', manualOverrides: { recommendation: 'Strong Hire' } }).manualOverrides, { compositeScore: undefined, recommendation: 'Strong Hire' })
  for (const s of [-1, 101, 70.5, NaN, Infinity, '70']) refused({ resourceId: ID, prompt: 'x', manualOverrides: { compositeScore: s } })
  assert.equal(ok({ resourceId: ID, prompt: 'x', manualOverrides: {} }).manualOverrides, undefined)
})

test('unknown fields are not passed on', () => {
  const r = ok({ resourceId: ID, prompt: 'x', sender: 'system', apply: true }) as unknown as Record<string, unknown>
  assert.equal(r.sender, undefined)
  assert.equal(r.apply, undefined)
})
