import { test } from 'node:test'
import assert from 'node:assert/strict'
import { grantDashboardAccess, hasAccepted, inviteAccount, isEmailAlreadyRegistered, type InviteDeps } from './teamAccounts'
import { createFakeSupabase, type FakeAuthUser } from '../testing/fakeSupabase'

const unique = { dashboard_users: ['user_id'] }

/** A fake auth server: /invite creates (or re-sends to) an unconfirmed account. */
function fakeAuth(authUsers: FakeAuthUser[], behaviour: 'ok' | 'fail' | 'network' | 'exists' | 'no-id' = 'ok') {
  const sent: { email: string; role: string }[] = []
  const fetchFn = (async (url: string, init: any) => {
    if (behaviour === 'network') throw new Error('ECONNRESET')
    assert.match(String(url), /\/auth\/v1\/invite\?redirect_to=/)
    const body = JSON.parse(init.body)
    sent.push({ email: body.email, role: body.data.role })
    const json = (status: number, data: unknown) => ({ ok: status < 300, status, json: async () => data }) as Response
    if (behaviour === 'fail') return json(500, { msg: 'Email rate limit exceeded' })
    if (behaviour === 'exists') return json(422, { error_code: 'email_exists', msg: 'A user with this email address has already been registered' })
    if (behaviour === 'no-id') return json(200, {})
    let u = authUsers.find((x) => x.email === body.email)
    if (u && (u as any).email_confirmed_at) return json(422, { error_code: 'email_exists' })
    if (!u) { u = { id: `auth-${authUsers.length + 1}`, email: body.email }; authUsers.push(u) }
    return json(200, { id: u.id })
  }) as unknown as typeof fetch
  return { fetchFn, sent }
}

function setup(seed: Record<string, any[]>, authUsers: FakeAuthUser[], behaviour?: Parameters<typeof fakeAuth>[1]) {
  const fake = createFakeSupabase({ applications: [], agent_screening_results: [], staff_tracks: [], dashboard_users: [], ...seed }, { unique }, authUsers)
  const auth = fakeAuth(authUsers, behaviour)
  const deps: InviteDeps = { db: fake.client, fetchFn: auth.fetchFn, supabaseUrl: 'https://sb.test', secret: 'k', redirectTo: 'https://dash.test/auth/callback' }
  return { ...fake, ...auth, deps }
}

const accepted = (id: string, email: string): FakeAuthUser => ({ id, email, ...{ email_confirmed_at: '2026-10-01', last_sign_in_at: '2026-10-01' } } as any)
const pending = (id: string, email: string): FakeAuthUser => ({ id, email })
const rowsFor = (tables: Record<string, any[]>, id: string) => tables.dashboard_users.filter((r) => r.user_id === id)

// ── small helpers ────────────────────────────────────────────────────────────

test('helpers: email-exists detection and accepted accounts', () => {
  assert.ok(isEmailAlreadyRegistered({ error_code: 'email_exists' }))
  assert.ok(isEmailAlreadyRegistered({ msg: 'A user with this email address has already been registered' }))
  assert.ok(!isEmailAlreadyRegistered({ msg: 'rate limit' }))
  assert.ok(!isEmailAlreadyRegistered(null))
  assert.ok(hasAccepted({ id: 'a', email_confirmed_at: 'x' }))
  assert.ok(hasAccepted({ id: 'a', last_sign_in_at: 'x' }))
  assert.ok(!hasAccepted({ id: 'a' }))
})

// ── grantDashboardAccess ─────────────────────────────────────────────────────

test('grant: creates once; a second grant finds the row and keeps its role', async () => {
  const { client, tables } = createFakeSupabase({ dashboard_users: [] }, { unique })
  assert.deepEqual(await grantDashboardAccess('u1', 'member', undefined, true, client), { status: 'created' })
  assert.deepEqual(await grantDashboardAccess('u1', 'admin', 'app-1', true, client), { status: 'exists', role: 'member', becameMember: false })
  assert.equal(rowsFor(tables, 'u1').length, 1)
  assert.equal(tables.dashboard_users[0].application_id, 'app-1', 'missing application filled in')
})

