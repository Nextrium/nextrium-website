import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getVerifiedIdentity } from '@/lib/dashboard/getRole'
import { canSeeDirectory, canViewPerson } from '@/lib/dashboard/peopleVisibility'
import { getAuthEmails } from '@/lib/dashboard/authEmails'
import Header from '@/components/dashboard/Header'
import PeopleClient, { type PersonCard } from './PeopleClient'

export const metadata = { title: 'Team' }
export const dynamic = 'force-dynamic'

// STAFF_ROLES vs the 'member' role is exactly the Staff / General Team
// Members split this directory is built around — see the sidebar's
// PEOPLE_SUB_ITEMS and the Sprint plan in project memory.
const STAFF_ROLES = ['admin', 'content', 'community', 'moderator']

async function getPeople(): Promise<PersonCard[]> {
  const supabase = createServiceClient()

  const { data: dashboardUsers } = await (supabase.from('dashboard_users') as any)
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (!dashboardUsers || dashboardUsers.length === 0) return []

  const memberIds = dashboardUsers.filter((u: any) => u.role === 'member').map((u: any) => u.user_id)
  const [emailMap, { data: tracks }, { data: profiles }, { data: openTasks }] = await Promise.all([
    getAuthEmails(supabase, dashboardUsers.map((u: any) => u.user_id)),
    (supabase.from('staff_tracks') as any).select('id, name'),
    // Contributor program stats for members (points are maintained by the database).
    memberIds.length
      ? (supabase.from('contributor_profiles') as any).select('user_id, categories, total_points, verified_contributions').in('user_id', memberIds)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? (supabase.from('tasks') as any).select('assigned_to').in('assigned_to', memberIds).in('status', ['assigned', 'changes_requested', 'submitted'])
      : Promise.resolve({ data: [] }),
  ])
  const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]))
  const openCount = new Map<string, number>()
  ;(openTasks ?? []).forEach((t: any) => openCount.set(t.assigned_to, (openCount.get(t.assigned_to) ?? 0) + 1))

  const trackNameMap: Record<string, string> = {}
  ;(tracks ?? []).forEach((t: any) => { trackNameMap[t.id] = t.name })

  return dashboardUsers.map((u: any) => ({
    userId:          u.user_id,
    email:           emailMap.has(u.user_id) ? (emailMap.get(u.user_id) || 'No email') : 'Unknown',
    role:            u.role,
    bio:             u.bio,
    socialHandles:   u.social_handles ?? {},
    discordUsername: u.discord_username,
    discordLinked:   !!u.discord_linked_at,
    trackName:       u.staff_track_id ? (trackNameMap[u.staff_track_id] ?? null) : null,
    isTeamMember:    !!u.is_team_member || u.role === 'member',
    contribution: u.role === 'member' ? {
      points:     profileMap.get(u.user_id)?.total_points ?? 0,
      verified:   profileMap.get(u.user_id)?.verified_contributions ?? 0,
      openTasks:  openCount.get(u.user_id) ?? 0,
      categories: profileMap.get(u.user_id)?.categories ?? [],
      // Derived, never stored: invited = not onboarded yet (archived people aren't listed here).
      status:     u.onboarding_completed_at ? 'active' : 'invited',
    } : null,
  }))
}

export default async function PeoplePage() {
  // Only admins and moderators get the directory; everyone else sees their own profile.
  const me = await getVerifiedIdentity()
  if (!me || !canSeeDirectory(me.role)) redirect('/dashboard/people/me')

  const everyone = await getPeople()
  const visible = everyone.filter((p) => canViewPerson(me, p))
  const canSeeStaff = me.role === 'admin'
  const staff = canSeeStaff ? visible.filter((p) => STAFF_ROLES.includes(p.role)) : []
  // Team membership is separate from the access role, so a moderator or
  // admin who is also a team member appears under both tabs (for admins).
  const members = visible.filter((p) => p.isTeamMember)

  return (
    <>
      <Header title="Team" description="Staff and team member profiles — social handles, tracks, and how to reach them" />
      <div className="dash-content">
        <PeopleClient staff={staff} members={members} canSeeStaff={canSeeStaff} />
      </div>
    </>
  )
}
