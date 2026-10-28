import { createHmac, timingSafeEqual } from 'node:crypto'

// The contributor portal tells the dashboard about events that need staff
// (work ready to review, an extension request). Each request is signed with a
// secret only the two servers hold: HMAC-SHA256 of "<timestamp>.<raw body>".
// The dashboard refuses anything unsigned, altered, signed with another secret,
// or more than five minutes old (or from the future), so a captured request
// can't be replayed later. Alerts are also de-duplicated by key on the
// dashboard, so a replay inside the window still sends nothing new.

export const ALERT_MAX_AGE_SECONDS = 300
export const ALERT_EVENTS = ['submission', 'extension'] as const
export type AlertEvent = (typeof ALERT_EVENTS)[number]

export function signAlert(rawBody: string, timestamp: number, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
}

export type AlertCheck = { ok: true; event: AlertEvent; id: string } | { ok: false; reason: string }

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Checks a signed alert request and returns the event it names. */
export function verifyAlert(rawBody: string, timestampHeader: string | null, signatureHeader: string | null, secret: string | undefined, nowSeconds: number = Math.floor(Date.now() / 1000)): AlertCheck {
  if (!secret || secret.length < 32) return { ok: false, reason: 'not configured' }
  if (!timestampHeader || !/^\d{9,11}$/.test(timestampHeader) || !signatureHeader) return { ok: false, reason: 'unsigned' }
  const ts = Number(timestampHeader)
  if (Math.abs(nowSeconds - ts) > ALERT_MAX_AGE_SECONDS) return { ok: false, reason: 'stale' }
  const expected = Buffer.from(signAlert(rawBody, ts, secret))
  const given = Buffer.from(signatureHeader)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'bad signature' }
  let body: unknown
  try { body = JSON.parse(rawBody) } catch { return { ok: false, reason: 'bad body' } }
  const b = body as { event?: unknown; id?: unknown }
  if (typeof b?.event !== 'string' || !(ALERT_EVENTS as readonly string[]).includes(b.event)) return { ok: false, reason: 'bad event' }
  if (typeof b.id !== 'string' || !ID.test(b.id)) return { ok: false, reason: 'bad id' }
  return { ok: true, event: b.event as AlertEvent, id: b.id.toLowerCase() }
}
