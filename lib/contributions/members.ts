import { createServiceClient } from '@/lib/supabase/server'
import type { Category } from './constants'
import { CONTRIBUTOR_ROLES } from './auth'
import { getAuthEmails } from '@/lib/dashboard/authEmails'

export interface MemberSummary {
  userId: string
  email: string
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
    .select('user_id, archived, onboarding_completed_at')
    .in('role', CONTRIBUTOR_ROLES)
  const rows: { user_id: string; archived: boolean; onboarding_completed_at: string | null }[] = members ?? []
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.user_id)
  const [{ data: profiles }, { data: open }] = await Promise.all([
    supabase.from('contributor_profiles').select('user_id, categories, skills').in('user_id', ids),
    supabase.from('tasks').select('assigned_to').in('assigned_to', ids).in('status', ['assigned', 'changes_requested']),
  ])
  const profileMap = new Map<string, { categories: Category[]; skills: string[] }>()
  for (const p of profiles ?? []) profileMap.set(p.user_id, { categories: p.categories ?? [], skills: p.skills ?? [] })
  const openCount = new Map<string, number>()
  for (const t of open ?? []) openCount.set(t.assigned_to, (openCount.get(t.assigned_to) ?? 0) + 1)

  const emailMap = await getAuthEmails(supabase, ids)

  return rows
    .map((r) => ({
      userId: r.user_id,
      email: emailMap.get(r.user_id) || 'Unknown',
      active: !r.archived && !!r.onboarding_completed_at,
      categories: profileMap.get(r.user_id)?.categories ?? [],
      skills: profileMap.get(r.user_id)?.skills ?? [],
      openTasks: openCount.get(r.user_id) ?? 0,
    }))
    .sort((a, b) => a.email.localeCompare(b.email))
}
