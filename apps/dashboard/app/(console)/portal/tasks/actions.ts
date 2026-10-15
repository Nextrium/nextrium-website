'use server'

import { revalidatePath } from 'next/cache'
import { parseAssignment, parseTaskInput } from '@nextrium/contributions-core/taskInput'
import { UUID, auditPortal, community, contributorName, notifyContributor, requirePortalStaff } from '@/lib/portal/server'
import { assignmentDeadline, editRules, extendedDeadline, extensionState, parseTags } from '@/lib/portal/taskRules'
import { portalExtensionDecidedEmail, portalTaskAssignedEmail, portalTaskUnassignedEmail } from '@/lib/portal/emails'

type Result<T = object> = ({ ok: true; message: string } & T) | { ok: false; error: string }

const REASON_MAX = 1000
const AWAITING = ['submitted', 'under_review', 'ai_approved']

function refresh(taskId?: string) {
  revalidatePath('/portal')
  revalidatePath('/portal/tasks')
  if (taskId) revalidatePath(`/portal/tasks/${taskId}`)
}

/** Checks a direct-assignment target: an approved contributor with a free slot. */
async function checkAssignee(assigneeId: string): Promise<{ ok: true; c: { id: string; name: string; email: string; contributor_type: string | null; team_name: string | null } } | { ok: false; error: string }> {
  const db = community()
  const { data: c } = await db.from('contributors').select('id, name, email, status, contributor_type, team_name, max_claims').eq('id', assigneeId).maybeSingle()
  if (!c || c.status !== 'active') return { ok: false, error: 'Tasks can only be assigned to approved contributors.' }
  const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', c.id).eq('status', 'assigned')
  const max = c.max_claims ?? 2
  if ((count ?? 0) >= max) return { ok: false, error: `${contributorName(c)} already has ${max} running tasks.` }
  return { ok: true, c }
}

/** Creates a portal task, open for claiming or assigned straight to a contributor. */
export async function createPortalTask(raw: { title?: unknown; description?: unknown; category?: unknown; complexity?: unknown; links?: unknown; tags?: unknown; assigneeId?: unknown; deadlineAt?: unknown }): Promise<Result<{ id: string }>> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const tags = parseTags(raw.tags)
  if ('error' in tags) return { ok: false, error: tags.error }
  const f = parsed.fields

  const row: Record<string, unknown> = {
    title: f.title,
    description: f.description,
    category: f.category,
    complexity: f.complexity,
    point_range_min: f.point_range_min,
    point_range_max: f.point_range_max,
    deadline_days: f.deadline_days,
    links: f.links.length > 0 ? f.links : null,
    primitives: tags.tags,
    status: 'open',
  }

  let assignee: Awaited<ReturnType<typeof checkAssignee>> | null = null
  if (raw.assigneeId) {
    const a = parseAssignment(raw.assigneeId, raw.deadlineAt)
    if ('error' in a) return { ok: false, error: a.error }
    assignee = await checkAssignee(a.assigneeId)
    if (!assignee.ok) return { ok: false, error: assignee.error }
    Object.assign(row, { status: 'assigned', assigned_to: a.assigneeId, claimed_at: new Date().toISOString(), deadline_at: assignmentDeadline(f.deadline_days, a.deadline) })
  }

  const { data, error } = await community().from('tasks').insert(row as never).select('id, deadline_at').single()
  if (error || !data) {
    console.error('[portal] task create failed:', error?.code)
    return { ok: false, error: 'Could not create the task.' }
  }

  let emailed = false
  if (assignee?.ok) {
    emailed = await notifyContributor({ email: assignee.c.email, name: contributorName(assignee.c) }, portalTaskAssignedEmail({ taskTitle: f.title, points: `${f.point_range_min}–${f.point_range_max}`, deadlineAt: data.deadline_at, taskId: data.id }))
  }
  await auditPortal(auth.caller, {
    action: assignee?.ok ? 'task.assigned' : 'task.created',
    targetType: 'task',
    targetId: data.id,
    targetLabel: f.title,
    metadata: { category: f.category, complexity: f.complexity, ...(assignee?.ok ? { assigned_to: contributorName(assignee.c), emailed } : {}) },
  })
  refresh(data.id)
  return { ok: true, id: data.id, message: assignee?.ok ? `Task created and assigned to ${contributorName(assignee.c)}.` : 'Task created and open for claiming.' }
}

/** Edits a task. Category and size change the points and deadline, so they are fixed once someone holds it. */
export async function updatePortalTask(taskId: string, raw: { title?: unknown; description?: unknown; category?: unknown; complexity?: unknown; links?: unknown; tags?: unknown }): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }
  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const tags = parseTags(raw.tags)
  if ('error' in tags) return { ok: false, error: tags.error }

  const db = community()
  const { data: task } = await db.from('tasks').select('status, category, complexity').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  const rules = editRules(task.status)
  if (!rules.content) return { ok: false, error: 'Completed tasks cannot be edited.' }
  const f = parsed.fields
  if (!rules.sizing && (f.category !== task.category || f.complexity !== task.complexity)) {
    return { ok: false, error: 'Category and size are fixed once someone is working on the task.' }
  }

  const update: Record<string, unknown> = {
    title: f.title,
    description: f.description,
    links: f.links.length > 0 ? f.links : null,
    primitives: tags.tags,
  }
  if (rules.sizing) Object.assign(update, { category: f.category, complexity: f.complexity, point_range_min: f.point_range_min, point_range_max: f.point_range_max, deadline_days: f.deadline_days })

  const { data: saved, error } = await db.from('tasks').update(update as never).eq('id', taskId).eq('status', task.status ?? '').select('id')
  if (error) return { ok: false, error: 'Could not save the task.' }
  if (!saved || saved.length === 0) return { ok: false, error: 'This task changed meanwhile. Reload and try again.' }
  await auditPortal(auth.caller, { action: 'task.updated', targetType: 'task', targetId: taskId, targetLabel: f.title, metadata: { category: f.category, complexity: f.complexity } })
  refresh(taskId)
  return { ok: true, message: 'Task saved.' }
}

