'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activityLog'

export async function inviteUser(email: string, role: string): Promise<{ error?: string }> {
  try {
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
    const supabase = await createClient()
    const { data: { user: actingUser } } = await supabase.auth.getUser()
    if (!actingUser) return { error: 'Not signed in.' }
    if (actingUser.id === userId) {
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