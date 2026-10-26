'use server'

import { revalidatePath } from 'next/cache'
import { parseAssignment, parseTaskInput } from '@nextrium/contributions-core/taskInput'
import { UUID, auditPortal, community, contributorName, notifyContributor, requirePortalStaff } from '@/lib/portal/server'
import { assignmentDeadline, deleteRule, editRules, extendedDeadline, extensionState, parseTags } from '@/lib/portal/taskRules'
import { portalExtensionDecidedEmail, portalSharedCopyRemovedEmail, portalTaskAssignedEmail, portalTaskUnassignedEmail } from '@/lib/portal/emails'
import { capRule, extendedClose, parseSharedOptions, untouchedCopies, windowClose, type CopyRow } from '@/lib/portal/sharedRules'

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
export async function createPortalTask(raw: { title?: unknown; description?: unknown; category?: unknown; complexity?: unknown; links?: unknown; tags?: unknown; assigneeId?: unknown; deadlineAt?: unknown; shared?: { windowHours?: unknown; maxClaimers?: unknown } | null }): Promise<Result<{ id: string }>> {
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

  // Open to several contributors: each claim (during the window) makes that person's own copy.
  let shared: ReturnType<typeof parseSharedOptions> | null = null
  if (raw.shared) {
    if (raw.assigneeId) return { ok: false, error: 'A task is either open to several contributors or assigned to one, not both.' }
    shared = parseSharedOptions(raw.shared)
    if ('error' in shared) return { ok: false, error: shared.error }
    Object.assign(row, { shared: true, claim_closes_at: windowClose(new Date(), shared.windowHours), max_claimers: shared.maxClaimers })
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
    action: assignee?.ok ? 'task.assigned' : shared ? 'task.shared_created' : 'task.created',
    targetType: 'task',
    targetId: data.id,
    targetLabel: f.title,
    metadata: {
      category: f.category, complexity: f.complexity,
      ...(assignee?.ok ? { assigned_to: contributorName(assignee.c), emailed } : {}),
      ...(shared && !('error' in shared) ? { window_hours: shared.windowHours, max_claimers: shared.maxClaimers } : {}),
    },
  })
  refresh(data.id)
  if (shared && !('error' in shared)) {
    return { ok: true, id: data.id, message: `Task created and open to several contributors for ${shared.windowHours} hours${shared.maxClaimers ? `, up to ${shared.maxClaimers} people` : ''}.` }
  }
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
  const { data: task } = await db.from('tasks').select('status, category, complexity, shared').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  const rules = editRules(task.status)
  if (!rules.content) return { ok: false, error: 'Completed tasks cannot be edited.' }
  const f = parsed.fields
  if (task.shared && (f.category !== task.category || f.complexity !== task.complexity)) {
    const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('shared_from', taskId)
    if ((count ?? 0) > 0) return { ok: false, error: 'Category and size are fixed once anyone has claimed this shared task.' }
  }
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
  const { data: task } = await db.from('tasks').select('id, title, status, assigned_to, shared_from').eq('id', taskId).maybeSingle()
  if (!task || task.status !== 'assigned' || !task.assigned_to) return { ok: false, error: 'This task is not in progress.' }
  if (task.shared_from) return withdrawCopies(auth.caller, task.shared_from, [task.id], note || null)
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

/**
 * Deletes a task, admins only. Its rejected submissions go with it, so it leaves
 * no trace on the portal or here; held tasks, waiting work and verified work are
 * kept (see deleteRule). The audit log keeps a record of the deletion.
 */
