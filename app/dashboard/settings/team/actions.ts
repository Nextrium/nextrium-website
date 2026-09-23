'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activityLog'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'

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

export async function inviteUser(email: string, role: string): Promise<{ error?: string }> {
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

    if (!res.ok) throw new Error(json.message ?? json.error_description ?? json.msg ?? 'Failed to invite user.')

    const userId = json.id
    if (!userId) throw new Error('Invite succeeded but no user ID was returned.')

    const supabase = createServiceClient()
    const { error: insertError } = await (supabase.from('dashboard_users') as any).insert({
      user_id: userId,
      role,
    })
    if (insertError) throw new Error(insertError.message)

    revalidatePath('/dashboard/settings/team')
    logActivity({
      action: 'team_user_invited',
      targetType: 'dashboard_user',
      targetId: userId,
      details: { email, role },
    }).catch(() => {})
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to invite user.' }
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