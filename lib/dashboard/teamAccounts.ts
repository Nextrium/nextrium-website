import { createServiceClient } from '@/lib/supabase/server'

/** True when the auth server refused an invite because the email already has an account. */
export function isEmailAlreadyRegistered(json: any): boolean {
  return json?.error_code === 'email_exists'
    || /already been registered/i.test(String(json?.msg ?? json?.message ?? ''))
}

/** Finds an existing account by email. Fine at this team size: it scans the user list. */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const service = createServiceClient()
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users) return null
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit.id
    if (data.users.length < 1000) return null
  }
  return null
}

export type GrantResult =
  | { status: 'created' }
  | { status: 'exists'; role: string; becameMember: boolean }
  | { status: 'archived' }

/**
 * Gives an existing account dashboard access. An account that already has a
 * dashboard row keeps its current role: being a team member (able to log
 * contributions) is a separate flag that sits alongside any role, so a
 * moderator or admin can be both.
 */
export async function grantDashboardAccess(
  userId: string,
  role: string,
  applicationId?: string,
  asTeamMember = false,
): Promise<GrantResult> {
  const service = createServiceClient() as any
  const { data: existing } = await service.from('dashboard_users').select('*').eq('user_id', userId).maybeSingle()

  if (existing) {
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

  const { error } = await service.from('dashboard_users').insert({
    user_id: userId,
    role,
    is_team_member: asTeamMember || role === 'member',
    ...(applicationId ? { application_id: applicationId } : {}),
  })
  if (error) throw new Error(error.message)
  return { status: 'created' }
}