export async function deletePortalTask(taskId: string): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (auth.caller.role !== 'admin') return { ok: false, error: 'Only admins can delete tasks.' }
  if (!UUID.test(taskId)) return { ok: false, error: 'That task could not be found.' }

  const db = community()
  const { data: task } = await db.from('tasks').select('id, title, status, shared').eq('id', taskId).maybeSingle()
  if (!task) return { ok: false, error: 'That task could not be found.' }
  if (task.shared) {
    const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('shared_from', taskId)
    if ((count ?? 0) > 0) return { ok: false, error: `This shared task has ${count} cop${count === 1 ? 'y' : 'ies'}, so it is kept. Close it, or withdraw the copies nobody has submitted.` }
  }
  const { data: subs, error: subsError } = await db.from('contributions').select('id, status').eq('task_id', taskId)
  if (subsError) return { ok: false, error: 'Could not delete the task.' }
  const rule = deleteRule(task.status, subs ?? [])
  if (!rule.ok) return { ok: false, error: rule.error }
  const ids = rule.removeSubmissionIds

  // Rejected submissions only, by id: anything that changed since the check is left alone.
  const removeSubmissions = async () => {
    if (ids.length === 0) return true
    const { error } = await db.from('contributions').delete().in('id', ids).eq('status', 'rejected')
    return !error
  }

  // Task first, guarded on still being open, so nobody can claim it in between.
  let { data: deleted, error } = await db.from('tasks').delete().eq('id', taskId).eq('status', 'open').select('id')
  if (error?.code === '23503') {
    // The submissions still point at the task: remove them, then the task.
    if (!(await removeSubmissions())) return { ok: false, error: 'Could not delete the task.' }
    ;({ data: deleted, error } = await db.from('tasks').delete().eq('id', taskId).eq('status', 'open').select('id'))
  }
  if (error) return { ok: false, error: 'Could not delete the task.' }
  if (!deleted || deleted.length === 0) return { ok: false, error: 'This task changed meanwhile. Reload and try again.' }
  const cleared = await removeSubmissions()
  if (!cleared) console.error('[portal] task deleted but its rejected submissions were not removed:', taskId)

  await auditPortal(auth.caller, { action: 'task.deleted', targetType: 'task', targetId: taskId, targetLabel: task.title, metadata: { submissions_removed: cleared ? ids.length : 0 } })
  refresh()
  revalidatePath('/portal/reviews')
  return { ok: true, message: ids.length > 0 ? `Task deleted with its ${ids.length} rejected submission${ids.length === 1 ? '' : 's'}.` : 'Task deleted.' }
}

// ── Shared tasks (open to several contributors) ────────────────────────────

type Staff = Extract<Awaited<ReturnType<typeof requirePortalStaff>>, { caller: unknown }>['caller']

/** A shared task with its copies and which copies have any submission. */
async function loadShared(taskId: string): Promise<{ task: { id: string; title: string; claim_closes_at: string | null; max_claimers: number | null }; copies: CopyRow[]; withSubmission: Set<string> } | { error: string }> {
  if (!UUID.test(taskId)) return { error: 'That task could not be found.' }
  const db = community()
  const { data: task } = await db.from('tasks').select('id, title, shared, claim_closes_at, max_claimers').eq('id', taskId).maybeSingle()
  if (!task) return { error: 'That task could not be found.' }
  if (!task.shared) return { error: 'This task is not open to several contributors.' }
  const { data: copies } = await db.from('tasks').select('id, status, assigned_to').eq('shared_from', taskId)
  const ids = (copies ?? []).map((c) => c.id)
  const { data: subs } = ids.length ? await db.from('contributions').select('task_id').in('task_id', ids) : { data: [] }
  return { task, copies: copies ?? [], withSubmission: new Set((subs ?? []).map((x) => x.task_id as string)) }
}

/**
 * Withdraws copies nobody has submitted work for. Each goes through
 * remove_shared_copy, which locks the copy and checks again, so work arriving
 * at the same moment is never lost. Holders are emailed. No cooldown.
 */
async function withdrawCopies(caller: Staff, sharedId: string, copyIds: string[], reason: string | null): Promise<Result> {
  const db = community()
  const { data: shared } = await db.from('tasks').select('title').eq('id', sharedId).maybeSingle()
  let removed = 0
  const kept: string[] = []
  for (const id of copyIds) {
    const { data: holder, error } = await db.rpc('remove_shared_copy', { p_copy_id: id })
    if (error || !holder) { kept.push(id); continue }
    removed++
    const { data: c } = await db.from('contributors').select('name, email, contributor_type, team_name').eq('id', holder).maybeSingle()
    if (c) await notifyContributor({ email: c.email, name: contributorName(c) }, portalSharedCopyRemovedEmail({ taskTitle: shared?.title ?? 'a shared task', reason }))
  }
  await auditPortal(caller, { action: 'task.shared_copies_withdrawn', targetType: 'task', targetId: sharedId, targetLabel: shared?.title ?? '', metadata: { withdrawn: removed, kept: kept.length, ...(reason ? { note: reason } : {}) } })
  refresh(sharedId)
  for (const id of copyIds) revalidatePath(`/portal/tasks/${id}`)
  if (removed === 0) return { ok: false, error: kept.length ? 'Nothing was withdrawn: work has been submitted on those copies, so they carry on through review.' : 'There was nothing to withdraw.' }
  return { ok: true, message: `Withdrew ${removed} cop${removed === 1 ? 'y' : 'ies'}.${kept.length ? ` ${kept.length} with submitted work carr${kept.length === 1 ? 'ies' : 'y'} on.` : ''} The contributor${removed === 1 ? ' was' : 's were'} emailed.` }
}

