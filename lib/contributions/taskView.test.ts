import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deadlineLabel, effectiveDeadline, isOverdue } from './taskView'

const now = new Date('2026-10-01T12:00:00Z')

test('effectiveDeadline prefers a granted extension', () => {
  assert.equal(effectiveDeadline({ deadline_at: '2026-10-02T00:00:00Z', extended_deadline_at: null })?.toISOString(), '2026-10-02T00:00:00.000Z')
  assert.equal(effectiveDeadline({ deadline_at: '2026-10-02T00:00:00Z', extended_deadline_at: '2026-10-04T00:00:00Z' })?.toISOString(), '2026-10-04T00:00:00.000Z')
  assert.equal(effectiveDeadline({ deadline_at: null, extended_deadline_at: null }), null)
})

test('isOverdue only for open tasks past the effective deadline', () => {
  const past = { deadline_at: '2026-09-30T00:00:00Z', extended_deadline_at: null }
  assert.equal(isOverdue({ ...past, status: 'assigned' }, now), true)
  assert.equal(isOverdue({ ...past, status: 'changes_requested' }, now), true)
  assert.equal(isOverdue({ ...past, status: 'submitted' }, now), false)
  assert.equal(isOverdue({ ...past, status: 'completed' }, now), false)
  assert.equal(isOverdue({ ...past, extended_deadline_at: '2026-10-03T00:00:00Z', status: 'assigned' }, now), false)
  assert.equal(isOverdue({ status: 'draft', deadline_at: null, extended_deadline_at: null }, now), false)
})

test('deadlineLabel describes time left or overdue', () => {
  assert.equal(deadlineLabel({ status: 'assigned', deadline_at: '2026-10-04T12:00:00Z', extended_deadline_at: null }, now), 'in 3 days')
  assert.equal(deadlineLabel({ status: 'assigned', deadline_at: '2026-10-01T17:00:00Z', extended_deadline_at: null }, now), 'in 5 hours')
  assert.equal(deadlineLabel({ status: 'assigned', deadline_at: '2026-10-01T11:00:00Z', extended_deadline_at: null }, now), '1 hour overdue')
  assert.equal(deadlineLabel({ status: 'assigned', deadline_at: '2026-09-29T12:00:00Z', extended_deadline_at: null }, now), '2 days overdue')
  assert.equal(deadlineLabel({ status: 'completed', deadline_at: '2026-09-29T12:00:00Z', extended_deadline_at: null }, now), '2026-09-29')
  assert.equal(deadlineLabel({ status: 'draft', deadline_at: null, extended_deadline_at: null }, now), '—')
})
