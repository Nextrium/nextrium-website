import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALERT_MAX_AGE_SECONDS, signAlert, verifyAlert } from './alertSignature'

const SECRET = 'x'.repeat(40)
const NOW = 1_800_000_000
const ID = '00000000-0000-4000-8000-000000000001'
const body = JSON.stringify({ event: 'submission', id: ID })
const sign = (b = body, ts = NOW, s = SECRET) => signAlert(b, ts, s)

test('a correctly signed, fresh request is accepted', () => {
  assert.deepEqual(verifyAlert(body, String(NOW), sign(), SECRET, NOW), { ok: true, event: 'submission', id: ID })
  const ext = JSON.stringify({ event: 'extension', id: ID.toUpperCase() })
  assert.deepEqual(verifyAlert(ext, String(NOW), sign(ext), SECRET, NOW), { ok: true, event: 'extension', id: ID })
})

test('unsigned, missing timestamp or missing/short secret → refused', () => {
  assert.equal(verifyAlert(body, null, sign(), SECRET, NOW).ok, false)
  assert.equal(verifyAlert(body, String(NOW), null, SECRET, NOW).ok, false)
  assert.equal(verifyAlert(body, String(NOW), sign(), undefined, NOW).ok, false)
  assert.equal(verifyAlert(body, String(NOW), sign(body, NOW, 'short'), 'short', NOW).ok, false, 'a weak secret is refused')
  assert.equal(verifyAlert(body, 'abc', sign(), SECRET, NOW).ok, false)
})

test('altered body, other secret or other timestamp → refused', () => {
  const altered = JSON.stringify({ event: 'submission', id: '00000000-0000-4000-8000-000000000002' })
  assert.deepEqual(verifyAlert(altered, String(NOW), sign(), SECRET, NOW), { ok: false, reason: 'bad signature' })
  assert.deepEqual(verifyAlert(body, String(NOW), sign(body, NOW, 'y'.repeat(40)), SECRET, NOW), { ok: false, reason: 'bad signature' })
  assert.deepEqual(verifyAlert(body, String(NOW + 1), sign(), SECRET, NOW), { ok: false, reason: 'bad signature' }, 'signature covers the timestamp')
})

test('older than 5 minutes or from the future → refused (no replays)', () => {
  const old = NOW - ALERT_MAX_AGE_SECONDS - 1
  assert.deepEqual(verifyAlert(body, String(old), sign(body, old), SECRET, NOW), { ok: false, reason: 'stale' })
  const future = NOW + ALERT_MAX_AGE_SECONDS + 1
  assert.deepEqual(verifyAlert(body, String(future), sign(body, future), SECRET, NOW), { ok: false, reason: 'stale' })
  const edge = NOW - ALERT_MAX_AGE_SECONDS
  assert.equal(verifyAlert(body, String(edge), sign(body, edge), SECRET, NOW).ok, true, 'exactly at the limit is fine')
})

test('properly signed but unknown event, bad id or not JSON → refused', () => {
  for (const b of [JSON.stringify({ event: 'delete_everything', id: ID }), JSON.stringify({ event: 'submission', id: 'x' }), JSON.stringify({ event: 'submission' }), 'not json', JSON.stringify(null)]) {
    assert.equal(verifyAlert(b, String(NOW), sign(b), SECRET, NOW).ok, false, b)
  }
})
