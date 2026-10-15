import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { requirePortalStaff } from '@/lib/portal/server'
import { assignableContributors } from '@/lib/portal/tasks'
import PortalTaskEditor from '../PortalTaskEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New portal task' }

export default async function NewPortalTaskPage() {
  if ('error' in (await requirePortalStaff())) notFound()
  const contributors = await assignableContributors()
  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="New portal task" description="Posted to the contributor portal" action={<Link href="/portal/tasks" className="pt-btn ghost">Back to tasks</Link>} />
      <div className="dash-content" style={{ maxWidth: 900 }}>
        <PortalTaskEditor
          initial={{ title: '', description: '', category: 'technical', complexity: 'small', links: [], tags: '' }}
          contributors={contributors}
        />
      </div>
    </>
  )
}
