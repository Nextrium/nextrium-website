import { createServiceClient } from '@nextrium/supabase/server'
import { linkApplicationAndTrack, type TrackOutcome } from './tracks'

/** True when the auth server refused an invite because the email already has an account. */
export function isEmailAlreadyRegistered(json: any): boolean {
  return json?.error_code === 'email_exists'
    || /already been registered/i.test(String(json?.msg ?? json?.message ?? ''))
}

export interface AuthAccount { id: string; email?: string | null; email_confirmed_at?: string | null; last_sign_in_at?: string | null }

/** Finds an existing account by email. Fine at this team size: it scans the user list. */
export async function findAuthUserByEmail(email: string, service: any = createServiceClient()): Promise<AuthAccount | null> {
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users) return null
    const hit = data.users.find((u: AuthAccount) => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < 1000) return null
  }
  return null
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  return (await findAuthUserByEmail(email))?.id ?? null
}

/** Someone who has opened their invitation (or signed in) at least once. */
export function hasAccepted(account: AuthAccount): boolean {
  return !!(account.email_confirmed_at || account.last_sign_in_at)
}

export type GrantResult =
  | { status: 'created' }
  | { status: 'exists'; role: string; becameMember: boolean }
  | { status: 'archived' }

/**
 * Gives an existing account dashboard access. An account that already has a
 * dashboard row keeps its current role: being a team member (able to log
 * contributions) is a separate flag that sits alongside any role, so a
 * moderator or admin can be both. Never adds a second row for a person: the
 * database refuses one (unique user_id), and a row added meanwhile is
 * treated as already there.
 */
export async function grantDashboardAccess(
  userId: string,
  role: string,
  applicationId?: string,
  asTeamMember = false,
  service: any = createServiceClient(),
): Promise<GrantResult> {
  const read = async () => {
    const { data, error } = await service.from('dashboard_users').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw new Error('Could not read this person\'s dashboard access.')
    return data
  }
  const update = async (existing: any): Promise<GrantResult> => {
    if (existing.archived) return { status: 'archived' }
    const patch: Record<string, unknown> = {}
    if (applicationId && !existing.application_id) patch.application_id = applicationId
    const becameMember = asTeamMember && !existing.is_team_member
    if (becameMember) patch.is_team_member = true
    if (Object.keys(patch).length > 0) {
      const { error } = await service.from('dashboard_users')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId)
      if (error) throw new Error(error.message)
    }
    return { status: 'exists', role: existing.role, becameMember }
  }

  const existing = await read()
  if (existing) return update(existing)

  const { error } = await service.from('dashboard_users').insert({
    user_id: userId,
    role,
    is_team_member: asTeamMember || role === 'member',
    ...(applicationId ? { application_id: applicationId } : {}),
  })
  if (error) {
    // Added by another request a moment ago: use that row instead.
    if (error.code === '23505') {
      const now = await read()
      if (now) return update(now)
    }
    throw new Error(error.message)
  }
  return { status: 'created' }
}

export interface InviteDeps {
  db: any
  /**
   * Creates the sign-in account without sending Supabase's own email (its
   * links last at most 24 hours); `exists` when the email already has one.
   */
  createAccount: (email: string, role: string) => Promise<{ ok: true; id: string } | { ok: false; exists: boolean; message: string }>
  /** Issues a 5-day invitation link and emails it. False when the email could not be sent. */
  deliver: (userId: string, email: string) => Promise<boolean>
}

export type InviteOutcome =
  | { kind: 'invited'; userId: string; emailed: boolean; tracks: TrackOutcome }
  | { kind: 'reinvited'; userId: string; role: string; tracks: TrackOutcome }
  | { kind: 'added_existing'; userId: string; tracks: TrackOutcome }
  | { kind: 'already'; userId: string; role: string; becameMember: boolean; tracks: TrackOutcome }
  | { kind: 'archived'; userId: string }
  | { kind: 'error'; message: string }

