import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedIdentity, type DashboardRole } from '@/lib/dashboard/getRole'
import { STAFF_ROLES } from '@/lib/dashboard/requireRole'

export interface Caller {
  userId: string
  email: string | null
  role: DashboardRole
}

/**
 * Verified caller (checked with the auth server, role read fresh) when they
 * are staff (admin or moderator), otherwise an error. Every contributor
 * program server action and staff page calls this itself rather than
 * relying on page-level gating.
 */
export async function requireStaff(): Promise<{ caller: Caller } | { error: string }> {
  const me = await getVerifiedIdentity()
  if (!me || !STAFF_ROLES.includes(me.role)) return { error: 'You do not have permission to do this.' }
  return { caller: me }
}

/**
 * Verified caller when they are an active member (role 'member', onboarded,
 * not archived), otherwise an error. Member-facing contributor actions and
 * pages call this themselves.
 */
export async function requireMember(): Promise<{ caller: Caller } | { error: string }> {
  const me = await getVerifiedIdentity()
  if (!me || me.role !== 'member') return { error: 'You do not have permission to do this.' }
  const { data } = await (createServiceClient().from('dashboard_users') as any)
    .select('archived, onboarding_completed_at')
    .eq('user_id', me.userId)
    .maybeSingle()
  if (!data || data.archived || !data.onboarding_completed_at) return { error: 'Finish setting up your profile first.' }
  return { caller: me }
}