/** Returns a task to the open board. No cooldown for the contributor: this is the team's decision, not theirs. */
export async function unassignPortalTask(taskId: string, reason?: string): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }
  const note = typeof reason === 'string' ? reason.trim() : ''
  if (note.length > REASON_MAX) return { ok: false, error: `Keep the note under ${REASON_MAX} characters.` }

  const db = community()
  const { data: task } = await db.from('tasks').select('id, title, status, assigned_to').eq('id', taskId).maybeSingle()
  if (!task || task.status !== 'assigned' || !task.assigned_to) return { ok: false, error: 'This task is not in progress.' }
  const { data: waiting } = await db.from('contributions').select('id').eq('task_id', taskId).in('status', AWAITING).limit(1)
  if (waiting && waiting.length > 0) return { ok: false, error: 'This task has a submission waiting for review. Decide on it in the review queue first.' }

  const { data: updated, error } = await db
    .from('tasks')
    .update({ status: 'open', assigned_to: null, claimed_at: null, deadline_at: null, extension_granted: false, extension_requested_at: null, extended_deadline_at: null })
    .eq('id', taskId)
    .eq('status', 'assigned')
    .eq('assigned_to', task.assigned_to)
    .select('id')
  if (error) return { ok: false, error: 'Could not unassign the task.' }
  if (!updated || updated.length === 0) return { ok: false, error: 'This task changed meanwhile. Reload and try again.' }

  const { data: c } = await db.from('contributors').select('name, email, contributor_type, team_name').eq('id', task.assigned_to).maybeSingle()
  const emailed = c ? await notifyContributor({ email: c.email, name: contributorName(c) }, portalTaskUnassignedEmail({ taskTitle: task.title, reason: note || null })) : false
  await auditPortal(auth.caller, { action: 'task.unassigned', targetType: 'task', targetId: taskId, targetLabel: task.title, metadata: { from: c ? contributorName(c) : task.assigned_to, ...(note ? { note } : {}), emailed } })
  refresh(taskId)
  return { ok: true, message: 'Task returned to the open board.' }
}

/** Grants or declines a pending extension request. */
export async function decidePortalExtension(taskId: string, grant: boolean): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(taskId) || typeof grant !== 'boolean') return { ok: false, error: 'Invalid request.' }

  const db = community()
  const { data: task } = await db
    .from('tasks')
    .select('id, title, status, assigned_to, complexity, deadline_at, extension_requested_at, extension_granted, extended_deadline_at')
    .eq('id', taskId)
    .maybeSingle()
  if (!task || task.status !== 'assigned' || !task.assigned_to || !task.deadline_at) return { ok: false, error: 'This task is not in progress.' }
  if (extensionState(task) !== 'requested') return { ok: false, error: 'There is no pending extension request on this task.' }

  const newDeadline = grant ? extendedDeadline(task.deadline_at, task.complexity) : task.deadline_at
  const { data: updated, error } = await db
    .from('tasks')
    .update({ extension_granted: grant, extended_deadline_at: newDeadline })
    .eq('id', taskId)
    .eq('status', 'assigned')
    .is('extended_deadline_at', null)
    .eq('extension_granted', false)
    .select('id')
  if (error) return { ok: false, error: 'Could not save the decision.' }
  if (!updated || updated.length === 0) return { ok: false, error: 'This request was decided meanwhile. Reload to see it.' }

  const { data: c } = await db.from('contributors').select('name, email, contributor_type, team_name').eq('id', task.assigned_to).maybeSingle()
  const emailed = c ? await notifyContributor({ email: c.email, name: contributorName(c) }, portalExtensionDecidedEmail({ taskTitle: task.title, granted: grant, deadlineAt: newDeadline, taskId })) : false
  await auditPortal(auth.caller, { action: grant ? 'task.extension_granted' : 'task.extension_declined', targetType: 'task', targetId: taskId, targetLabel: task.title, metadata: { deadline: newDeadline, emailed } })
  refresh(taskId)
  return { ok: true, message: grant ? 'Extension granted.' : 'Extension declined.' }
}

/** Deletes a task created by mistake. Admins only, and only while it is open and has never had a submission. */
export async function deletePortalTask(taskId: string): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (auth.caller.role !== 'admin') return { ok: false, error: 'Only admins can delete tasks.' }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const db = community()
  const { data: task } = await db.from('tasks').select('id, title, status').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  if (task.status !== 'open') return { ok: false, error: 'Only open tasks can be deleted. Unassign it first.' }
  const { count } = await db.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', taskId)
  if ((count ?? 0) > 0) return { ok: false, error: 'This task has submissions, so it is kept for the record.' }

  const { data: deleted, error } = await db.from('tasks').delete().eq('id', taskId).eq('status', 'open').select('id')
  if (error) return { ok: false, error: 'Could not delete the task.' }
  if (!deleted || deleted.length === 0) return { ok: false, error: 'This task changed meanwhile. Reload and try again.' }
  await auditPortal(auth.caller, { action: 'task.deleted', targetType: 'task', targetId: taskId, targetLabel: task.title })
  refresh()
  return { ok: true, message: 'Task deleted.' }
}
