import DashboardShell from '@/components/dashboard/DashboardShell'
import { getDashboardRole } from '@/lib/dashboard/getRole'

export const metadata = {
  title: { default: 'Dashboard', template: '%s | NexTrium Dashboard' },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getDashboardRole()
  return <DashboardShell role={role}>{children}</DashboardShell>
}