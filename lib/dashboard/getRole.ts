import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// 'none' = signed in (or not signed in at all) with no dashboard_users row.
// It is a deny role, never a fallback to real access.
export type DashboardRole = 'admin' | 'content' | 'community' | 'moderator' | 'member' | 'archived' | 'none'

interface DashboardUserRole {
  role: 'admin' | 'content' | 'community' | 'moderator' | 'member'
  archived: boolean
}

const ROLE_COOKIE = 'nextrium-role'

// Reads dashboard_users with the service client so RLS on that table can
// never make a real staff account look role-less. Any error or missing row
// resolves to 'none' (deny), never to a working role.
async function lookupRole(userId: string): Promise<DashboardRole> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('dashboard_users')
    .select('role, archived')
    .eq('user_id', userId)
    .maybeSingle() as { data: DashboardUserRole | null; error: unknown }

  if (error || !data) return 'none'
  if (data.archived) return 'archived'
  return data.role
}

/**
 * Resolves the current user's dashboard role for PAGES, which always sit
 * behind proxy.ts. Reuses the "<userId>:<role>:<onboarded>" cookie the
 * middleware caches to avoid a duplicate lookup per navigation.
 *
 * The identity here comes from getSession() (the local cookie, not
 * re-checked with the auth server), which is only acceptable because
 * proxy.ts already ran the authoritative getUser() for this request. Do NOT
 * use this from an API route or server action that proxy.ts doesn't cover —
 * use getVerifiedDashboardRole() there.
 */
export async function getDashboardRole(): Promise<DashboardRole> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return 'none'

  const cookieStore = await cookies()
  const cached = cookieStore.get(ROLE_COOKIE)?.value
  if (cached) {
    const [cachedUserId, cachedRole] = cached.split(':')
    if (cachedUserId === user.id && cachedRole) return cachedRole as DashboardRole
  }

  return lookupRole(user.id)
}

/**
 * Same result, but the identity is verified with the auth server
 * (getUser) and the role is read fresh — no cookie cache. Use this for API
 * routes and server actions that make an authorization decision, since
 * those are not guaranteed to have passed through proxy.ts.
 */
export async function getVerifiedDashboardRole(): Promise<DashboardRole> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return 'none'
  return lookupRole(user.id)
}
