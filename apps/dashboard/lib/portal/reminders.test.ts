import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reminderFor } from './reminders'

const now = new Date('2026-10-20T07:00:00Z')
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()
const task = (days: number, deadlineHours: number, extra = {}) => ({ deadline_days: days, deadline_at: at(deadlineHours), extended_deadline_at: null, extension_granted: false, ...extra })

test('every task gets a reminder in its last day', () => {
  assert.equal(reminderFor(task(3, 5), now), '1_day')
  assert.equal(reminderFor(task(3, 24), now), '1_day')
  assert.equal(reminderFor(task(3, 25), now), null)
})

test('medium and large tasks get a three-day reminder; small do not', () => {
  assert.equal(reminderFor(task(6, 60), now), '3_days')
  assert.equal(reminderFor(task(12, 72), now), '3_days')
  assert.equal(reminderFor(task(3, 60), now), null)
  assert.equal(reminderFor(task(6, 48), now), null)
})

test('large tasks get a one-week reminder', () => {
  assert.equal(reminderFor(task(12, 160), now), '7_days')
  assert.equal(reminderFor(task(6, 160), now), null)
})

test('overdue once, on the first run after the deadline', () => {
  assert.equal(reminderFor(task(3, -2), now), 'overdue')
  assert.equal(reminderFor(task(3, -30), now), null)
})

test('a daily run hits each window exactly once', () => {
  const deadline = new Date('2026-11-01T15:30:00Z')
  const seen: string[] = []
  for (let d = 0; d < 16; d++) {
    const run = new Date(Date.UTC(2026, 9, 18 + d, 7, 0, 0))
    const r = reminderFor({ deadline_days: 12, deadline_at: deadline.toISOString(), extended_deadline_at: null, extension_granted: false }, run)
    if (r) seen.push(r)
  }
  assert.deepEqual(seen, ['7_days', '3_days', '1_day', 'overdue'])
})

test('a granted extension moves the deadline; a requested one does not', () => {
  assert.equal(reminderFor(task(3, 5, { extension_granted: true, extended_deadline_at: at(40) }), now), null)
  assert.equal(reminderFor(task(3, 5, { extension_granted: false, extended_deadline_at: at(5) }), now), '1_day')
  assert.equal(reminderFor({ deadline_days: 3, deadline_at: null, extended_deadline_at: null, extension_granted: false }, now), null)
})
