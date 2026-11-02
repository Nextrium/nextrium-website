import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { hashEmail, isReportId, signSession, verifySession, SESSION_TTL_MS, MAX_CODE_ATTEMPTS, MAX_CODES_PER_EMAIL_WINDOW } from './reportAccess'
import { issueCode, redeemCode, type CodeStore } from './reportAccessFlow'

process.env.REPORT_SESSION_SECRET = 'x'.repeat(32)

const EMAIL = 'applicant@example.com'
type Row = { id: string; email_hash: string; ip_hash: string; code_hash: string; sent: boolean; expires_at: string; attempts: number; used_at: string | null; created: number }
let rows: Row[]
let delivered: { email: string; code: string }[]

const store: CodeStore = {
  async countByEmailSince(hash) { return rows.filter((r) => r.email_hash === hash).length },
  async countByIpSince(hash) { return rows.filter((r) => r.ip_hash === hash).length },
  async insert(row) { const id = String(rows.length + 1); rows.push({ ...row, id, attempts: 0, used_at: null, created: rows.length }); return id },
  async markSent(id) { rows.find((r) => r.id === id)!.sent = true },
  async findUsable(hash, nowIso) {
    return rows.filter((r) => r.email_hash === hash && r.sent && !r.used_at && r.expires_at > nowIso).sort((a, b) => b.created - a.created)[0] ?? null
  },
  async bumpAttempts(id, expected) { const r = rows.find((x) => x.id === id)!; if (r.attempts !== expected) return false; r.attempts++; return true },
  async markUsed(id) { const r = rows.find((x) => x.id === id)!; if (r.used_at) return false; r.used_at = 'now'; return true },
}

const deps = (archived = false) => ({
  store,
  lookup: async (reportId: string) => (reportId === 'NXT-2026-0001' ? { email: EMAIL, archived } : null),
  deliver: async (email: string, code: string) => { delivered.push({ email, code }); return true },
})
const issue = async (email = EMAIL, reportId = 'NXT-2026-0001', archived = false) => {
  const result = await issueCode(deps(archived), { reportId, email, ipHash: 'ip' })
  if (result.status === 'accepted') await result.pending?.()
  return result
}

beforeEach(() => { rows = []; delivered = [] })

test('the applicant gets a code, and it opens a session once', async () => {
  await issue(' Applicant@Example.com ')
  assert.equal(delivered.length, 1)
  const { code } = delivered[0]
  assert.deepEqual(await redeemCode({ store }, { email: EMAIL, code }), { ok: true, emailHash: hashEmail(EMAIL) })
  assert.deepEqual(await redeemCode({ store }, { email: EMAIL, code }), { ok: false })
})

test('nobody else gets a code, and the reply looks the same', async () => {
  const cases = [await issue('other@example.com'), await issue(EMAIL, 'NXT-2026-9999'), await issue(EMAIL, 'NXT-2026-0001', true)]
  assert.equal(delivered.length, 0)
  for (const result of cases) assert.equal(result.status, 'accepted')
})

test('a code only works for the address it was sent to', async () => {
  await issue()
  assert.deepEqual(await redeemCode({ store }, { email: 'other@example.com', code: delivered[0].code }), { ok: false })
})

test('wrong guesses are limited, even with the right code afterwards', async () => {
  await issue()
  const wrong = delivered[0].code === '000000' ? '000001' : '000000'
  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) assert.deepEqual(await redeemCode({ store }, { email: EMAIL, code: wrong }), { ok: false })
  assert.deepEqual(await redeemCode({ store }, { email: EMAIL, code: delivered[0].code }), { ok: false })
})

test('expired codes and malformed input are refused', async () => {
  await issue()
  const later = Date.now() + 11 * 60 * 1000
  assert.deepEqual(await redeemCode({ store, now: later }, { email: EMAIL, code: delivered[0].code }), { ok: false })
  assert.deepEqual(await redeemCode({ store }, { email: EMAIL, code: 'abc' }), { ok: false })
  assert.deepEqual(await redeemCode({ store }, { email: 'nope', code: '123456' }), { ok: false })
  assert.deepEqual(await issueCode(deps(), { reportId: 'NXT-2026-0001', email: 'nope', ipHash: 'ip' }), { status: 'invalid_email' })
})

test('code requests are limited per address', async () => {
  for (let i = 0; i < MAX_CODES_PER_EMAIL_WINDOW + 2; i++) await issue()
  assert.equal(delivered.length, MAX_CODES_PER_EMAIL_WINDOW)
})

test('sessions expire and can not be altered', () => {
  const now = 1_800_000_000_000
  const { token } = signSession('hash', now)
  assert.deepEqual(verifySession(token, now), { emailHash: 'hash' })
  assert.equal(verifySession(token, now + SESSION_TTL_MS), null)
  assert.equal(verifySession(`${token}x`, now), null)
  assert.equal(verifySession(`${Buffer.from(JSON.stringify({ eh: 'other', exp: now + 1000 })).toString('base64url')}.${token.split('.')[1]}`, now), null)
  for (const bad of [undefined, null, '', 'a', 'a.b.c']) assert.equal(verifySession(bad, now), null)
})

test('report ids are checked before use', () => {
  assert.equal(isReportId('NXT-2026-1234'), true)
  for (const bad of ['', 'a', '../x', 'NXT/2026', 'a'.repeat(41), null, 5]) assert.equal(isReportId(bad), false, String(bad))
})