test('grant: moderator asked to be a member keeps the role and becomes a team member; archived refused', async () => {
  const { client, tables } = createFakeSupabase({ dashboard_users: [
    { user_id: 'mod', role: 'moderator', is_team_member: false, archived: false },
    { user_id: 'gone', role: 'member', is_team_member: true, archived: true },
  ] }, { unique })
  assert.deepEqual(await grantDashboardAccess('mod', 'member', undefined, true, client), { status: 'exists', role: 'moderator', becameMember: true })
  assert.equal(tables.dashboard_users[0].is_team_member, true)
  assert.deepEqual(await grantDashboardAccess('gone', 'member', undefined, true, client), { status: 'archived' })
})

test('grant: a row added by another request at the same moment is used, not duplicated', async () => {
  const { client, tables } = createFakeSupabase({ dashboard_users: [] }, { unique })
  const realFrom = client.from
  let first = true
  client.from = (t: string) => {
    const b = realFrom(t)
    if (t === 'dashboard_users' && first) {
      first = false
      // The read sees nothing, then the other request inserts before ours.
      const realMaybe = b.maybeSingle
      b.maybeSingle = () => { const r = realMaybe(); tables.dashboard_users.push({ id: 'x', user_id: 'u1', role: 'member', archived: false, is_team_member: true }); return r }
    }
    return b
  }
  const r = await grantDashboardAccess('u1', 'member', undefined, true, client)
  assert.equal(r.status, 'exists')
  assert.equal(rowsFor(tables, 'u1').length, 1)
})

test('grant: an unreadable row (database error) stops instead of adding another', async () => {
  // Without the unique rule, two rows make maybeSingle fail: that must not create a third.
  const { client, tables } = createFakeSupabase({ dashboard_users: [
    { user_id: 'u1', role: 'member', archived: false }, { user_id: 'u1', role: 'member', archived: false },
  ] })
  await assert.rejects(() => grantDashboardAccess('u1', 'member', undefined, true, client))
  assert.equal(rowsFor(tables, 'u1').length, 2)
})

// ── inviteAccount: every outcome ─────────────────────────────────────────────

test('invite: a new person is invited once, gets one row, and their track from their application', async () => {
  const s = setup({ applications: [{ id: 'a1', email: 'new@x.com', status: 'accepted', created_at: '2026-10-01' }], agent_screening_results: [{ application_id: 'a1', evaluation_track: 'Technical Engineering', screened_at: '2026-10-02' }] }, [])
  const r = await inviteAccount({ email: ' New@X.com ', role: 'member', asTeamMember: true }, s.deps)
  assert.equal(r.kind, 'invited')
  assert.equal(s.sent.length, 1)
  assert.equal(s.sent[0].email, 'new@x.com', 'trimmed and lower-cased')
  const rows = rowsFor(s.tables, (r as any).userId)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].application_id, 'a1')
  assert.ok(rows[0].staff_track_id)
  assert.equal((r as any).tracks.track, 'Technical Engineering')
})

test('invite (the duplicate-row bug): inviting someone again before they accept re-sends, still one row', async () => {
  const s = setup({}, [])
  const first = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
  assert.equal(first.kind, 'invited')
  for (let i = 0; i < 4; i++) {
    const again = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
    assert.equal(again.kind, 'reinvited')
  }
  assert.equal(s.sent.length, 5, 'the email is sent again each time')
  assert.equal(s.tables.dashboard_users.length, 1, 'never a second row')
})

test('invite: someone who already accepted is not emailed again', async () => {
  const s = setup({ dashboard_users: [{ user_id: 'u1', role: 'member', archived: false, is_team_member: true }] }, [accepted('u1', 'ada@x.com')])
  const r = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
  assert.equal(r.kind, 'already')
  assert.equal(s.sent.length, 0)
  assert.equal(s.tables.dashboard_users.length, 1)
})

