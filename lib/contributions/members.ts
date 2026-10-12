import { createServiceClient } from '@/lib/supabase/server'
import type { Category } from './constants'
import { CONTRIBUTOR_ROLES } from './auth'

export interface MemberSummary {
  userId: string
  /** Display name, else the name on their application. Never an email. */
  name: string
  active: boolean          // onboarded and not archived
  categories: Category[]
  skills: string[]
  openTasks: number        // assigned or changes requested
}

/**
 * Everyone who can be assigned a task (any dashboard role), with the fields
 * staff need to pick an assignee. Server-only (service role).
 */
export async function getMemberDirectory(): Promise<MemberSummary[]> {
  const supabase = createServiceClient() as any
  const { data: members } = await supabase
    .from('dashboard_users')
    .select('user_id, archived, onboarding_completed_at, application_id')
    .in('role', CONTRIBUTOR_ROLES)
  const rows: { user_id: string; archived: boolean; onboarding_completed_at: string | null; application_id: string | null }[] = members ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.user_id)
  const [{ data: profiles }, { data: open }] = await Promise.all([
    supabase.from('contributor_profiles').select('user_id, categories, skills, display_name').in('user_id', ids),
    supabase.from('tasks').select('assigned_to').in('assigned_to', ids).in('status', ['assigned', 'changes_requested']),
  ])
  const profileMap = new Map<string, { categories: Category[]; skills: string[]; displayName: string | null }>()
  for (const p of profiles ?? []) profileMap.set(p.user_id, { categories: p.categories ?? [], skills: p.skills ?? [], displayName: p.display_name?.trim() || null })
  const openCount = new Map<string, number>()
  for (const t of open ?? []) openCount.set(t.assigned_to, (openCount.get(t.assigned_to) ?? 0) + 1)

  const appIds = rows.map((r) => r.application_id).filter(Boolean)
  const { data: apps } = appIds.length
    ? await supabase.from('applications').select('id, name').in('id', appIds)
    : { data: [] }
  const appName = new Map<string, string>((apps ?? []).map((a: any) => [a.id, (a.name ?? '').trim()]))

  return rows
    .map((r) => ({
      userId: r.user_id,
      name: profileMap.get(r.user_id)?.displayName || (r.application_id && appName.get(r.application_id)) || 'Unnamed member',
      active: !r.archived && !!r.onboarding_completed_at,
      categories: profileMap.get(r.user_id)?.categories ?? [],
      skills: profileMap.get(r.user_id)?.skills ?? [],
      openTasks: openCount.get(r.user_id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
