import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifyAlert } from '@nextrium/contributions-core/alertSignature'
import { ALERT_SIGNATURE_HEADER, ALERT_TIMESTAMP_HEADER, alertStaff } from './staffAlert'

const SECRET = 's'.repeat(40)
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'

function recorder(status = 200) {
  const calls: { url: string; init: RequestInit }[] = []
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(null, { status }) }) as unknown as typeof fetch
  return { calls, f }
}

test('signs a request the dashboard accepts', async () => {
  const r = recorder()
  assert.equal(await alertStaff('submission', ID, { secret: SECRET, dashboardUrl: 'https://dash.test/' }, r.f, () => 1_800_000_000), true)
  const { url, init } = r.calls[0]
  assert.equal(url, 'https://dash.test/api/alerts/portal')
  const h = init.headers as Record<string, string>
  const check = verifyAlert(init.body as string, h[ALERT_TIMESTAMP_HEADER], h[ALERT_SIGNATURE_HEADER], SECRET, 1_800_000_000)
  assert.deepEqual(check, { ok: true, event: 'submission', id: ID })
  assert.equal(verifyAlert(init.body as string, h[ALERT_TIMESTAMP_HEADER], h[ALERT_SIGNATURE_HEADER], 'x'.repeat(40), 1_800_000_000).ok, false, 'another secret is refused')
})

test('without a secret, sends nothing', async () => {
  const r = recorder()
  assert.equal(await alertStaff('extension', ID, { secret: '' }, r.f), false)
  assert.equal(r.calls.length, 0)
})

test('a refusal or an unreachable dashboard returns false and never throws', async () => {
  assert.equal(await alertStaff('submission', ID, { secret: SECRET }, recorder(401).f), false)
  const boom = (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
  assert.equal(await alertStaff('submission', ID, { secret: SECRET }, boom), false)
})
