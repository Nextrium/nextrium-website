import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { APPLICATION_TRACKS } from '@/lib/automation/rulesAdmin'
import TeamAccessClient from './TeamAccessClient'

export const metadata = { title: 'Team Access' }
export const dynamic = 'force-dynamic'

interface DashboardUserRow {
  user_id: string
  role: string
  created_at: string
  email: string
  archived: boolean
  archived_at: string | null
  is_team_member: boolean
}

async function getDashboardUsers(): Promise<DashboardUserRow[]> {
  const supabase = createServiceClient()

  const { data: dashboardUsers } = await (supabase.from('dashboard_users') as any)
    .select('*')
    .order('created_at', { ascending: true })

  if (!dashboardUsers || dashboardUsers.length === 0) return []

  const userIds = dashboardUsers.map((u: any) => u.user_id)

  const { data: authUsers } = await supabase.auth.admin.listUsers()

  const emailMap: Record<string, string> = {}
  if (authUsers?.users) {
    authUsers.users.forEach((u) => {
      if (userIds.includes(u.id)) {
        emailMap[u.id] = u.email ?? 'No email'
      }
    })
  }

  const { data: trackRows } = await (supabase.from('staff_tracks') as any).select('id, name')
  const trackNames: Record<string, string> = {}
  ;(trackRows ?? []).forEach((t: any) => { trackNames[t.id] = t.name })

  return dashboardUsers.map((u: any) => ({
    user_id:     u.user_id,
    role:        u.role,
    created_at:  u.created_at,
    email:       emailMap[u.user_id] ?? 'Unknown',
    archived:    u.archived,
    archived_at: u.archived_at,
    is_team_member: !!u.is_team_member || u.role === 'member',
  }))
}

export default async function TeamAccessPage() {
  const users = await getDashboardUsers()
  return (
    <>
      <Header title="Team Access" description="Manage who has access to the dashboard and their role" />
      <div className="dash-content">
        <TeamAccessClient users={users} tracks={APPLICATION_TRACKS} />
      </div>
    </>
  )
}
