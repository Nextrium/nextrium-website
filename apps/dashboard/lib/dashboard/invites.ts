import { createHash, randomBytes } from 'node:crypto'

// Dashboard invitation links. Supabase's own links last at most 24 hours, so
// the dashboard issues its own: a random token emailed once, valid for 5 days,
// single use, and cancelled when a newer one is sent. Only a SHA-256 hash of
// the token is stored, so a database leak can't be turned into working links.
// Opening the link shows a page; only pressing "Accept" uses it, so email
// scanners that open links can't spend it.

export const INVITE_TTL_DAYS = 5
const TOKEN_BYTES = 32
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

export type InviteState = 'valid' | 'expired' | 'used' | 'revoked' | 'missing'

export interface InviteRow {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, hash: hashToken(token)! }
}

/** The stored fingerprint of a token, or null when it isn't shaped like one of ours. */
export function hashToken(token: unknown): string | null {
  if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return null
  return createHash('sha256').update(token).digest('hex')
}

export function inviteExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString()
}

export function inviteState(row: InviteRow | null, now: Date = new Date()): InviteState {
  if (!row) return 'missing'
  if (row.revoked_at) return 'revoked'
  if (row.used_at) return 'used'
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired'
  return 'valid'
}

/** What the person sees for each state. Nothing here says who the link was for. */
export const INVITE_STATE_MESSAGES: Record<Exclude<InviteState, 'valid'>, string> = {
  expired: 'This invitation has expired. Ask the person who invited you to send a new one.',
  used: 'This invitation has already been used. Sign in with your email and password instead.',
  revoked: 'A newer invitation was sent for this account. Use the link in the most recent email.',
  missing: 'This invitation link is not valid. Check that you copied the whole link from the email.',
}

/**
 * Issues a new invitation for a person: earlier unused ones are cancelled, so
 * only the newest email works. Returns the token to put in the email link.
 */
export async function issueInvite(db: any, userId: string, createdBy: string | null, now: Date = new Date()): Promise<{ token: string; expiresAt: string }> {
  const at = now.toISOString()
  const { error: revokeError } = await db.from('dashboard_invites').update({ revoked_at: at })
    .eq('user_id', userId).is('used_at', null).is('revoked_at', null)
  if (revokeError) throw new Error('Could not replace the earlier invitation.')
  const { token, hash } = newInviteToken()
  const expiresAt = inviteExpiry(now)
  const { error } = await db.from('dashboard_invites').insert({ user_id: userId, token_hash: hash, expires_at: expiresAt, created_by: createdBy })
  if (error) throw new Error('Could not create the invitation.')
  return { token, expiresAt }
}

/** Looks up a token. Bad or unknown tokens are simply 'missing'. */
export async function findInvite(db: any, token: unknown, now: Date = new Date()): Promise<{ state: InviteState; invite: InviteRow | null }> {
  const hash = hashToken(token)
  if (!hash) return { state: 'missing', invite: null }
  const { data } = await db.from('dashboard_invites').select('id, user_id, token_hash, expires_at, used_at, revoked_at').eq('token_hash', hash).maybeSingle()
  return { state: inviteState(data ?? null, now), invite: data ?? null }
}

export type AcceptResult =
  | { ok: true; userId: string }
  | { ok: false; reason: Exclude<InviteState, 'valid'> | 'no_access' | 'sign_in_failed' }

/**
 * Accepts an invitation: checks it, uses it up (so a double click or a second
 * tab can't use it twice), then signs the person in. If signing in fails the
 * link is restored so they can try again.
 */
export async function acceptInvite(
  db: any,
  token: unknown,
  signIn: (userId: string) => Promise<boolean>,
  now: Date = new Date(),
): Promise<AcceptResult> {
  const { state, invite } = await findInvite(db, token, now)
  if (state !== 'valid' || !invite) return { ok: false, reason: state === 'valid' ? 'missing' : state }

  const { data: person } = await db.from('dashboard_users').select('archived').eq('user_id', invite.user_id).maybeSingle()
  if (!person || person.archived) return { ok: false, reason: 'no_access' }

  const at = now.toISOString()
  const { data: claimed } = await db.from('dashboard_invites').update({ used_at: at })
    .eq('id', invite.id).is('used_at', null).is('revoked_at', null).select('id')
  if (!claimed || claimed.length === 0) return { ok: false, reason: 'used' }

  let signedIn = false
  try { signedIn = await signIn(invite.user_id) } catch { signedIn = false }
  if (!signedIn) {
    await db.from('dashboard_invites').update({ used_at: null }).eq('id', invite.id).eq('used_at', at)
    return { ok: false, reason: 'sign_in_failed' }
  }
  return { ok: true, userId: invite.user_id }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

/** The invitation email body (inside the shared branded wrapper). */
export function inviteEmail(p: { url: string; name?: string | null; teamName: string; expiresAt: string }): { subject: string; message: string } {
  const until = new Date(p.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const hello = p.name?.trim() ? `Hello ${escapeHtml(p.name.trim())},` : 'Hello,'
  return {
    subject: `You're invited to the ${p.teamName} dashboard`,
    message: [
      `<p>${hello}</p>`,
      `<p>You've been invited to the ${escapeHtml(p.teamName)} dashboard. Open the link below, accept the invitation, choose a password and complete your profile.</p>`,
      `<p><a href="${escapeHtml(p.url)}">Accept your invitation</a></p>`,
      `<p>The link works once and expires on ${until}. If it expires, ask the person who invited you to send a new one.</p>`,
      `<p>If you weren't expecting this, you can ignore this email.</p>`,
    ].join('\n'),
  }
}
