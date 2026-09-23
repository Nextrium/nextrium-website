'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activityLog'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { findAuthUserIdByEmail, grantDashboardAccess, isEmailAlreadyRegistered } from '@/lib/dashboard/teamAccounts'
import { ACCESS_REVOKED, ACCESS_SYNC, emitAutomationEvent, supersedeSuccesses } from '@/lib/automation/server'

// Every action here manages who can access the dashboard, so all of them are
// admin-only, checked inside the action with a verified identity (the page's
// middleware gate alone is not enough — server actions can be called
// outside the page that renders them).
const VALID_ROLES = ['admin', 'content', 'community', 'moderator', 'member']
const NOT_ALLOWED = 'You do not have permission to do this.'

async function requireAdmin(): Promise<{ userId: string } | null> {
  const me = await getVerifiedIdentity()
  return me && me.role === 'admin' ? { userId: me.userId } : null
}

export interface InvitedUserRow {
  user_id: string
  role: string
  created_at: string
  email: string
  archived: boolean
  archived_at: string | null
  is_team_member: boolean
}

export async function inviteUser(
  email: string,
  role: string
): Promise<{ error?: string; notice?: string; added?: InvitedUserRow; teamMemberSet?: string }> {
  try {
    if (!(await requireAdmin())) return { error: NOT_ALLOWED }
    if (!VALID_ROLES.includes(role)) return { error: 'Invalid role.' }
    email = (email ?? '').trim().toLowerCase()
    if (!email.includes('@')) return { error: 'Enter a valid email address.' }

    const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseSecret = process.env.SUPABASE_SECRET_KEY!
    const siteUrl        = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.nextrium.org'

    const redirectTo = `${siteUrl}/auth/callback`

    const res = await fetch(`${supabaseUrl}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        supabaseSecret,
        'Authorization': `Bearer ${supabaseSecret}`,
      },
      body: JSON.stringify({
        email,
        data: { role },
        redirect_to: redirectTo,
      }),
    })

    const rawText = await res.text()

    let json: any = {}
    try {
      json = JSON.parse(rawText)
    } catch {
      throw new Error(`Supabase returned unexpected response (${res.status}): ${rawText.slice(0, 200)}`)
    }

    let userId: string
    let notice: string | undefined

    if (!res.ok) {
      if (!isEmailAlreadyRegistered(json)) {
        throw new Error(json.message ?? json.error_description ?? json.msg ?? 'Failed to invite user.')
      }
      // The email already has an account: give that account dashboard access
      // directly instead of refusing. No invitation email is sent.
      const existingId = await findAuthUserIdByEmail(email)
      if (!existingId) throw new Error('This email already has an account that could not be found. Please try again.')
      const grant = await grantDashboardAccess(existingId, role, undefined, role === 'member')
      if (grant.status === 'exists') {
        // Choosing Member for someone who already has a role adds team
        // membership on top of it; their access level does not change.
        if (role === 'member') {
          return {
            notice: grant.becameMember
              ? `${email} keeps their ${grant.role} access and is now also a team member. No invitation email was sent.`
              : `${email} is already a team member.`,
            teamMemberSet: existingId,
          }
        }
        return { error: `This person already has dashboard access as ${grant.role}. Change their role from the list below.` }
      }
      if (grant.status === 'archived') {
        return { error: 'This person has an archived account. Unarchive it from the list below instead.' }
      }
      userId = existingId
      notice = `${email} already had an account, so they were added as ${role} directly. No invitation email was sent.`
    } else {
      if (!json.id) throw new Error('Invite succeeded but no user ID was returned.')
      userId = json.id
      const supabase = createServiceClient()
      const { error: insertError } = await (supabase.from('dashboard_users') as any).insert({
        user_id: userId,
        role,
        is_team_member: role === 'member',
      })
      if (insertError) throw new Error(insertError.message)
    }

    revalidatePath('/dashboard/settings/team')
    logActivity({
      action: 'team_user_invited',
      targetType: 'dashboard_user',
      targetId: userId,
      details: { email, role, existingAccount: !!notice },
    }).catch(() => {})
    return {
      notice,
      added: {
        user_id: userId, role, created_at: new Date().toISOString(), email,
        archived: false, archived_at: null, is_team_member: role === 'member',
      },
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite user.' }
  }
}

// Team membership (able to log contributions) is separate from the access
// role, so admins and moderators can be team members too.
export async function setTeamMember(userId: string, isMember: boolean): Promise<{ error?: string }> {
  try {
    if (!(await requireAdmin())) return { error: NOT_ALLOWED }

    const supabase = createServiceClient()
    const { data: row } = await (supabase.from('dashboard_users') as any)
      .select('role').eq('user_id', userId).maybeSingle()
    if (!row) return { error: 'User not found.' }
    if (!isMember && row.role === 'member') {
      return { error: 'Their role is Member, so they are a team member by definition. Change their role first.' }
    }

    const { error } = await (supabase.from('dashboard_users') as any)
      .update({ is_team_member: isMember, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/team')
    revalidatePath('/dashboard/people')
    logActivity({
      action: 'team_member_flag_updated',
      targetType: 'dashboard_user',
      targetId: userId,
      details: { isMember },
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update team membership.' }
  }
}

export async function updateRole(userId: string, role: string): Promise<{ error?: string }> {
  try {
    const me = await requireAdmin()
    if (!me) return { error: NOT_ALLOWED }
    if (!VALID_ROLES.includes(role)) return { error: 'Invalid role.' }
    if (me.userId === userId) {
      return { error: 'You cannot change your own role — ask another admin, so the dashboard is never left without one.' }
    }

    const supabase = createServiceClient()

    const { error } = await (supabase.from('dashboard_users') as any)
      .update({ role, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/team')
    logActivity({
      action: 'team_user_role_updated',
      targetType: 'dashboard_user',
      targetId: userId,
      details: { newRole: role },
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update role.' }
  }
}

// 100 years — effectively permanent until explicitly lifted with 'none'.
// Long-duration ban rather than deleteUser(): archiving must be reversible,
// and a deleted auth.users row can't be restored the same way.
const ARCHIVE_BAN_DURATION = '876000h'

/**
 * Archives a dashboard user: revokes their access immediately (bans the
 * underlying auth.users record so their session can't authenticate at all,
 * independent of whatever the app-layer /dashboard block or any table's RLS
 * does or doesn't enforce) without hard-deleting them, so their prior
 * activity-log entries stay attributable. Reversible via unarchiveUser.
 */
export async function archiveUser(userId: string): Promise<{ error?: string }> {
  try {
    const actingUser = await requireAdmin()
    if (!actingUser) return { error: NOT_ALLOWED }
    if (actingUser.userId === userId) {
      return { error: 'You cannot archive your own account — ask another admin to do it, to avoid locking yourself out with nobody able to reverse it.' }
    }

    const serviceClient = createServiceClient()
    const now = new Date().toISOString()

    const { error: updateError } = await (serviceClient.from('dashboard_users') as any)
      .update({ archived: true, archived_at: now })
      .eq('user_id', userId)
    if (updateError) throw new Error(updateError.message)

    const { error: banError } = await serviceClient.auth.admin.updateUserById(userId, { ban_duration: ARCHIVE_BAN_DURATION })
    if (banError) throw new Error(`Access flag set but session revocation failed: ${banError.message}`)

    // Withdraw their Discord roles, then retire the earlier "done" records so
    // their access can be granted again if they are ever unarchived.
    await emitAutomationEvent(ACCESS_REVOKED, userId)
    await supersedeSuccesses(userId)

    revalidatePath('/dashboard/settings/team')
    logActivity({
      action: 'team_user_archived',
      targetType: 'dashboard_user',
      targetId: userId,
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to archive user.' }
  }
}

export async function unarchiveUser(userId: string): Promise<{ error?: string }> {
  try {
    if (!(await requireAdmin())) return { error: NOT_ALLOWED }

    const supabase = createServiceClient()

    const { error: updateError } = await (supabase.from('dashboard_users') as any)
      .update({ archived: false, archived_at: null })
      .eq('user_id', userId)
    if (updateError) throw new Error(updateError.message)

    const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    if (unbanError) throw new Error(`Access flag cleared but session restore failed: ${unbanError.message}`)

    // Restore their Discord roles (only applies if they had connected Discord).
    await emitAutomationEvent(ACCESS_SYNC, userId)

    revalidatePath('/dashboard/settings/team')
    logActivity({
      action: 'team_user_unarchived',
      targetType: 'dashboard_user',
      targetId: userId,
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to unarchive user.' }
  }
}

export async function removeUser(userId: string): Promise<{ error?: string }> {
  try {
    const me = await requireAdmin()
    if (!me) return { error: NOT_ALLOWED }
    if (me.userId === userId) {
      return { error: 'You cannot remove your own access — ask another admin, so the dashboard is never left without one.' }
    }

    const supabase = createServiceClient()

    const { error } = await (supabase.from('dashboard_users') as any)
      .delete()
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    revalidatePath('/dashboard/settings/team')
    logActivity({
      action: 'team_user_removed',
      targetType: 'dashboard_user',
      targetId: userId,
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to remove user.' }
  }
}