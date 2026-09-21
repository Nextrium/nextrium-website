import { createServiceClient } from '@/lib/supabase/server'
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
    .select('user_id, role, bio, social_handles, discord_username, discord_linked_at, staff_track_id, created_at')
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (!dashboardUsers || dashboardUsers.length === 0) return []

  const [{ data: authUsers }, { data: tracks }] = await Promise.all([
    supabase.auth.admin.listUsers(),
    (supabase.from('staff_tracks') as any).select('id, name'),
  ])

  const emailMap: Record<string, string> = {}
  authUsers?.users.forEach((u) => { emailMap[u.id] = u.email ?? 'No email' })

  const trackNameMap: Record<string, string> = {}
  ;(tracks ?? []).forEach((t: any) => { trackNameMap[t.id] = t.name })

  return dashboardUsers.map((u: any) => ({
    userId:          u.user_id,
    email:           emailMap[u.user_id] ?? 'Unknown',
    role:            u.role,
    bio:             u.bio,
    socialHandles:   u.social_handles ?? {},
    discordUsername: u.discord_username,
    discordLinked:   !!u.discord_linked_at,
    trackName:       u.staff_track_id ? (trackNameMap[u.staff_track_id] ?? null) : null,
  }))
}

export default async function PeoplePage() {
  const people = await getPeople()
  const staff = people.filter((p) => STAFF_ROLES.includes(p.role))
  const members = people.filter((p) => p.role === 'member')

  return (
    <>
      <Header title="Team" description="Staff and team member profiles — social handles, tracks, and how to reach them" />
      <div className="dash-content">
        <PeopleClient staff={staff} members={members} />
      </div>
    </>
  )
}
