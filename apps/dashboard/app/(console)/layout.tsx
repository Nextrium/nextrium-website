import DashboardShell from '@/components/dashboard/DashboardShell'
import { getDashboardRole } from '@/lib/dashboard/getRole'
import { brand } from '@nextrium/brand'

export const metadata = {
  title: { default: 'Dashboard', template: `%s | ${brand.styledName} Dashboard` },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getDashboardRole()
  return <DashboardShell role={role}>{children}</DashboardShell>
}