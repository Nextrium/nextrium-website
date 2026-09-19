import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
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
}

async function getDashboardUsers(): Promise<DashboardUserRow[]> {
  const supabase = createServiceClient()

  const { data: dashboardUsers } = await (supabase.from('dashboard_users') as any)
    .select('user_id, role, created_at, archived, archived_at')
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

  return dashboardUsers.map((u: any) => ({
    user_id:     u.user_id,
    role:        u.role,
    created_at:  u.created_at,
    email:       emailMap[u.user_id] ?? 'Unknown',
    archived:    u.archived,
    archived_at: u.archived_at,
  }))
}

export default async function TeamAccessPage() {
  const users = await getDashboardUsers()
  return (
    <>
      <Header title="Team Access" description="Manage who has access to the dashboard and their role" />
      <div className="dash-content">
        <TeamAccessClient users={users} />
      </div>
    </>
  )
}
