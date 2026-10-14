import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/PublicShell'
import TaskDetailView, { claimView } from '@/components/TaskDetailView'
import { getPortalIdentity } from '@/lib/portal'
import { getOpenTask } from '@/lib/publicData'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const task = await getOpenTask((await params).id)
  return { title: task ? task.title : 'Task not available' }
}

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params
  const task = await getOpenTask(id)
  if (!task) notFound()

  const view = await claimView(task, await getPortalIdentity())

  return (
    <PublicShell signedIn={view.kind !== 'signed_out'}>
      <div className="bg-void pt-20 pb-28">
        <div className="max-w-3xl mx-auto px-8 lg:px-14">
          <TaskDetailView task={task} view={view} boardHref="/tasks" boardLabel="Open tasks" />
        </div>
      </div>
    </PublicShell>
  )
}
