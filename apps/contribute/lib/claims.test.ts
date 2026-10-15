import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cooldownHoursLeft, cooldownMessage, limitMessage } from './claims'

const now = new Date('2026-10-15T12:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()

test('no unclaim history means no cooldown', () => {
  assert.equal(cooldownHoursLeft({ unclaimed_by: null, unclaimed_at: null }, 'me', now), 0)
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['other'], unclaimed_at: [hoursAgo(1)] }, 'me', now), 0)
})

test('counts down 48 hours from the latest unclaim by this contributor', () => {
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['me'], unclaimed_at: [hoursAgo(1)] }, 'me', now), 47)
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['me'], unclaimed_at: [hoursAgo(47.5)] }, 'me', now), 1)
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['me'], unclaimed_at: [hoursAgo(48)] }, 'me', now), 0)
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['me', 'other', 'me'], unclaimed_at: [hoursAgo(100), hoursAgo(2), hoursAgo(10)] }, 'me', now), 38)
})

test('ignores missing or broken timestamps', () => {
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['me'], unclaimed_at: [] }, 'me', now), 0)
  assert.equal(cooldownHoursLeft({ unclaimed_by: ['me'], unclaimed_at: ['not a date'] }, 'me', now), 0)
})

test('messages read naturally', () => {
  assert.match(cooldownMessage(1), /in 1 hour\.$/)
  assert.match(cooldownMessage(5), /in 5 hours\.$/)
  assert.match(limitMessage(2), /^You already have 2 running tasks\./)
  assert.match(limitMessage(1), /^You already have 1 running task\./)
})
