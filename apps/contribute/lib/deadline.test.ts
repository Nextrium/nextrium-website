import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canRequestExtension, effectiveDeadline, extensionDays, timeRemaining, type ClaimedTaskTiming } from './deadline'

const now = new Date('2026-10-15T12:00:00Z')
const at = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()

const task = (over: Partial<ClaimedTaskTiming> = {}): ClaimedTaskTiming => ({
  complexity: 'medium',
  claimed_at: at(-72),
  deadline_at: at(72),
  deadline_days: 6,
  extension_granted: false,
  extension_requested_at: null,
  extended_deadline_at: null,
  ...over,
})

test('a granted extension replaces the deadline; a requested one does not', () => {
  assert.equal(effectiveDeadline(task({ extension_granted: true, extended_deadline_at: at(120) }))?.toISOString(), at(120))
  assert.equal(effectiveDeadline(task({ extension_requested_at: at(-1), extended_deadline_at: at(120) }))?.toISOString(), at(72))
  assert.equal(effectiveDeadline(task({ deadline_at: null })), null)
})

test('remaining time, urgency and share used', () => {
  const half = timeRemaining(task(), now)
  assert.equal(half.label, '3 days 0h remaining')
  assert.equal(half.urgency, 'normal')
  assert.equal(half.used, 0.5)
  assert.equal(timeRemaining(task({ claimed_at: at(-100), deadline_at: at(20) }), now).urgency, 'urgent')
  assert.equal(timeRemaining(task({ deadline_at: at(1) }), now).label, '1 hour remaining')
})

test('overdue reads in hours, then days', () => {
  const late = timeRemaining(task({ deadline_at: at(-5) }), now)
  assert.equal(late.isOverdue, true)
  assert.equal(late.urgency, 'overdue')
  assert.equal(late.label, 'Overdue by 5 hours')
  assert.equal(timeRemaining(task({ deadline_at: at(-50) }), now).label, 'Overdue by 2 days')
})

test('extensions: once, before the deadline, sized by complexity', () => {
  assert.equal(canRequestExtension(task(), now), true)
  assert.equal(canRequestExtension(task({ extension_requested_at: at(-1) }), now), false)
  assert.equal(canRequestExtension(task({ extension_granted: true }), now), false)
  assert.equal(canRequestExtension(task({ deadline_at: at(-1) }), now), false)
  assert.equal(extensionDays('small'), 1)
  assert.equal(extensionDays('large'), 3)
  assert.equal(extensionDays('weird'), 1)
})
