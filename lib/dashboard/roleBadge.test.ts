import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roleBadgeLabel } from './roleBadge'

test('each dashboard role gets its own badge', () => {
  assert.equal(roleBadgeLabel('admin'), 'Admin')
  assert.equal(roleBadgeLabel('moderator'), 'Moderator')
  assert.equal(roleBadgeLabel('content'), 'Content')
  assert.equal(roleBadgeLabel('community'), 'Community')
  assert.equal(roleBadgeLabel('member'), 'Member')
})

test('unknown, pseudo and empty roles get no badge', () => {
  for (const role of ['archived', 'none', 'superuser', '', null, undefined, 'toString', '__proto__']) {
    assert.equal(roleBadgeLabel(role), null, String(role))
  }
})
