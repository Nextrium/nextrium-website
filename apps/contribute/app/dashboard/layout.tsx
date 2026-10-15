import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPortalIdentity } from '@/lib/portal'
import { StatusScreen, UnregisteredScreen } from '@/components/GateScreen'
import Sidebar from '@/components/dashboard/Sidebar'

export const metadata: Metadata = { title: 'Dashboard' }
// Submitting work waits for the automated review (up to ~55 s).
export const maxDuration = 60

// The approval gate. Only approved (active) contributors get the dashboard;
// everyone else sees where their application stands. Pages and actions under
// /dashboard check again for themselves, because a layout is not re-run on
// every navigation.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getPortalIdentity()
  if (!me) redirect('/signin?next=/dashboard')
  if (!me.contributor) return <UnregisteredScreen />
  if (me.contributor.status !== 'active') return <StatusScreen contributor={me.contributor} />

  return (
    <div className="min-h-screen bg-void">
      <Sidebar />
      <main className="lg:ml-[240px] pt-[60px] lg:pt-0 min-h-screen">{children}</main>
    </div>
  )
}
