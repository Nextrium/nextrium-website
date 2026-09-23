import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'

export const CODE_TTL_MS = 10 * 60 * 1000
export const SESSION_TTL_MS = 60 * 60 * 1000
export const MAX_CODE_ATTEMPTS = 5
export const CODE_WINDOW_MS = 15 * 60 * 1000
export const MAX_CODES_PER_EMAIL_WINDOW = 3
export const IP_WINDOW_MS = 60 * 60 * 1000
export const MAX_REQUESTS_PER_IP_WINDOW = 10

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function secret(): string {
  const value = process.env.REPORT_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('REPORT_SESSION_SECRET is not configured')
  return value
}

// A code is bound to the email it was issued for.
export function hashCode(emailHash: string, code: string): string {
  return createHmac('sha256', secret()).update(`code:${emailHash}:${code}`).digest('hex')
}

export function hashIp(ip: string): string {
  return createHmac('sha256', secret()).update(`ip:${ip}`).digest('hex')
}

export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sessionSignature(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(`session:${payload}`).digest())
}

/** Signed, self-expiring token proving control of one email address. */
export function signSession(emailHash: string, now = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + SESSION_TTL_MS
  const payload = b64url(JSON.stringify({ eh: emailHash, exp: expiresAt }))
  return { token: `${payload}.${sessionSignature(payload)}`, expiresAt }
}

/** Returns the verified email hash, or null for anything invalid, tampered or expired. */
export function verifySession(token: string | undefined | null, now = Date.now()): { emailHash: string } | null {
  try {
    if (!token) return null
    const [payload, signature, ...rest] = token.split('.')
    if (!payload || !signature || rest.length > 0) return null
    if (!safeEqualHex(Buffer.from(signature).toString('hex'), Buffer.from(sessionSignature(payload)).toString('hex'))) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof data?.eh !== 'string' || typeof data?.exp !== 'number' || data.exp <= now) return null
    return { emailHash: data.eh }
  } catch {
    return null
  }
}
