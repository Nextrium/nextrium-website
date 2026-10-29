import { createServiceClient } from '@nextrium/supabase/server'
import type { Category } from '@nextrium/contributions-core/constants'
import { CONTRIBUTOR_ROLES } from './auth'

export interface MemberSummary {
  userId: string
  /** Best name available (see memberDisplayName). Staff-only lists use this. */
  name: string
  /** Their own display name, else a name from their application or account. Never from their email, so safe to show other members. */
  publicName: string | null
  active: boolean          // onboarded and not archived
  categories: Category[]
  skills: string[]
  openTasks: number        // assigned or changes requested
}

/**
 * The name to show for a person, from the most to the least deliberate
 * source: the display name on their profile, the name on their linked
 * application, the name on an application sent from their email, the name on
 * their account, and lastly the start of their email (before the @).
 */
export function memberDisplayName(src: {
  profileName?: string | null
  linkedAppName?: string | null
  emailAppName?: string | null
  accountName?: string | null
  email?: string | null
}): string {
  for (const v of [src.profileName, src.linkedAppName, src.emailAppName, src.accountName]) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (s) return s.slice(0, 120)
  }
  const local = (src.email ?? '').split('@')[0]?.trim() ?? ''
  if (local) return local.charAt(0).toUpperCase() + local.slice(1)
  return 'Unnamed member'
}

/**
 * Everyone who can be assigned a task (any dashboard role), once each, with
 * the fields staff need to pick an assignee. Server-only (service role);
 * shown on staff pages only.
 */
export async function getMemberDirectory(service: any = createServiceClient()): Promise<MemberSummary[]> {
  const { data: members } = await service
    .from('dashboard_users')
    .select('user_id, archived, onboarding_completed_at, application_id')
    .in('role', CONTRIBUTOR_ROLES)
  // One entry per person, even if the database ever held a duplicate row.
  const byUser = new Map<string, { user_id: string; archived: boolean; onboarding_completed_at: string | null; application_id: string | null }>()
  for (const r of members ?? []) if (!byUser.has(r.user_id)) byUser.set(r.user_id, r)
  const rows = [...byUser.values()]
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.user_id)
  const [{ data: profiles }, { data: open }, accounts] = await Promise.all([
    service.from('contributor_profiles').select('user_id, categories, skills, display_name').in('user_id', ids),
    service.from('tasks').select('assigned_to').in('assigned_to', ids).in('status', ['assigned', 'changes_requested']),
    listAccounts(service),
  ])
  const profileMap = new Map<string, { categories: Category[]; skills: string[]; displayName: string | null }>()
  for (const p of profiles ?? []) profileMap.set(p.user_id, { categories: p.categories ?? [], skills: p.skills ?? [], displayName: p.display_name?.trim() || null })
  const openCount = new Map<string, number>()
  for (const t of open ?? []) openCount.set(t.assigned_to, (openCount.get(t.assigned_to) ?? 0) + 1)

  // Applications: the linked one by id, and any sent from the person's email.
  const appIds = rows.map((r) => r.application_id).filter(Boolean)
  const emails = ids.map((id) => accounts.get(id)?.email).filter((e): e is string => !!e)
  const [{ data: linkedApps }, { data: emailApps }] = await Promise.all([
    appIds.length ? service.from('applications').select('id, name').in('id', appIds) : Promise.resolve({ data: [] }),
    // All applications' emails, matched below ignoring case (stored emails keep the applicant's casing).
    emails.length ? service.from('applications').select('email, name, created_at').limit(5000) : Promise.resolve({ data: [] }),
  ])
  const linkedName = new Map<string, string>((linkedApps ?? []).map((a: any) => [a.id, (a.name ?? '').trim()]))
  const emailName = new Map<string, string>()
  const wanted = new Set(emails)
  for (const a of [...(emailApps ?? [])].sort((x: any, y: any) => (y.created_at ?? '').localeCompare(x.created_at ?? ''))) {
    const key = (a.email ?? '').trim().toLowerCase()
    if (!wanted.has(key)) continue
    if (a.name?.trim() && !emailName.has(key)) emailName.set(key, a.name.trim())
  }

  return rows
    .map((r) => {
      const account = accounts.get(r.user_id)
      const names = {
        profileName: profileMap.get(r.user_id)?.displayName,
        linkedAppName: r.application_id ? linkedName.get(r.application_id) : null,
        emailAppName: account?.email ? emailName.get(account.email.toLowerCase()) : null,
        accountName: account?.name,
      }
      return {
        userId: r.user_id,
        name: memberDisplayName({ ...names, email: account?.email }),
        publicName: [names.profileName, names.linkedAppName, names.emailAppName, names.accountName].map((v) => v?.trim()).find(Boolean)?.slice(0, 120) ?? null,
        active: !r.archived && !!r.onboarding_completed_at,
        categories: profileMap.get(r.user_id)?.categories ?? [],
        skills: profileMap.get(r.user_id)?.skills ?? [],
        openTasks: openCount.get(r.user_id) ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Sign-in emails and account names by user id. Fine at this team size. */
async function listAccounts(service: any): Promise<Map<string, { email: string | null; name: string | null }>> {
  const out = new Map<string, { email: string | null; name: string | null }>()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users) break
    for (const u of data.users) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>
      const name = [meta.full_name, meta.name, meta.display_name].find((v) => typeof v === 'string' && v.trim()) as string | undefined
      out.set(u.id, { email: u.email ? u.email.toLowerCase() : null, name: name ?? null })
    }
    if (data.users.length < 1000) break
  }
  return out
}
