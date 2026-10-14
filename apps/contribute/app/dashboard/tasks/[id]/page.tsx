import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TaskDetailView, { claimView } from '@/components/TaskDetailView'
import { getActiveContributor, getPortalIdentity } from '@/lib/portal'
import { getTaskForContributor } from '@/lib/publicData'

export const metadata: Metadata = { title: 'Task' }
export const dynamic = 'force-dynamic'

export default async function DashboardTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getActiveContributor()
  if (!me) return null
  const { id } = await params
  const found = await getTaskForContributor(id, me.id)
  if (!found) notFound()

  const view = await claimView(found.task, await getPortalIdentity(), found.mine)

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-14 py-12 lg:py-16">
      <TaskDetailView task={found.task} view={view} boardHref="/dashboard/tasks" boardLabel="Open tasks" />
    </div>
  )
}