test('invite: an existing account without access is added directly, with no email', async () => {
  const s = setup({}, [accepted('u1', 'ada@x.com')])
  const r = await inviteAccount({ email: 'ada@x.com', role: 'content', asTeamMember: false }, s.deps)
  assert.equal(r.kind, 'added_existing')
  assert.equal(s.sent.length, 0)
  assert.equal(rowsFor(s.tables, 'u1')[0].role, 'content')
})

test('invite: an archived person is refused, nothing sent, nothing changed', async () => {
  for (const acct of [accepted('u1', 'ada@x.com'), pending('u1', 'ada@x.com')]) {
    const s = setup({ dashboard_users: [{ user_id: 'u1', role: 'member', archived: true }] }, [acct])
    const r = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
    assert.equal(r.kind, 'archived')
    assert.equal(s.sent.length, 0)
    assert.equal(s.tables.dashboard_users.length, 1)
  }
})

test('invite: auth server failure, network failure or a missing id → error and no row', async () => {
  for (const b of ['fail', 'network', 'no-id'] as const) {
    const s = setup({}, [], b)
    const r = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
    assert.equal(r.kind, 'error', b)
    assert.equal(s.tables.dashboard_users.length, 0, b)
  }
})

test('invite: re-sending fails (e.g. rate limit) → error, existing row untouched', async () => {
  const s = setup({ dashboard_users: [{ user_id: 'u1', role: 'member', archived: false, is_team_member: true }] }, [pending('u1', 'ada@x.com')], 'fail')
  const r = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
  assert.equal(r.kind, 'error')
  assert.equal(s.tables.dashboard_users.length, 1)
})

test('invite: the account appears between the lookup and the invite → treated as existing', async () => {
  const users: FakeAuthUser[] = []
  const s = setup({}, users, 'exists')
  // The auth server says "exists"; by then the account is in the list.
  users.push(accepted('u9', 'ada@x.com'))
  const fake = createFakeSupabase({ dashboard_users: [], applications: [], agent_screening_results: [], staff_tracks: [] }, { unique }, [])
  let lookups = 0
  fake.client.auth.admin.listUsers = async () => ({ data: { users: lookups++ === 0 ? [] : users }, error: null })
  const r = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, { ...s.deps, db: fake.client })
  assert.equal(r.kind, 'added_existing')
  assert.equal(fake.tables.dashboard_users.length, 1)
})

test('invite: exists but cannot be found → clear error', async () => {
  const s = setup({}, [], 'exists')
  const r = await inviteAccount({ email: 'ada@x.com', role: 'member', asTeamMember: true }, s.deps)
  assert.equal(r.kind, 'error')
  assert.match((r as any).message, /could not be found/)
})

test('invite: bad email → error before anything is called', async () => {
  const s = setup({}, [])
  for (const e of ['', 'nope', '   ']) {
    const r = await inviteAccount({ email: e, role: 'member', asTeamMember: true }, s.deps)
    assert.equal(r.kind, 'error')
  }
  assert.equal(s.sent.length, 0)
  assert.equal(s.calls.length, 0)
})

test('invite from an application: links that application and its track', async () => {
  const s = setup({
    applications: [{ id: 'a7', email: 'ada@x.com', status: 'accepted', created_at: '2026-10-01' }, { id: 'a8', email: 'ada@x.com', status: 'accepted', created_at: '2026-10-09' }],
    agent_screening_results: [{ application_id: 'a7', evaluation_track: 'Operations', screened_at: '2026-10-02' }, { application_id: 'a8', evaluation_track: 'Technical Engineering', screened_at: '2026-10-10' }],
  }, [])
  const r = await inviteAccount({ email: 'ada@x.com', role: 'member', applicationId: 'a7', asTeamMember: true }, s.deps)
  assert.equal(r.kind, 'invited')
  const row = s.tables.dashboard_users[0]
  assert.equal(row.application_id, 'a7', 'the application invited from, not another by email')
  assert.equal((r as any).tracks.track, 'Operations')
})
