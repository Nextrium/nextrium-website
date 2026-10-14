import type { Metadata } from 'next'
import { getActiveContributor } from '@/lib/portal'
import { listOpenTasks } from '@/lib/publicData'
import { C, F } from '@/lib/theme'
import TaskBoard from '@/app/tasks/TaskBoard'

export const metadata: Metadata = { title: 'Open tasks' }
export const dynamic = 'force-dynamic'

export default async function DashboardTasksPage() {
  const me = await getActiveContributor()
  if (!me) return null
  const tasks = await listOpenTasks()

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-14 py-12 lg:py-16">
      <h1 className="mb-3" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(28px,4vw,48px)', letterSpacing: '-0.03em', lineHeight: 1.05, color: C.light }}>Open tasks</h1>
      <p className="mb-10" style={{ fontFamily: F.body, fontWeight: 300, fontSize: 15, color: C.mute, maxWidth: 520, lineHeight: 1.75 }}>
        Claim a task that matches your skills. First come, first served.
      </p>
      <TaskBoard tasks={tasks} basePath="/dashboard/tasks" />
    </div>
  )
}
