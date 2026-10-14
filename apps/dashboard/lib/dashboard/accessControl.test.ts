import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRestricted } from './accessControl'

test('admin reaches every dashboard page', () => {
  for (const path of ['/', '/settings/team', '/logs', '/applications']) {
    assert.equal(isRestricted(path, 'admin'), false, path)
  }
})

test('moderator is blocked only from team access, automations and logs', () => {
  assert.equal(isRestricted('/applications', 'moderator'), false)
  assert.equal(isRestricted('/settings/team', 'moderator'), true)
  assert.equal(isRestricted('/settings/automations', 'moderator'), true)
  assert.equal(isRestricted('/logs', 'moderator'), true)
})

test('member is allowlisted to the people pages only', () => {
  assert.equal(isRestricted('/people', 'member'), false)
  assert.equal(isRestricted('/people/me', 'member'), false)
  assert.equal(isRestricted('/', 'member'), true)
  assert.equal(isRestricted('/applications', 'member'), true)
})

test('archived and none are blocked from the whole dashboard', () => {
  for (const role of ['archived', 'none']) {
    assert.equal(isRestricted('/', role), true, role)
    assert.equal(isRestricted('/people/me', role), true, role)
  }
})

test('an unknown role is denied outright', () => {
  assert.equal(isRestricted('/', 'superuser'), true)
  assert.equal(isRestricted('/posts', ''), true)
})

test('members reach their contributor pages but not the staff ones', () => {
  assert.equal(isRestricted('/my-tasks', 'member'), false)
  assert.equal(isRestricted('/my-tasks/abc', 'member'), false)
  assert.equal(isRestricted('/leaderboard', 'member'), false)
  assert.equal(isRestricted('/tasks', 'member'), true)
  assert.equal(isRestricted('/tasks/abc', 'member'), true)
  assert.equal(isRestricted('/reviews', 'member'), true)
  assert.equal(isRestricted('/reviews/analytics', 'member'), true)
})

test('every active role reaches its own tasks and the leaderboard', () => {
  for (const role of ['admin', 'moderator', 'content', 'community', 'member']) {
    assert.equal(isRestricted('/my-tasks', role), false, role)
    assert.equal(isRestricted('/my-tasks/abc', role), false, role)
    assert.equal(isRestricted('/leaderboard', role), false, role)
    assert.equal(isRestricted('/leaderboard/abc', role), false, role)
  }
})

test('tasks and reviews are staff-only (admin, moderator)', () => {
  for (const role of ['content', 'community']) {
    assert.equal(isRestricted('/tasks', role), true, role)
    assert.equal(isRestricted('/reviews/abc', role), true, role)
  }
  for (const role of ['admin', 'moderator']) {
    assert.equal(isRestricted('/tasks', role), false, role)
    assert.equal(isRestricted('/reviews', role), false, role)
  }
})
