import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/contributions/auth'
import { getMemberDirectory } from '@/lib/contributions/members'
import TaskEditor from './TaskEditor'
import type { Task } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return { title: id === 'new' ? 'New task' : 'Edit task' }
}

export default async function TaskEditorPage({ params }: Props) {
  if ('error' in (await requireStaff())) notFound()

  const { id } = await params
  let task: Task | null = null
  let hasSubmission = false
  if (id !== 'new') {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
    const supabase = createServiceClient() as any
    const { data } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
    if (!data) notFound()
    task = data
    const { count } = await supabase.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', id)
    hasSubmission = !!count
  }

  const members = await getMemberDirectory()
  return <TaskEditor task={task} members={members} hasSubmission={hasSubmission} />
}
