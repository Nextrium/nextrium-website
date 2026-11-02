export const ROLE_COOKIE = 'nextrium-role'
// 30s: short enough that a role change (e.g. promoting/demoting someone in
// Team Access) takes effect on their next couple of page loads instead of
// up to 5 minutes, while still absorbing the request-per-poll load this
// cache exists for in the first place.
export const ROLE_COOKIE_MAX_AGE = 30

const MIN_SECRET_LENGTH = 32
const VALID_ROLES = new Set(['admin', 'moderator', 'content', 'community', 'member', 'archived'])

export interface CachedRole {
  role: string
  onboarded: boolean
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function usableSecret(secret: string | undefined): secret is string {
  return !!secret && secret.length >= MIN_SECRET_LENGTH
}

/**
 * Cookie value is "<userId>:<role>:<onboarded 0|1>:<expiry>:<signature>".
 * The expiry is inside the signature because the cookie's maxAge is only
 * enforced by the browser. Returns null with no usable secret, so nothing is
 * cached and every request looks the role up instead.
 */
export async function signRoleCookie(
  value: { userId: string; role: string; onboarded: boolean },
  secret: string | undefined,
  now = Date.now(),
): Promise<string | null> {
  if (!usableSecret(secret)) return null
  const expiresAt = Math.floor(now / 1000) + ROLE_COOKIE_MAX_AGE
  const payload = `${value.userId}:${value.role}:${value.onboarded ? '1' : '0'}:${expiresAt}`
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(payload))
  return `${payload}:${Buffer.from(signature).toString('base64url')}`
}

/**
 * The cached role, or null when the cookie can't be trusted: unsigned,
 * altered, expired, for another account, or no usable secret. Callers treat
 * null as "no cache" and look the role up. Binding it to the signed-in user id
 * means a different account signing in on the same browser can never inherit
 * a role left over from whoever used it before.
 */
export async function verifyRoleCookie(
  cookie: string | undefined,
  userId: string,
  secret: string | undefined,
  now = Date.now(),
): Promise<CachedRole | null> {
  if (!cookie || !usableSecret(secret)) return null
  const parts = cookie.split(':')
  if (parts.length !== 5) return null
  const [cookieUserId, role, onboarded, expiresAt, signature] = parts
  if (cookieUserId !== userId || !VALID_ROLES.has(role)) return null
  if (onboarded !== '0' && onboarded !== '1') return null
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= Math.floor(now / 1000)) return null

  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    Buffer.from(signature, 'base64url'),
    new TextEncoder().encode(`${cookieUserId}:${role}:${onboarded}:${expiresAt}`),
  )
  return valid ? { role, onboarded: onboarded === '1' } : null
}
