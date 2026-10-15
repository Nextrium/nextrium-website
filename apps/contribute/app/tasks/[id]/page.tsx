import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicShell from '@/components/PublicShell'
import TaskDetailView, { claimView } from '@/components/TaskDetailView'
import { getPortalIdentity } from '@/lib/portal'
import { getOpenTask, getTaskForContributor } from '@/lib/publicData'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

/** The open task, or one the signed-in contributor holds (so it stays viewable right after claiming). */
async function visibleTask(id: string) {
  const me = await getPortalIdentity()
  const active = me?.contributor?.status === 'active' ? me.contributor : null
  const found = active ? await getTaskForContributor(id, active.id) : null
  return { me, task: found?.task ?? (await getOpenTask(id)), mine: found?.mine ?? false }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { task } = await visibleTask((await params).id)
  return { title: task ? task.title : 'Task not available' }
}

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params
  const { me, task, mine } = await visibleTask(id)
  if (!task) notFound()

  const view = await claimView(task, me, mine)

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
