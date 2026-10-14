import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const STATE_COOKIE = 'nx-discord-state'
export const STATE_TTL_MS = 10 * 60 * 1000
// Identity only. Linking never adds anyone to the Discord server.
export const DISCORD_SCOPE = 'identify'

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize'
const TOKEN_URL = 'https://discord.com/api/oauth2/token'
const ME_URL = 'https://discord.com/api/users/@me'
const REQUEST_TIMEOUT_MS = 10_000

export interface DiscordConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** Null when the Discord application isn't configured; callers then do nothing. */
export function readDiscordConfig(env: Record<string, string | undefined> = process.env): DiscordConfig | null {
  const clientId = env.DISCORD_CLIENT_ID
  const clientSecret = env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const site = (env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nextrium.org').replace(/\/+$/, '')
  return { clientId, clientSecret, redirectUri: env.DISCORD_REDIRECT_URI || `${site}/api/discord/callback` }
}

// Accounts with a live dashboard role. No-role and archived accounts can't link.
export function canLinkDiscord(role: string): boolean {
  return ['admin', 'moderator', 'content', 'community', 'member'].includes(role)
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(`discord-state:${payload}`).digest('base64url')
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** A one-time value sent to Discord, plus a signed cookie binding it to this user. */
export function createState(userId: string, secret: string, now = Date.now()): { state: string; cookie: string } {
  const state = randomBytes(24).toString('base64url')
  const payload = `${state}.${userId}.${now + STATE_TTL_MS}`
  return { state, cookie: `${payload}.${sign(secret, payload)}` }
}

export function verifyState(
  cookie: string | undefined | null,
  stateParam: string | null | undefined,
  userId: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!cookie || !stateParam) return false
  const parts = cookie.split('.')
  if (parts.length !== 4) return false
  const [state, cookieUser, expiry, signature] = parts
  if (!equal(signature, sign(secret, `${state}.${cookieUser}.${expiry}`))) return false
  if (!equal(state, stateParam)) return false
  if (!equal(cookieUser, userId)) return false
  return Number(expiry) > now
}

export function buildAuthorizeUrl(config: DiscordConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: DISCORD_SCOPE,
    state,
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export type LinkResult =
  | { ok: true; discordUserId: string; username: string }
  | { ok: false; reason: 'token_exchange_failed' | 'profile_fetch_failed' | 'invalid_profile' | 'network_error' }

/**
 * Exchanges the authorization code and reads the member's Discord identity.
 * The access token is used for this one lookup and then dropped; nothing is stored.
 */
export async function fetchDiscordIdentity(
  fetchFn: typeof fetch,
  config: DiscordConfig,
  code: string,
): Promise<LinkResult> {
  try {
    const tokenRes = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!tokenRes.ok) return { ok: false, reason: 'token_exchange_failed' }
    const token = await tokenRes.json().catch(() => null)
    const accessToken = token?.access_token
    if (typeof accessToken !== 'string' || !accessToken) return { ok: false, reason: 'token_exchange_failed' }

    const meRes = await fetchFn(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!meRes.ok) return { ok: false, reason: 'profile_fetch_failed' }
    const me = await meRes.json().catch(() => null)

    // Discord user ids are numeric strings; anything else is not a real profile.
    if (typeof me?.id !== 'string' || !/^\d{15,25}$/.test(me.id) || typeof me?.username !== 'string' || !me.username) {
      return { ok: false, reason: 'invalid_profile' }
    }
    return { ok: true, discordUserId: me.id, username: me.username.slice(0, 64) }
  } catch {
    return { ok: false, reason: 'network_error' }
  }
}
