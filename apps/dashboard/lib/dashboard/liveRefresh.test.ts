import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldRefresh, MIN_GAP_MS } from './liveRefresh'

const base = { trigger: 'timer' as const, pathname: '/tasks', visible: true, editing: false, msSinceLast: 60_000 }

test('refreshes a visible, idle page', () => {
  assert.equal(shouldRefresh(base), true)
  assert.equal(shouldRefresh({ ...base, trigger: 'return' }), true)
})

test('never refreshes while editing or hidden', () => {
  assert.equal(shouldRefresh({ ...base, editing: true }), false)
  assert.equal(shouldRefresh({ ...base, trigger: 'return', editing: true }), false)
  assert.equal(shouldRefresh({ ...base, visible: false }), false)
})

test('waits at least the minimum gap between refreshes', () => {
  assert.equal(shouldRefresh({ ...base, msSinceLast: MIN_GAP_MS - 1 }), false)
  assert.equal(shouldRefresh({ ...base, trigger: 'return', msSinceLast: 1000 }), false)
})

test('timer skips heavy pages but returning to the tab still refreshes them', () => {
  for (const pathname of ['/settings/automations', '/ai-engine', '/applications', '/logs']) {
    assert.equal(shouldRefresh({ ...base, pathname }), false, pathname)
    assert.equal(shouldRefresh({ ...base, pathname, trigger: 'return' }), true, pathname)
  }
})

test('a prefix match needs a path boundary', () => {
  assert.equal(shouldRefresh({ ...base, pathname: '/applications-archive' }), true)
  assert.equal(shouldRefresh({ ...base, pathname: '/applications/123' }), false)
})
