import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exactLike, latestScreenedTrack, linkApplicationAndTrack, pickApplication } from './tracks'
import { createFakeSupabase } from '../testing/fakeSupabase'

const U = 'user-1'
const app = (id: string, email: string, status = 'accepted', created_at = '2026-10-01') => ({ id, email, status, created_at, name: `App ${id}` })
const scr = (application_id: string, evaluation_track: string | null, screened_at = '2026-10-02') => ({ application_id, evaluation_track, screened_at })
const person = (over: Record<string, unknown> = {}) => ({ user_id: U, role: 'member', archived: false, application_id: null, staff_track_id: null, ...over })

// ── pure rules ───────────────────────────────────────────────────────────────

test('pickApplication: screened, then accepted, then newest; none → null', () => {
  assert.equal(pickApplication([], new Set()), null)
  const a = { id: 'a', status: 'pending', created_at: '2026-10-05' }
  const b = { id: 'b', status: 'accepted', created_at: '2026-10-01' }
  const c = { id: 'c', status: 'rejected', created_at: '2026-09-01' }
  assert.equal(pickApplication([a, b, c], new Set()), 'b', 'accepted beats newer')
  assert.equal(pickApplication([a, b, c], new Set(['c'])), 'c', 'screened beats accepted')
  assert.equal(pickApplication([a, { ...c, status: 'pending' }], new Set()), 'a', 'then newest')
})

test('latestScreenedTrack: newest screening, known tracks only', () => {
  const s = [scr('x', 'Operations', '2026-10-01'), scr('x', 'Technical Engineering', '2026-10-03'), scr('x', null, '2026-10-09'), scr('y', 'Research and Strategy', '2026-10-10')]
  assert.equal(latestScreenedTrack(s, 'x'), 'Technical Engineering', 'null track ignored, other application ignored')
  assert.equal(latestScreenedTrack([scr('x', ' Operations ')], 'x'), 'Operations', 'trimmed')
  assert.equal(latestScreenedTrack([scr('x', 'Made Up Track')], 'x'), null, 'unknown track refused')
  assert.equal(latestScreenedTrack([], 'x'), null)
})

test('exactLike escapes wildcards', () => {
  assert.equal(exactLike('a_b%c\\d@x.com'), 'a\\_b\\%c\\\\d@x.com')
})

// ── linking against a fake database ─────────────────────────────────────────

const unique = { dashboard_users: ['user_id'] }

test('link: linked application without a track gets its screened track (track row created)', async () => {
  const { client, tables } = createFakeSupabase({
    dashboard_users: [person({ application_id: 'a1' })], applications: [app('a1', 'ada@x.com')],
    agent_screening_results: [scr('a1', 'Product and Design')], staff_tracks: [],
  }, { unique })
  const r = await linkApplicationAndTrack(client, U, 'ada@x.com')
  assert.deepEqual(r, { applicationId: 'a1', linked: false, track: 'Product and Design', trackSet: true })
  assert.equal(tables.staff_tracks.length, 1)
  assert.equal(tables.dashboard_users[0].staff_track_id, tables.staff_tracks[0].id)
})

test('link: unlinked person is linked by email (any case) and given the track; existing track row reused', async () => {
  const { client, tables } = createFakeSupabase({
    dashboard_users: [person()], applications: [app('a1', 'Ada@X.com')],
    agent_screening_results: [scr('a1', 'Operations')], staff_tracks: [{ id: 't-ops', name: 'Operations' }],
  }, { unique })
  const r = await linkApplicationAndTrack(client, U, 'ada@x.com')
  assert.deepEqual(r, { applicationId: 'a1', linked: true, track: 'Operations', trackSet: true })
  assert.equal(tables.dashboard_users[0].application_id, 'a1')
  assert.equal(tables.dashboard_users[0].staff_track_id, 't-ops')
  assert.equal(tables.staff_tracks.length, 1, 'no duplicate track')
})

test('link: several applications → the screened one', async () => {
  const { client, tables } = createFakeSupabase({
    dashboard_users: [person()],
    applications: [app('new', 'ada@x.com', 'pending', '2026-10-09'), app('old', 'ada@x.com', 'rejected', '2026-01-01')],
    agent_screening_results: [scr('old', 'Research and Strategy')], staff_tracks: [],
  }, { unique })
  const r = await linkApplicationAndTrack(client, U, 'ada@x.com')
  assert.equal(r.applicationId, 'old')
  assert.equal(r.track, 'Research and Strategy')
  assert.equal(tables.dashboard_users[0].application_id, 'old')
})

