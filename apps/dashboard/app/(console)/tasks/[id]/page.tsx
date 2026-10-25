import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import { requireStaff } from '@/lib/contributions/auth'
import { GROUP_MAX, groupProgress, openCopyIds } from '@/lib/contributions/groupRules'
import { getMemberDirectory } from '@/lib/contributions/members'
import TaskEditor from './TaskEditor'
import type { Task } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ shared?: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: id === 'new' ? 'New task' : 'Edit task' }
}

export default async function TaskEditorPage({ params, searchParams }: Props) {
  const auth = await requireStaff()
  if ('error' in auth) notFound()

  const { id } = await params
  let task: Task | null = null
  let hasSubmission = false
  let groupSize = 0
  // For a shared task: where the group stands and how many copies are still open.
  let group: { label: string; open: number } | null = null
  if (id !== 'new') {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
    const supabase = createServiceClient() as any
    const { data } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
    if (!data) notFound()
    task = data
    const [{ count }, { data: copies }] = await Promise.all([
      supabase.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', id),
      data.group_id ? supabase.from('tasks').select('id, status').eq('group_id', data.group_id) : Promise.resolve({ data: [] }),
    ])
    hasSubmission = !!count
    if (data.group_id) {
      const list: { id: string; status: string }[] = copies ?? []
      const { data: subs } = await supabase.from('contributions').select('task_id').in('task_id', list.map((c) => c.id))
      const progress = groupProgress(list.map((c) => c.status))
      groupSize = progress.total
      group = { label: progress.label, open: openCopyIds(list, new Set((subs ?? []).map((x: { task_id: string }) => x.task_id))).length }
    }
  }

  // "Shared with N people" after creating a group: a small number, nothing else.
  const { shared } = await searchParams
  const sharedWith = shared && /^\d{1,2}$/.test(shared) && Number(shared) >= 2 && Number(shared) <= GROUP_MAX ? Number(shared) : null

  const members = await getMemberDirectory()
  return (
    <TaskEditor
      task={task}
      members={members}
      hasSubmission={hasSubmission}
      groupSize={groupSize}
      group={group}
      sharedWith={sharedWith}
      isAdmin={auth.caller.role === 'admin'}
    />
  )
}
