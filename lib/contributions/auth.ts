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