/** Supabase admin call that creates an invited (unconfirmed) account without emailing it. */
export function supabaseCreateAccount(service: any) {
  return async (email: string, role: string): Promise<{ ok: true; id: string } | { ok: false; exists: boolean; message: string }> => {
    try {
      const { data, error } = await service.auth.admin.generateLink({ type: 'invite', email, options: { data: { role } } })
      if (data?.user?.id) return { ok: true, id: data.user.id }
      if (error && isEmailAlreadyRegistered({ msg: error.message, error_code: (error as any).code })) return { ok: false, exists: true, message: 'exists' }
      return { ok: false, exists: false, message: 'The account could not be created. Try again in a minute.' }
    } catch {
      return { ok: false, exists: false, message: 'The account could not be created. Try again in a minute.' }
    }
  }
}

/**
 * Invites someone to the dashboard, or gives an existing account access,
 * without ever adding a second row for the same person:
 * - archived: refused, and no email is sent;
 * - invited before but not yet accepted: a new 5-day link is sent (the old one stops working);
 * - already has access: left as is (or made a team member when asked);
 * - has an account but no access: given access, no email;
 * - new: account created and a 5-day invitation emailed.
 * Afterwards their application is linked and their track set, where empty.
 */
export async function inviteAccount(
  input: { email: string; role: string; applicationId?: string; asTeamMember: boolean },
  deps: InviteDeps,
): Promise<InviteOutcome> {
  const email = input.email.trim().toLowerCase()
  if (!email.includes('@')) return { kind: 'error', message: 'Enter a valid email address.' }
  const finish = async (userId: string) => linkApplicationAndTrack(deps.db, userId, email)

  const existingAccess = async (id: string): Promise<InviteOutcome> => {
    const grant = await grantDashboardAccess(id, input.role, input.applicationId, input.asTeamMember, deps.db)
    if (grant.status === 'archived') return { kind: 'archived', userId: id }
    const tracks = await finish(id)
    return grant.status === 'exists'
      ? { kind: 'already', userId: id, role: grant.role, becameMember: grant.becameMember, tracks }
      : { kind: 'added_existing', userId: id, tracks }
  }

  const account = await findAuthUserByEmail(email, deps.db)
  if (account) {
    const { data: row, error } = await deps.db.from('dashboard_users').select('role, archived').eq('user_id', account.id).maybeSingle()
    if (error) return { kind: 'error', message: "Could not read this person's dashboard access." }
    if (row?.archived) return { kind: 'archived', userId: account.id }
    if (row && !hasAccepted(account)) {
      // They never accepted: send a fresh link (same account, same row).
      const grant = await grantDashboardAccess(account.id, input.role, input.applicationId, input.asTeamMember, deps.db)
      if (grant.status === 'archived') return { kind: 'archived', userId: account.id }
      if (!(await deps.deliver(account.id, email))) return { kind: 'error', message: 'The invitation email could not be sent. Try again in a minute.' }
      return { kind: 'reinvited', userId: account.id, role: grant.status === 'exists' ? grant.role : input.role, tracks: await finish(account.id) }
    }
    return existingAccess(account.id)
  }

  const created = await deps.createAccount(email, input.role)
  if (!created.ok) {
    if (!created.exists) return { kind: 'error', message: created.message }
    // Created a moment ago by someone else: treat it as an existing account.
    const now = await findAuthUserByEmail(email, deps.db)
    if (!now) return { kind: 'error', message: 'This email already has an account that could not be found. Please try again.' }
    return existingAccess(now.id)
  }
  const grant = await grantDashboardAccess(created.id, input.role, input.applicationId, input.asTeamMember, deps.db)
  if (grant.status === 'archived') return { kind: 'archived', userId: created.id }
  const emailed = await deps.deliver(created.id, email)
  return { kind: 'invited', userId: created.id, emailed, tracks: await finish(created.id) }
}