/** Stops claims now. Copies already claimed carry on. */
export async function closeSharedTask(taskId: string): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const g = await loadShared(taskId)
  if ('error' in g) return { ok: false, error: g.error }
  const now = new Date().toISOString()
  if (!g.task.claim_closes_at || g.task.claim_closes_at <= now) return { ok: false, error: 'Claims are already closed.' }
  const { error } = await community().from('tasks').update({ claim_closes_at: now }).eq('id', taskId).eq('shared', true)
  if (error) return { ok: false, error: 'Could not close the task.' }
  await auditPortal(auth.caller, { action: 'task.shared_closed', targetType: 'task', targetId: taskId, targetLabel: g.task.title, metadata: { claimed: g.copies.length } })
  refresh(taskId)
  return { ok: true, message: `Claims closed. ${g.copies.length} contributor${g.copies.length === 1 ? '' : 's'} keep their copies.` }
}

/** Gives more time to claim (reopening the window from now if it had closed). */
export async function extendSharedTask(taskId: string, hours: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const g = await loadShared(taskId)
  if ('error' in g) return { ok: false, error: g.error }
  const next = extendedClose(g.task.claim_closes_at, hours)
  if ('error' in next) return { ok: false, error: next.error }
  const { error } = await community().from('tasks').update({ claim_closes_at: next.closesAt }).eq('id', taskId).eq('shared', true)
  if (error) return { ok: false, error: 'Could not extend the window.' }
  await auditPortal(auth.caller, { action: 'task.shared_extended', targetType: 'task', targetId: taskId, targetLabel: g.task.title, metadata: { closes_at: next.closesAt } })
  refresh(taskId)
  return { ok: true, message: `Claims are open until ${new Date(next.closesAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC.` }
}

/** Sets or clears the number of places. Never below those who already claimed. */
export async function setSharedCap(taskId: string, maxClaimers: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const g = await loadShared(taskId)
  if ('error' in g) return { ok: false, error: g.error }
  const cap = capRule(maxClaimers, g.copies.length)
  if ('error' in cap) return { ok: false, error: cap.error }
  const { error } = await community().from('tasks').update({ max_claimers: cap.maxClaimers }).eq('id', taskId).eq('shared', true)
  if (error) return { ok: false, error: 'Could not save the number of places.' }
  await auditPortal(auth.caller, { action: 'task.shared_cap', targetType: 'task', targetId: taskId, targetLabel: g.task.title, metadata: { max_claimers: cap.maxClaimers } })
  refresh(taskId)
  return { ok: true, message: cap.maxClaimers ? `Places limited to ${cap.maxClaimers}.` : 'No limit on places.' }
}

/** Saves the shared task's title, brief, links and tags to every copy nobody has submitted yet. */
export async function updateSharedCopies(taskId: string, raw: { title?: unknown; description?: unknown; category?: unknown; complexity?: unknown; links?: unknown; tags?: unknown }): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const parsed = parseTaskInput(raw)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  const tags = parseTags(raw.tags)
  if ('error' in tags) return { ok: false, error: tags.error }
  const g = await loadShared(taskId)
  if ('error' in g) return { ok: false, error: g.error }
  const ids = untouchedCopies(g.copies, g.withSubmission).map((c) => c.id)
  if (ids.length === 0) return { ok: false, error: 'No copy is waiting for work, so there is nothing to update.' }
  const f = parsed.fields
  const { data: saved, error } = await community().from('tasks')
    .update({ title: f.title, description: f.description, links: f.links.length > 0 ? f.links : null, primitives: tags.tags } as never)
    .in('id', ids).eq('status', 'assigned').eq('shared_from', taskId).select('id')
  if (error) return { ok: false, error: 'Could not update the copies.' }
  const n = (saved ?? []).length
  await auditPortal(auth.caller, { action: 'task.shared_copies_updated', targetType: 'task', targetId: taskId, targetLabel: f.title, metadata: { updated: n } })
  refresh(taskId)
  return { ok: true, message: `Updated ${n} cop${n === 1 ? 'y' : 'ies'}. Copies with submitted work keep the brief their owner worked from.` }
}

/** Withdraws every copy nobody has submitted work for. */
export async function withdrawSharedCopies(taskId: string, reason?: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const note = typeof reason === 'string' ? reason.trim() : ''
  if (note.length > REASON_MAX) return { ok: false, error: `Keep the note under ${REASON_MAX} characters.` }
  const g = await loadShared(taskId)
  if ('error' in g) return { ok: false, error: g.error }
  const ids = untouchedCopies(g.copies, g.withSubmission).map((c) => c.id)
  if (ids.length === 0) return { ok: false, error: 'Every copy has submitted work, so none can be withdrawn.' }
  return withdrawCopies(auth.caller, taskId, ids, note || null)
}
