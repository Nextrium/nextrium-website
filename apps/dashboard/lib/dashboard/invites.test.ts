import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INVITE_STATE_MESSAGES, INVITE_TTL_DAYS, acceptInvite, findInvite, hashToken, inviteEmail, inviteExpiry, inviteState, issueInvite, newInviteToken } from './invites'
import { createFakeSupabase } from '../testing/fakeSupabase'

const NOW = new Date('2026-10-25T12:00:00Z')
const later = (days: number) => new Date(NOW.getTime() + days * 86_400_000)
const person = (over: Record<string, unknown> = {}) => ({ user_id: 'u1', role: 'member', archived: false, ...over })
const db = (rows: any[] = [person()]) => createFakeSupabase({ dashboard_users: rows, dashboard_invites: [] }, { unique: { dashboard_invites: ['token_hash'] } })

// ── tokens ──────────────────────────────────────────────────────────────────

test('tokens: 43 url-safe characters, unique, hash is sha-256 hex', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const { token, hash } = newInviteToken()
    assert.match(token, /^[A-Za-z0-9_-]{43}$/)
    assert.match(hash, /^[0-9a-f]{64}$/)
    assert.equal(hashToken(token), hash)
    assert.ok(!seen.has(token)); seen.add(token)
  }
})

test('tokens: anything not shaped like a token is refused before any lookup', () => {
  for (const bad of [undefined, null, 42, '', 'short', 'x'.repeat(42), 'x'.repeat(44), 'a'.repeat(42) + '!', '../../etc/passwd', { token: 'x' }]) {
    assert.equal(hashToken(bad as any), null, String(bad))
  }
})

test('expiry: exactly 5 days', () => {
  assert.equal(INVITE_TTL_DAYS, 5)
  assert.equal(inviteExpiry(NOW), later(5).toISOString())
})

test('state: valid, expired (at the second), used, revoked, missing', () => {
  const row = { id: 'i', user_id: 'u1', token_hash: 'h', expires_at: later(5).toISOString(), used_at: null, revoked_at: null }
  assert.equal(inviteState(row, NOW), 'valid')
  assert.equal(inviteState(row, later(5)), 'expired', 'expires at the boundary')
  assert.equal(inviteState({ ...row, used_at: 'x' }, NOW), 'used')
  assert.equal(inviteState({ ...row, revoked_at: 'x', used_at: 'x' }, NOW), 'revoked', 'revoked wins')
  assert.equal(inviteState(null, NOW), 'missing')
})

test('messages: one for every refusal, none naming the account', () => {
  for (const k of ['expired', 'used', 'revoked', 'missing'] as const) {
    assert.ok(INVITE_STATE_MESSAGES[k].length > 10)
    assert.doesNotMatch(INVITE_STATE_MESSAGES[k], /@/)
  }
})

test('email: link, 5-day date, and everything escaped', () => {
  const e = inviteEmail({ url: 'https://dash.test/invite/abc?x=1&y="2"', name: '<script>alert(1)</script>', teamName: 'Nextrium', expiresAt: later(5).toISOString() })
  assert.match(e.subject, /Nextrium dashboard/)
  assert.ok(e.message.includes('href="https://dash.test/invite/abc?x=1&amp;y=&quot;2&quot;"'))
  assert.ok(!e.message.includes('<script>'))
  assert.match(e.message, /30 October 2026/)
  assert.match(inviteEmail({ url: 'https://d', teamName: 'N', expiresAt: NOW.toISOString() }).message, /<p>Hello,<\/p>/)
})

// ── issuing and looking up ──────────────────────────────────────────────────

test('issue: stores only the hash, 5-day expiry; a new invite cancels the earlier one', async () => {
  const { client, tables } = db()
  const first = await issueInvite(client, 'u1', 'admin-1', NOW)
  assert.equal(tables.dashboard_invites.length, 1)
  assert.notEqual(tables.dashboard_invites[0].token_hash, first.token, 'the token itself is never stored')
  assert.equal(tables.dashboard_invites[0].expires_at, later(5).toISOString())
  assert.equal(tables.dashboard_invites[0].created_by, 'admin-1')
  const second = await issueInvite(client, 'u1', 'admin-1', later(1))
  assert.equal((await findInvite(client, first.token, later(1))).state, 'revoked')
  assert.equal((await findInvite(client, second.token, later(1))).state, 'valid')
})

