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
  | { status: 'exists'; role: string }
  | { status: 'archived' }

/**
 * Gives an existing account dashboard access. An account that already has a
 * dashboard row keeps its current role; only a missing link to the
 * application is filled in.
 */
export async function grantDashboardAccess(userId: string, role: string, applicationId?: string): Promise<GrantResult> {
  const service = createServiceClient() as any
  const { data: existing } = await service.from('dashboard_users')
    .select('role, archived, application_id').eq('user_id', userId).maybeSingle()

  if (existing) {
    if (existing.archived) return { status: 'archived' }
    if (applicationId && !existing.application_id) {
      await service.from('dashboard_users').update({ application_id: applicationId }).eq('user_id', userId)
    }
    return { status: 'exists', role: existing.role }
  }

  const { error } = await service.from('dashboard_users').insert({
    user_id: userId,
    role,
    ...(applicationId ? { application_id: applicationId } : {}),
  })
  if (error) throw new Error(error.message)
  return { status: 'created' }
}
