import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHARED_WINDOW_DEFAULT_HOURS, capRule, extendedClose, parseSharedOptions, sharedProgress, untouchedCopies, windowClose } from './sharedRules'

const NOW = new Date('2026-10-26T12:00:00Z')
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString()

test('options: 72 hours and no cap by default', () => {
  assert.deepEqual(parseSharedOptions({}), { windowHours: SHARED_WINDOW_DEFAULT_HOURS, maxClaimers: null })
  assert.deepEqual(parseSharedOptions(null), { windowHours: 72, maxClaimers: null })
  assert.deepEqual(parseSharedOptions({ windowHours: '', maxClaimers: '' }), { windowHours: 72, maxClaimers: null })
})

test('options: accepts whole numbers in range, typed or as text', () => {
  assert.deepEqual(parseSharedOptions({ windowHours: 24, maxClaimers: 10 }), { windowHours: 24, maxClaimers: 10 })
  assert.deepEqual(parseSharedOptions({ windowHours: ' 48 ', maxClaimers: '3' }), { windowHours: 48, maxClaimers: 3 })
  assert.deepEqual(parseSharedOptions({ windowHours: 720 }), { windowHours: 720, maxClaimers: null })
})

test('options: refuses out of range, fractions, negatives and junk', () => {
  for (const w of [0, -1, 721, 1.5, 'abc', '1e3', true, {}]) assert.ok('error' in parseSharedOptions({ windowHours: w }), `window ${String(w)}`)
  for (const m of [0, -2, 501, 2.5, 'ten', '5;']) assert.ok('error' in parseSharedOptions({ maxClaimers: m }), `cap ${String(m)}`)
})

test('window close and extending', () => {
  assert.equal(windowClose(NOW, 72), hours(72))
  assert.deepEqual(extendedClose(hours(10), 24, NOW), { closesAt: hours(34) }, 'adds to a window still open')
  assert.deepEqual(extendedClose(hours(-5), 24, NOW), { closesAt: hours(24) }, 'a closed window reopens from now')
  assert.deepEqual(extendedClose(null, 6, NOW), { closesAt: hours(6) })
  assert.deepEqual(extendedClose('garbage', 6, NOW), { closesAt: hours(6) })
  for (const h of [0, -3, 721, 'x', null, 2.5]) assert.ok('error' in extendedClose(hours(1), h, NOW), String(h))
})

test('cap: never below those who already claimed; empty means no limit', () => {
  assert.deepEqual(capRule('', 4), { maxClaimers: null })
  assert.deepEqual(capRule(4, 4), { maxClaimers: 4 })
  assert.match((capRule(3, 4) as { error: string }).error, /can't be lower than 4/)
  assert.ok('error' in capRule(0, 0))
  assert.ok('error' in capRule('x', 0))
})

test('untouched copies and progress', () => {
  const copies = [
    { id: 'a', status: 'assigned', assigned_to: 'u1' },
    { id: 'b', status: 'assigned', assigned_to: 'u2' },
    { id: 'c', status: 'completed', assigned_to: 'u3' },
  ]
  const withSub = new Set(['b', 'c'])
  assert.deepEqual(untouchedCopies(copies, withSub).map((c) => c.id), ['a'])
  assert.equal(sharedProgress(copies, withSub), '3 claimed · 2 submitted · 1 completed')
  assert.equal(sharedProgress([], new Set()), '0 claimed · 0 submitted · 0 completed')
})
