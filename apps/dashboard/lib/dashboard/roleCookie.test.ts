import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_COOKIE_MAX_AGE, signRoleCookie, verifyRoleCookie } from './roleCookie'

const SECRET = 'a'.repeat(32)
const OTHER_SECRET = 'b'.repeat(32)
const USER = '11111111-1111-1111-1111-111111111111'
const NOW = 1_800_000_000_000

const sign = (role = 'member', onboarded = true) => signRoleCookie({ userId: USER, role, onboarded }, SECRET, NOW)

test('a signed cookie returns its role and onboarding state', async () => {
  for (const role of ['admin', 'moderator', 'content', 'community', 'member', 'archived']) {
    for (const onboarded of [true, false]) {
      const cookie = await sign(role, onboarded)
      assert.deepEqual(await verifyRoleCookie(cookie!, USER, SECRET, NOW), { role, onboarded })
    }
  }
})

test('old unsigned cookies are ignored', async () => {
  assert.equal(await verifyRoleCookie(`${USER}:admin:1`, USER, SECRET, NOW), null)
})

test('changing any part of a signed cookie invalidates it', async () => {
  const parts = (await sign())!.split(':')
  const changed = [
    [USER, 'admin', parts[2], parts[3], parts[4]],
    [USER, parts[1], '0', parts[3], parts[4]],
    [USER, parts[1], parts[2], String(Number(parts[3]) + 3600), parts[4]],
    [USER, parts[1], parts[2], parts[3], 'AAAA'],
    [USER, parts[1], parts[2], parts[3], ''],
  ]
  for (const value of changed) {
    assert.equal(await verifyRoleCookie(value.join(':'), USER, SECRET, NOW), null, value.join(':'))
  }
})

test('a cookie signed with another secret is ignored', async () => {
  const cookie = await signRoleCookie({ userId: USER, role: 'admin', onboarded: true }, OTHER_SECRET, NOW)
  assert.equal(await verifyRoleCookie(cookie!, USER, SECRET, NOW), null)
})

test('a cookie stops working at its expiry, even if the browser keeps it', async () => {
  const cookie = await sign('admin')
  const lastValid = NOW + (ROLE_COOKIE_MAX_AGE - 1) * 1000
  const expired = NOW + ROLE_COOKIE_MAX_AGE * 1000
  assert.notEqual(await verifyRoleCookie(cookie!, USER, SECRET, lastValid), null)
  assert.equal(await verifyRoleCookie(cookie!, USER, SECRET, expired), null)
  assert.equal(await verifyRoleCookie(cookie!, USER, SECRET, NOW + 86_400_000), null)
})

test("another account can't use the cookie", async () => {
  const cookie = await sign('admin')
  assert.equal(await verifyRoleCookie(cookie!, '22222222-2222-2222-2222-222222222222', SECRET, NOW), null)
})

test('a missing or short secret caches nothing and trusts nothing', async () => {
  const cookie = await sign('admin')
  for (const secret of [undefined, '', 'short']) {
    assert.equal(await signRoleCookie({ userId: USER, role: 'admin', onboarded: true }, secret, NOW), null)
    assert.equal(await verifyRoleCookie(cookie!, USER, secret, NOW), null)
  }
})

test('roles that should never be cached are refused, even when signed', async () => {
  for (const role of ['none', 'owner', '']) {
    const cookie = await sign(role)
    assert.equal(await verifyRoleCookie(cookie!, USER, SECRET, NOW), null, role)
  }
})

test('malformed values are ignored', async () => {
  for (const value of [undefined, '', ':', '::::', `${USER}:admin`, `${USER}:admin:1:abc:sig`, `${USER}:admin:2:9999999999:sig`, `${USER}:admin:1:9999999999:sig:extra`]) {
    assert.equal(await verifyRoleCookie(value, USER, SECRET, NOW), null, String(value))
  }
})
