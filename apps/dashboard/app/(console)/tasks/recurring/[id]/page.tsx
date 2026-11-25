import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import { requireStaff } from '@/lib/contributions/auth'
import { getMemberDirectory } from '@/lib/contributions/members'
import RecurringScheduleEditor from '../RecurringScheduleEditor'
import type { RecurringTask, RecurringTaskRun, Task } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Recurring schedule' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ spawned?: string }>
}

export default async function RecurringScheduleDetailPage({ params, searchParams }: Props) {
  if ('error' in (await requireStaff())) notFound()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const supabase = createServiceClient() as any
  const { data: schedule }: { data: RecurringTask | null } = await supabase
    .from('recurring_tasks').select('*').eq('id', id).maybeSingle()
  if (!schedule) notFound()

  const [{ data: taskRows }, { data: runRows }, members] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, status, assigned_to, occurrence_date, deadline_at, grace_draft_at, expires_at')
      .eq('recurring_task_id', schedule.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('recurring_task_runs')
      .select('*')
      .eq('recurring_task_id', schedule.id)
      .order('occurrence_date', { ascending: false })
      .limit(200),
    getMemberDirectory(),
  ])

  const { spawned } = await searchParams
  const justSpawned = spawned && /^\d{1,2}$/.test(spawned) ? Number(spawned) : null

  return (
    <RecurringScheduleEditor
      schedule={schedule}
      members={members}
      spawnedTasks={(taskRows ?? []) as Pick<Task, 'id' | 'title' | 'status' | 'assigned_to' | 'occurrence_date' | 'deadline_at' | 'grace_draft_at' | 'expires_at'>[]}
      runs={(runRows ?? []) as RecurringTaskRun[]}
      justSpawned={justSpawned}
    />
  )
}
