import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseContributorProfile, splitSkills, SKILLS_MAX } from './profile'

test('parseContributorProfile keeps known categories, de-duplicated', () => {
  const r = parseContributorProfile({ categories: ['design', 'design', 'marketing', 'technical'], skills: [], notifyEmail: true })
  assert.ok('profile' in r)
  assert.deepEqual(r.profile.categories, ['design', 'technical'])
})

test('parseContributorProfile requires at least one category', () => {
  const r = parseContributorProfile({ categories: ['marketing'], skills: [] })
  assert.ok('error' in r)
})

test('parseContributorProfile validates skills and availability', () => {
  assert.ok('error' in parseContributorProfile({ categories: ['design'], skills: Array.from({ length: SKILLS_MAX + 1 }, (_, i) => `s${i}`) }))
  assert.ok('error' in parseContributorProfile({ categories: ['design'], skills: ['x'.repeat(41)] }))
  assert.ok('error' in parseContributorProfile({ categories: ['design'], skills: [], availabilityHoursPerWeek: 200 }))
  assert.ok('error' in parseContributorProfile({ categories: ['design'], skills: [], availabilityHoursPerWeek: 2.5 }))
  const ok = parseContributorProfile({ categories: ['design'], skills: [' Figma ', 'Figma', ''], availabilityHoursPerWeek: 10 })
  assert.ok('profile' in ok)
  assert.deepEqual(ok.profile.skills, ['Figma'])
  assert.equal(ok.profile.availabilityHoursPerWeek, 10)
})

test('availability is optional and notifications default on', () => {
  const r = parseContributorProfile({ categories: ['community'], skills: [], availabilityHoursPerWeek: null })
  assert.ok('profile' in r)
  assert.equal(r.profile.availabilityHoursPerWeek, null)
  assert.equal(r.profile.notifyEmail, true)
  const off = parseContributorProfile({ categories: ['community'], skills: [], notifyEmail: false })
  assert.ok('profile' in off && off.profile.notifyEmail === false)
})

test('splitSkills splits on commas and trims', () => {
  assert.deepEqual(splitSkills(' React, Figma ,, events '), ['React', 'Figma', 'events'])
})