test('link: a track already set (by hand) is never changed; the application is still linked', async () => {
  const { client, tables } = createFakeSupabase({
    dashboard_users: [person({ staff_track_id: 't-manual' })], applications: [app('a1', 'ada@x.com')],
    agent_screening_results: [scr('a1', 'Operations')], staff_tracks: [{ id: 't-manual', name: 'Community and Events' }],
  }, { unique })
  const r = await linkApplicationAndTrack(client, U, 'ada@x.com')
  assert.deepEqual(r, { applicationId: 'a1', linked: true, track: null, trackSet: false })
  assert.equal(tables.dashboard_users[0].staff_track_id, 't-manual')
})

test('link: archived, missing person, no application, unscreened, unknown track → nothing set', async () => {
  const base = { applications: [app('a1', 'ada@x.com')], staff_tracks: [] as any[] }
  const cases: [string, Record<string, any[]>, Partial<{ linked: boolean }>][] = [
    ['archived', { ...base, dashboard_users: [person({ archived: true })], agent_screening_results: [scr('a1', 'Operations')] }, { linked: false }],
    ['missing person', { ...base, dashboard_users: [], agent_screening_results: [scr('a1', 'Operations')] }, { linked: false }],
    ['no application', { applications: [], staff_tracks: [], dashboard_users: [person()], agent_screening_results: [] }, { linked: false }],
    ['unscreened', { ...base, dashboard_users: [person()], agent_screening_results: [] }, { linked: true }],
    ['unknown track', { ...base, dashboard_users: [person()], agent_screening_results: [scr('a1', 'Wizardry')] }, { linked: true }],
  ]
  for (const [name, seed, expect] of cases) {
    const { client, tables } = createFakeSupabase(seed, { unique })
    const r = await linkApplicationAndTrack(client, U, 'ada@x.com')
    assert.equal(r.trackSet, false, name)
    assert.equal(r.linked, expect.linked, name)
    assert.equal(tables.staff_tracks.length, 0, `${name}: no track row created`)
    if (name === 'archived') assert.equal(tables.dashboard_users[0].application_id, null, 'archived person untouched')
  }
})

test('link: wildcards in an email never match a different address', async () => {
  const { client, tables } = createFakeSupabase({
    dashboard_users: [person()], applications: [app('a1', 'axb@x.com')], agent_screening_results: [scr('a1', 'Operations')], staff_tracks: [],
  }, { unique })
  const r = await linkApplicationAndTrack(client, U, 'a_b@x.com')
  assert.equal(r.linked, false)
  assert.equal(tables.dashboard_users[0].application_id, null)
})

test('link: no email or a bad email → no lookup', async () => {
  const { client, calls } = createFakeSupabase({ dashboard_users: [person()], applications: [app('a1', 'ada@x.com')] }, { unique })
  assert.equal((await linkApplicationAndTrack(client, U, null)).linked, false)
  assert.equal((await linkApplicationAndTrack(client, U, 'not-an-email')).linked, false)
  assert.equal(calls.filter((c) => c.table === 'applications').length, 0)
})

test('link: a track row added by someone else meanwhile is reused', async () => {
  const { client, tables } = createFakeSupabase({
    dashboard_users: [person({ application_id: 'a1' })], agent_screening_results: [scr('a1', 'Operations')], staff_tracks: [],
  }, { unique: { ...unique, staff_tracks: ['name'] } })
  // Simulate the race: the insert fails as if another request just added it.
  const realFrom = client.from
  let raced = false
  client.from = (t: string) => {
    if (t === 'staff_tracks' && !raced) {
      const b = realFrom(t)
      const realInsert = b.insert
      b.insert = (row: any) => { raced = true; tables.staff_tracks.push({ id: 't-other', name: 'Operations' }); return realInsert(row) }
      return b
    }
    return realFrom(t)
  }
  const r = await linkApplicationAndTrack(client, U, 'ada@x.com')
  assert.equal(r.trackSet, true)
  assert.equal(tables.dashboard_users[0].staff_track_id, 't-other')
  assert.equal(tables.staff_tracks.length, 1)
})
