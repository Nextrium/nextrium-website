import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseApplication, parseProfileFields } from './registration'

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) fd.append(k, x)
  return fd
}

const valid = {
  name: 'Ada Obi',
  contributor_type: 'individual',
  location: 'Lagos, Nigeria',
  timezone: 'Africa/Lagos',
  categories: ['technical', 'design'],
  skills: 'TypeScript, React, TypeScript',
  availability_hours_per_week: '5',
  bio: 'I build web apps.',
  notification_email: 'on',
}

test('accepts a complete application and normalises it', () => {
  const r = parseApplication(form({ ...valid, github_handle: '@ada-obi', twitter_handle: 'https://x.com/ada_o', linkedin_url: 'linkedin.com/in/ada', portfolio_url: 'http://ada.dev' }))
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.value.github_handle, 'ada-obi')
  assert.equal(r.value.twitter_handle, 'ada_o')
  assert.equal(r.value.linkedin_url, 'https://linkedin.com/in/ada')
  assert.equal(r.value.portfolio_url, 'https://ada.dev/')
  assert.deepEqual(r.value.skills, ['TypeScript', 'React'])
  assert.equal(r.value.team_name, null)
  assert.equal(r.value.notification_email, true)
  assert.equal(r.value.availability_hours_per_week, 5)
})

test('never carries fields the contributor does not control', () => {
  const r = parseApplication(form({ ...valid, status: 'active', total_points: '9999', max_claims: '50', email: 'other@example.com', user_id: 'x' }))
  assert.ok(r.ok)
  if (!r.ok) return
  for (const k of ['status', 'total_points', 'max_claims', 'email', 'user_id']) assert.ok(!(k in r.value), k)
})

test('teams need a team name; individuals never keep one', () => {
  assert.equal(parseApplication(form({ ...valid, contributor_type: 'team' })).ok, false)
  const team = parseApplication(form({ ...valid, contributor_type: 'team', team_name: 'Lagos Devs' }))
  assert.ok(team.ok && team.value.team_name === 'Lagos Devs')
  const solo = parseApplication(form({ ...valid, team_name: 'ignored' }))
  assert.ok(solo.ok && solo.value.team_name === null)
  assert.equal(parseApplication(form({ ...valid, contributor_type: 'company' })).ok, false)
})

test('categories: one or two from the list', () => {
  assert.equal(parseApplication(form({ ...valid, categories: [] })).ok, false)
  assert.equal(parseApplication(form({ ...valid, categories: ['technical', 'design', 'research'] })).ok, false)
  assert.equal(parseApplication(form({ ...valid, categories: ['hacking'] })).ok, false)
  const dup = parseApplication(form({ ...valid, categories: ['technical', 'technical'] }))
  assert.ok(dup.ok && dup.value.categories.length === 1)
})

test('rejects values outside the lists and over the limits', () => {
  assert.equal(parseApplication(form({ ...valid, timezone: 'Mars/Base' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, availability_hours_per_week: '7' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, name: 'x'.repeat(101) })).ok, false)
  assert.equal(parseApplication(form({ ...valid, name: ' ' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, bio: '' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, bio: 'x'.repeat(2001) })).ok, false)
  assert.equal(parseApplication(form({ ...valid, location: '' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, skills: Array.from({ length: 21 }, (_, i) => `s${i}`).join(',') })).ok, false)
  assert.equal(parseApplication(form({ ...valid, skills: 'x'.repeat(41) })).ok, false)
})

test('rejects unsafe or foreign links and handles', () => {
  assert.equal(parseApplication(form({ ...valid, linkedin_url: 'javascript:alert(1)' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, portfolio_url: 'https://user:pass@ada.dev' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, portfolio_url: 'notaurl' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, github_handle: 'https://gitlab.com/ada' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, github_handle: 'bad handle' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, twitter_handle: 'way_too_long_handle_here' })).ok, false)
  assert.equal(parseApplication(form({ ...valid, wallet_address: 'addr1<script>' })).ok, false)
  const ok = parseApplication(form({ ...valid, wallet_address: 'addr1qxy2' }))
  assert.ok(ok.ok && ok.value.wallet_address === 'addr1qxy2')
})

test('email reminders are off unless ticked', () => {
  const { notification_email: _, ...rest } = valid
  const r = parseApplication(form(rest))
  assert.ok(r.ok && r.value.notification_email === false)
})

test('profile edits cover only the editable fields', () => {
  const r = parseProfileFields(form({ ...valid, name: 'New Name', categories: ['research'], contributor_type: 'team', team_name: 'X', status: 'active' }))
  assert.ok(r.ok)
  if (!r.ok) return
  for (const k of ['name', 'categories', 'contributor_type', 'team_name', 'status', 'email', 'user_id']) assert.ok(!(k in r.value), k)
  assert.equal(r.value.location, 'Lagos, Nigeria')
  assert.equal(parseProfileFields(form({ ...valid, bio: '' })).ok, false)
})
