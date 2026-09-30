import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRestricted } from './accessControl'

test('admin reaches every dashboard page', () => {
  for (const path of ['/dashboard', '/dashboard/settings/team', '/dashboard/logs', '/dashboard/applications']) {
    assert.equal(isRestricted(path, 'admin'), false, path)
  }
})

test('moderator is blocked only from team access, automations and logs', () => {
  assert.equal(isRestricted('/dashboard/applications', 'moderator'), false)
  assert.equal(isRestricted('/dashboard/settings/team', 'moderator'), true)
  assert.equal(isRestricted('/dashboard/settings/automations', 'moderator'), true)
  assert.equal(isRestricted('/dashboard/logs', 'moderator'), true)
})

test('member is allowlisted to the people pages only', () => {
  assert.equal(isRestricted('/dashboard/people', 'member'), false)
  assert.equal(isRestricted('/dashboard/people/me', 'member'), false)
  assert.equal(isRestricted('/dashboard', 'member'), true)
  assert.equal(isRestricted('/dashboard/applications', 'member'), true)
})

test('archived and none are blocked from the whole dashboard', () => {
  for (const role of ['archived', 'none']) {
    assert.equal(isRestricted('/dashboard', role), true, role)
    assert.equal(isRestricted('/dashboard/people/me', role), true, role)
  }
})

test('an unknown role is denied outright', () => {
  assert.equal(isRestricted('/dashboard', 'superuser'), true)
  assert.equal(isRestricted('/dashboard/posts', ''), true)
})

test('members reach their contributor pages but not the staff ones', () => {
  assert.equal(isRestricted('/dashboard/my-tasks', 'member'), false)
  assert.equal(isRestricted('/dashboard/my-tasks/abc', 'member'), false)
  assert.equal(isRestricted('/dashboard/leaderboard', 'member'), false)
  assert.equal(isRestricted('/dashboard/tasks', 'member'), true)
  assert.equal(isRestricted('/dashboard/tasks/abc', 'member'), true)
  assert.equal(isRestricted('/dashboard/reviews', 'member'), true)
  assert.equal(isRestricted('/dashboard/reviews/analytics', 'member'), true)
})

test('tasks and reviews are staff-only (admin, moderator)', () => {
  for (const role of ['content', 'community']) {
    assert.equal(isRestricted('/dashboard/tasks', role), true, role)
    assert.equal(isRestricted('/dashboard/reviews/abc', role), true, role)
  }
  for (const role of ['admin', 'moderator']) {
    assert.equal(isRestricted('/dashboard/tasks', role), false, role)
    assert.equal(isRestricted('/dashboard/reviews', role), false, role)
  }
})
