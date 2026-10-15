import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignmentDeadline, editRules, extendedDeadline, extensionState, parseTags } from './taskRules'

test('tags: trimmed, lowercased, de-duplicated, limited', () => {
  assert.deepEqual(parseTags(' Trust, identity ,trust '), { tags: ['trust', 'identity'] })
  assert.deepEqual(parseTags(''), { tags: null })
  assert.ok('error' in parseTags('a,b,c,d,e,f,g,h,i'))
  assert.ok('error' in parseTags('x'.repeat(41)))
  assert.ok('error' in parseTags('<script>'))
})

test('extension state, including the stored decline', () => {
  const t = (r: string | null, g: boolean, e: string | null) => ({ extension_requested_at: r, extension_granted: g, extended_deadline_at: e })
  assert.equal(extensionState(t(null, false, null)), 'none')
  assert.equal(extensionState(t('2026-10-15T00:00:00Z', false, null)), 'requested')
  assert.equal(extensionState(t('2026-10-15T00:00:00Z', true, '2026-10-20T00:00:00Z')), 'granted')
  assert.equal(extensionState(t('2026-10-15T00:00:00Z', false, '2026-10-18T00:00:00Z')), 'declined')
})

test('a granted extension adds the size-based days', () => {
  assert.equal(extendedDeadline('2026-10-18T12:00:00.000Z', 'small'), '2026-10-19T12:00:00.000Z')
  assert.equal(extendedDeadline('2026-10-18T12:00:00.000Z', 'large'), '2026-10-21T12:00:00.000Z')
})

test('direct assignment deadline defaults to the task window', () => {
  const now = new Date('2026-10-15T00:00:00.000Z')
  assert.equal(assignmentDeadline(3, null, now), '2026-10-18T00:00:00.000Z')
  assert.equal(assignmentDeadline(3, '2026-11-01T00:00:00.000Z', now), '2026-11-01T00:00:00.000Z')
})

test('sizing locks once a task is held; completed tasks are read-only', () => {
  assert.deepEqual(editRules('open'), { content: true, sizing: true })
  assert.deepEqual(editRules('assigned'), { content: true, sizing: false })
  assert.deepEqual(editRules('completed'), { content: false, sizing: false })
  assert.deepEqual(editRules(null), { content: false, sizing: false })
})
