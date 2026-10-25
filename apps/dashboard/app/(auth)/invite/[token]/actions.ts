'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@nextrium/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { INVITE_STATE_MESSAGES, acceptInvite } from '@/lib/dashboard/invites'

const FAILED = 'We could not sign you in just now. Try the button again in a minute.'
const NO_ACCESS = 'This account no longer has dashboard access. Contact an administrator.'

/**
 * Signs the invited person in with a one-time Supabase token minted on the
 * server for exactly this account, and sets the session cookies. An account
 * that never confirmed uses the invite type (which confirms it); one that did
 * uses a magic link. The other type is tried if the first is refused.
 */
async function signInAs(userId: string): Promise<boolean> {
  const admin = createServiceClient()
  const { data: found } = await admin.auth.admin.getUserById(userId)
  const user = found?.user
  if (!user?.email) return false
  const email = user.email
  const order: ('invite' | 'magiclink')[] = user.email_confirmed_at ? ['magiclink', 'invite'] : ['invite', 'magiclink']
  const session = await createClient()
  for (const type of order) {
    const { data, error } = await admin.auth.admin.generateLink({ type, email } as any)
    const hashed = (data as any)?.properties?.hashed_token
    if (error || !hashed) continue
    const { error: verifyError } = await session.auth.verifyOtp({ token_hash: hashed, type })
    if (!verifyError) return true
  }
  return false
}

export async function acceptInvitation(token: string): Promise<{ error: string }> {
  const result = await acceptInvite(createServiceClient(), token, signInAs)
  if (!result.ok) {
    if (result.reason === 'sign_in_failed') return { error: FAILED }
    if (result.reason === 'no_access') return { error: NO_ACCESS }
    return { error: INVITE_STATE_MESSAGES[result.reason] }
  }
  logActivity({ action: 'team_invite_accepted', targetType: 'dashboard_user', targetId: result.userId, actorId: result.userId }).catch(() => {})
  redirect('/set-password')
}
