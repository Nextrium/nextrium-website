import type { Metadata } from 'next'
import PublicShell from '@/components/PublicShell'
import PageHeader from '@/components/PageHeader'
import { isSignedIn, listOpenTasks } from '@/lib/publicData'
import TaskBoard from './TaskBoard'

export const metadata: Metadata = { title: 'Open tasks' }
// Claims change the board at any moment; always show it live.
export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const [tasks, signedIn] = await Promise.all([listOpenTasks(), isSignedIn()])

  return (
    <PublicShell signedIn={signedIn}>
      <div className="bg-void pt-20 pb-28">
        <div className="max-w-6xl mx-auto px-8 lg:px-14">
          <PageHeader
            crumb="Tasks"
            title="Open tasks"
            intro="Browse available work across all five contribution categories. Each task shows its point range before you start."
          />
          <TaskBoard tasks={tasks} />
        </div>
      </div>
    </PublicShell>
  )
}
