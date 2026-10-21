import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GROUP_MAX, groupDeadline, groupOutcome, parseGroupAssignees } from './groupRules'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('group: needs 2 to 20 valid, distinct people', () => {
  assert.deepEqual(parseGroupAssignees([id(1), id(2)]), { ids: [id(1), id(2)] })
  // duplicates (any case) count once
  assert.deepEqual(parseGroupAssignees([id(1), id(1).toUpperCase(), id(2)]), { ids: [id(1), id(2)] })
  assert.ok('error' in parseGroupAssignees([id(1)]))
  assert.ok('error' in parseGroupAssignees([id(1), id(1)]))
  assert.ok('error' in parseGroupAssignees([]))
  assert.equal('ids' in parseGroupAssignees(Array.from({ length: GROUP_MAX }, (_, i) => id(i + 1))), true)
  assert.ok('error' in parseGroupAssignees(Array.from({ length: GROUP_MAX + 1 }, (_, i) => id(i + 1))))
})

test('group: rejects anything that is not a list of ids', () => {
  for (const bad of [null, undefined, 'x', id(1), { 0: id(1) }, [id(1), 'not-an-id'], [id(1), 42], [id(1), null]]) {
    assert.ok('error' in parseGroupAssignees(bad), JSON.stringify(bad))
  }
  // a huge list is refused before it is walked
  assert.ok('error' in parseGroupAssignees(Array.from({ length: 10_000 }, () => id(1))))
})

test('group: one deadline for everyone', () => {
  const now = new Date('2026-10-21T10:00:00Z')
  assert.equal(groupDeadline(null, 7, now), '2026-10-28T10:00:00.000Z')
  assert.equal(groupDeadline('2026-11-01T09:00:00.000Z', 7, now), '2026-11-01T09:00:00.000Z')
})

test('group: outcome names who was not assigned', () => {
  assert.equal(groupOutcome(3, []), 'Assigned to all 3 people.')
  assert.match(groupOutcome(2, [{ name: 'Ada', error: 'archived' }]), /Assigned to 2 of 3\. Not assigned: Ada \(archived\)/)
})