test('issue: other people\'s invites are left alone', async () => {
  const { client } = db([person(), person({ user_id: 'u2' })])
  const a = await issueInvite(client, 'u1', null, NOW)
  await issueInvite(client, 'u2', null, NOW)
  assert.equal((await findInvite(client, a.token, NOW)).state, 'valid')
})

test('issue: a database failure is reported, not hidden', async () => {
  const { client } = createFakeSupabase({ dashboard_invites: [] }, { failNextWrite: { dashboard_invites: { code: 'XX', message: 'down' } } })
  await assert.rejects(() => issueInvite(client, 'u1', null, NOW))
})

test('find: unknown and malformed tokens are just "missing"', async () => {
  const { client, calls } = db()
  assert.equal((await findInvite(client, newInviteToken().token, NOW)).state, 'missing')
  const before = calls.length
  assert.equal((await findInvite(client, 'not a token', NOW)).state, 'missing')
  assert.equal(calls.length, before, 'no database lookup for a malformed token')
})

// ── accepting ───────────────────────────────────────────────────────────────

const signInOk = () => { const who: string[] = []; return { who, fn: async (id: string) => { who.push(id); return true } } }

test('accept: valid link signs in the right person and is used up', async () => {
  const { client, tables } = db()
  const { token } = await issueInvite(client, 'u1', null, NOW)
  const s = signInOk()
  assert.deepEqual(await acceptInvite(client, token, s.fn, later(4.9)), { ok: true, userId: 'u1' })
  assert.deepEqual(s.who, ['u1'])
  assert.ok(tables.dashboard_invites[0].used_at)
  const again = await acceptInvite(client, token, s.fn, later(4.9))
  assert.deepEqual(again, { ok: false, reason: 'used' })
  assert.equal(s.who.length, 1, 'never signs in twice with one link')
})

test('accept: two clicks at the same moment → only one sign-in', async () => {
  const { client } = db()
  const { token } = await issueInvite(client, 'u1', null, NOW)
  const s = signInOk()
  const results = await Promise.all([acceptInvite(client, token, s.fn, NOW), acceptInvite(client, token, s.fn, NOW)])
  assert.equal(results.filter((r) => r.ok).length, 1)
  assert.equal(s.who.length, 1)
})

test('accept: expired, revoked, malformed and unknown links never sign in', async () => {
  const { client } = db()
  const old = await issueInvite(client, 'u1', null, NOW)
  const s = signInOk()
  assert.deepEqual(await acceptInvite(client, old.token, s.fn, later(5)), { ok: false, reason: 'expired' })
  await issueInvite(client, 'u1', null, NOW)
  assert.deepEqual(await acceptInvite(client, old.token, s.fn, NOW), { ok: false, reason: 'revoked' })
  assert.deepEqual(await acceptInvite(client, 'garbage', s.fn, NOW), { ok: false, reason: 'missing' })
  assert.deepEqual(await acceptInvite(client, newInviteToken().token, s.fn, NOW), { ok: false, reason: 'missing' })
  assert.equal(s.who.length, 0)
})

test('accept: archived or removed people are refused and the link is not used up', async () => {
  for (const rows of [[person({ archived: true })], []]) {
    const { client, tables } = db(rows)
    const { token } = await issueInvite(client, 'u1', null, NOW)
    const s = signInOk()
    assert.deepEqual(await acceptInvite(client, token, s.fn, NOW), { ok: false, reason: 'no_access' })
    assert.equal(s.who.length, 0)
    assert.ok(!tables.dashboard_invites[0].used_at, 'not used up')
  }
})

test('accept: if signing in fails or throws, the link is restored and works on retry', async () => {
  for (const failing of [async () => false, async () => { throw new Error('auth down') }]) {
    const { client, tables } = db()
    const { token } = await issueInvite(client, 'u1', null, NOW)
    assert.deepEqual(await acceptInvite(client, token, failing, NOW), { ok: false, reason: 'sign_in_failed' })
    assert.equal(tables.dashboard_invites[0].used_at, null, 'restored')
    const s = signInOk()
    assert.equal((await acceptInvite(client, token, s.fn, NOW)).ok, true, 'retry works')
  }
})
