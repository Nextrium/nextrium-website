import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditActionLabel, parseCoreMember, parseMaxClaims } from './teamRules'

test('core team members: valid input is normalised', () => {
  const r = parseCoreMember({ name: '  Ada Obi ', email: ' Ada@Example.org ', role: 'reviewer', department: 'technical' })
  assert.deepEqual(r, { member: { name: 'Ada Obi', email: 'ada@example.org', role: 'reviewer', department: 'technical' } })
})

test('core team members: only database-allowed roles and departments', () => {
  const base = { name: 'Ada', email: 'a@x.org', role: 'reviewer', department: 'technical' }
  assert.ok('error' in parseCoreMember({ ...base, role: 'admin' }))
  assert.ok('error' in parseCoreMember({ ...base, department: 'marketing' }))
  assert.ok('error' in parseCoreMember({ ...base, email: 'not-an-email' }))
  assert.ok('error' in parseCoreMember({ ...base, name: 'x' }))
})

test('running-task limit: whole numbers from 1 to 5', () => {
  assert.equal(parseMaxClaims(3), 3)
  assert.equal(parseMaxClaims('5'), 5)
  for (const bad of [0, 6, 2.5, '', 'two', null, -1]) assert.equal(parseMaxClaims(bad), null, String(bad))
})

test('audit actions read as sentences', () => {
  assert.equal(auditActionLabel('contribution.verified'), 'Contribution verified')
  assert.equal(auditActionLabel('task.extension_granted'), 'Task extension granted')
})
