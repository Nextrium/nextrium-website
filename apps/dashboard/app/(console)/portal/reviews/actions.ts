'use server'

import { revalidatePath } from 'next/cache'
import { POINT_RANGES, isCategory, isComplexity, type Category, type Complexity } from '@nextrium/contributions-core/constants'
import { canPostThreadMessage, canRequestMoreChanges, parseMessageBody, type ThreadMessageKind } from '@nextrium/contributions-core/thread'
import { UUID, auditPortal, community, contributorName, notifyContributor, portalActor, requirePortalStaff, type Caller } from '@/lib/portal/server'
import { canDecideOnPortalSubmission, clampPoints, isDecidable, parseNote } from '@/lib/portal/reviewRules'
import { portalChangesRequestedEmail, portalRejectedEmail, portalStaffFeedbackEmail, portalVerifiedEmail } from '@/lib/portal/emails'

type Result = { ok: true; message: string } | { ok: false; error: string }
type ThreadResult = { ok: true } | { ok: false; error: string }

function refresh(id: string) {
  revalidatePath('/portal')
  revalidatePath('/portal/reviews')
  revalidatePath(`/portal/reviews/${id}`)
  revalidatePath('/portal/tasks')
}

async function recordPortalDecisionMessage(p: {
  contributionId: string
  submissionNumber: number
  caller: Caller
  actorName: string
  kind: Extract<ThreadMessageKind, 'decision_verified' | 'decision_changes' | 'decision_rejected'>
  body: string | null | undefined
}) {
  const clean = typeof p.body === 'string' ? p.body.trim() : ''
  if (!clean) return
  const db = community() as any
  const { error } = await db.from('contribution_messages').insert({
    contribution_id: p.contributionId,
    submission_number: p.submissionNumber || 1,
    author_role: 'staff',
    author_user_id: p.caller.userId,
    author_name: p.actorName,
    kind: p.kind,
    body: clean,
  })
  if (error) console.error('[portal] could not store decision message:', error.code)
}

/** Loads a submission and its contributor, checking permission for this caller. */
async function loadSubmission(caller: Caller, id: string, requireDecidable: boolean) {
  if (!UUID.test(id)) return { error: 'That submission could not be found.' } as const
  const db = community() as any
  const { data: s } = await db
    .from('contributions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!s || !s.contributor_id) return { error: 'That submission could not be found.' } as const
  const { data: c } = await db.from('contributors').select('id, name, email, contributor_type, team_name').eq('id', s.contributor_id).maybeSingle()
  if (!c) return { error: 'The contributor for this submission could not be found.' } as const
  if (!canDecideOnPortalSubmission(caller, c.email)) return { error: 'You cannot decide on your own submission. An admin will.' } as const
  if (requireDecidable && !isDecidable(s)) return { error: 'This submission has already been decided.' } as const
  return { s, c }
}

/** Verifies a submission and awards points within the task's range. The database adds them to the contributor's total. */
export async function verifyPortalSubmission(id: string, points: unknown, note?: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await loadSubmission(auth.caller, id, true)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s, c } = loaded
  const parsedNote = parseNote(note, false)
  if ('error' in parsedNote) return { ok: false, error: parsedNote.error }

  const db = community() as any
  const { data: task } = s.task_id ? await db.from('tasks').select('id, point_range_min, point_range_max').eq('id', s.task_id).maybeSingle() : { data: null }
  const cat: Category | null = typeof s.category === 'string' && isCategory(s.category) ? s.category : null
  const comp: Complexity | null = typeof s.complexity === 'string' && isComplexity(s.complexity) ? s.complexity : null
  const range = task ?? (cat && comp
    ? { point_range_min: POINT_RANGES[cat][comp].min, point_range_max: POINT_RANGES[cat][comp].max }
    : null)
  if (!range) return { ok: false, error: 'This submission has no point range to award within.' }
  const awarded = clampPoints(points, range.point_range_min, range.point_range_max)
  if (awarded === null) return { ok: false, error: 'Enter the points to award.' }

  const actor = await portalActor(auth.caller)
  const patch: Record<string, unknown> = {
    status: 'verified',
    final_points: awarded,
    notes: parsedNote.note,
    verified_at: new Date().toISOString(),
    verified_by: actor.coreTeamId,
    ...(s.revision_requested === true ? { revision_requested: false } : {}),
  }
  let q = db
    .from('contributions')
    .update(patch)
    .eq('id', s.id)
    .eq('status', s.status ?? '')
  if (s.status === 'rejected' && s.revision_requested !== true) q = q.is('notes', null)
  const { data: updated, error } = await q.select('id')
  if (error) {
    console.error('[portal] verify failed:', error.code)
    return { ok: false, error: 'Could not verify the submission.' }
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'This submission changed meanwhile. Reload to see it.' }

  if (s.task_id) {
    await db.from('tasks').update({ status: 'completed' }).eq('id', s.task_id).eq('assigned_to', c.id).eq('status', 'assigned')
  }
  if (parsedNote.note) {
    await recordPortalDecisionMessage({
      contributionId: s.id,
      submissionNumber: s.submission_count ?? 1,
      caller: auth.caller,
      actorName: actor.name,
      kind: 'decision_verified',
      body: parsedNote.note,
    })
  }
  const emailed = await notifyContributor({ email: c.email, name: contributorName(c) }, portalVerifiedEmail({ title: s.title, points: awarded, note: parsedNote.note, contributionId: s.id }))
  await auditPortal(auth.caller, { action: 'contribution.verified', targetType: 'contribution', targetId: s.id, targetLabel: s.title, metadata: { points: awarded, contributor: contributorName(c), from: s.status, emailed } })
  refresh(s.id)
  return { ok: true, message: `Verified. ${awarded} points awarded to ${contributorName(c)}.` }
}

/** Sends the submission back to the contributor with written feedback so they can resubmit (up to 3 attempts total). */
export async function requestPortalChanges(id: string, note: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await loadSubmission(auth.caller, id, true)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s, c } = loaded
  const parsedNote = parseNote(note, true)
  if ('error' in parsedNote) return { ok: false, error: parsedNote.error }
  if (!canRequestMoreChanges(s.submission_count ?? 1)) {
    return { ok: false, error: 'This contributor has already used all 3 submission attempts. Verify or do not accept instead.' }
  }

  const db = community() as any
  const actor = await portalActor(auth.caller)
  let q = db
    .from('contributions')
    .update({ status: 'rejected', notes: parsedNote.note, revision_requested: true })
    .eq('id', s.id)
    .eq('status', s.status ?? '')
  if (s.status === 'rejected' && s.revision_requested !== true) q = q.is('notes', null)
  const { data: updated, error } = await q.select('id')
  if (error) {
    console.error('[portal] request changes failed:', error.code)
    return { ok: false, error: 'Could not request changes right now.' }
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'This submission changed meanwhile. Reload to see it.' }

  // Restore task to 'assigned' so the contributor can resubmit from their running tasks.
  if (s.task_id) {
    await db
      .from('tasks')
      .update({ status: 'assigned' })
      .eq('id', s.task_id)
      .eq('assigned_to', c.id)
      .in('status', ['assigned', 'completed'])
  }
  await recordPortalDecisionMessage({
    contributionId: s.id,
    submissionNumber: s.submission_count ?? 1,
    caller: auth.caller,
    actorName: actor.name,
    kind: 'decision_changes',
    body: parsedNote.note,
  })
  const emailed = await notifyContributor(
    { email: c.email, name: contributorName(c) },
    portalChangesRequestedEmail({ title: s.title, note: parsedNote.note!, contributionId: s.id }),
  )
  await auditPortal(auth.caller, { action: 'contribution.changes_requested', targetType: 'contribution', targetId: s.id, targetLabel: s.title, metadata: { contributor: contributorName(c), from: s.status, emailed } })
  refresh(s.id)
  return { ok: true, message: 'Changes requested. The contributor has been emailed your feedback.' }
}

/** Rejects a submission for good, with a note. The task goes back to the open board. */
export async function rejectPortalSubmission(id: string, note: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await loadSubmission(auth.caller, id, true)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s, c } = loaded
  const parsedNote = parseNote(note, true)
  if ('error' in parsedNote) return { ok: false, error: parsedNote.error }

  const db = community() as any
  const actor = await portalActor(auth.caller)
  const patch: Record<string, unknown> = {
    status: 'rejected',
    notes: parsedNote.note,
    ...(s.revision_requested === true ? { revision_requested: false } : {}),
  }
  let q = db.from('contributions').update(patch).eq('id', s.id).eq('status', s.status ?? '')
  if (s.status === 'rejected' && s.revision_requested !== true) q = q.is('notes', null)
  const { data: updated, error } = await q.select('id')
  if (error) return { ok: false, error: 'Could not save the decision.' }
  if (!updated || updated.length === 0) return { ok: false, error: 'This submission changed meanwhile. Reload to see it.' }

  if (s.task_id) {
    await db
      .from('tasks')
      .update({ status: 'open', assigned_to: null, claimed_at: null, deadline_at: null, extension_granted: false, extension_requested_at: null, extended_deadline_at: null })
      .eq('id', s.task_id)
      .eq('assigned_to', c.id)
      .in('status', ['assigned', 'completed'])
  }
  await recordPortalDecisionMessage({
    contributionId: s.id,
    submissionNumber: s.submission_count ?? 1,
    caller: auth.caller,
    actorName: actor.name,
    kind: 'decision_rejected',
    body: parsedNote.note,
  })
  const emailed = await notifyContributor({ email: c.email, name: contributorName(c) }, portalRejectedEmail({ title: s.title, note: parsedNote.note!, contributionId: s.id }))
  await auditPortal(auth.caller, { action: 'contribution.rejected', targetType: 'contribution', targetId: s.id, targetLabel: s.title, metadata: { contributor: contributorName(c), from: s.status, note: parsedNote.note, emailed } })
  refresh(s.id)
  return { ok: true, message: 'Submission not accepted. The task is back on the open board.' }
}

/** Posts a standalone staff feedback message or reply on a portal submission thread and emails the contributor. */
export async function postPortalStaffFeedback(contributionId: string, body: string): Promise<ThreadResult> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await loadSubmission(auth.caller, contributionId, false)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s, c } = loaded
  const parsed = parseMessageBody(body)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const db = community() as any
  const { count } = await db.from('contribution_messages').select('id', { count: 'exact', head: true }).eq('contribution_id', s.id)
  const gate = canPostThreadMessage({
    authorRole: 'staff',
    isOwner: false,
    threadClosed: !!s.thread_closed_at,
    messageCount: count ?? 0,
  })
  if (!gate.ok) return { ok: false, error: gate.error }

  const actor = await portalActor(auth.caller)
  const { error } = await db.from('contribution_messages').insert({
    contribution_id: s.id,
    submission_number: s.submission_count ?? 1,
    author_role: 'staff',
    author_user_id: auth.caller.userId,
    author_name: actor.name,
    kind: 'feedback',
    body: parsed.body,
  })
  if (error) {
    console.error('[portal] postPortalStaffFeedback failed:', error.code)
    return { ok: false, error: 'Could not send your feedback right now. Please try again.' }
  }

  const emailed = await notifyContributor(
    { email: c.email, name: contributorName(c) },
    portalStaffFeedbackEmail({ title: s.title, authorName: actor.name, body: parsed.body, contributionId: s.id }),
  )
  await auditPortal(auth.caller, { action: 'contribution.feedback_posted', targetType: 'contribution', targetId: s.id, targetLabel: s.title, metadata: { contributor: contributorName(c), emailed } })
  refresh(s.id)
  return { ok: true }
}

/** Closes or reopens a portal submission conversation thread. */
export async function togglePortalThreadClosed(contributionId: string, closed: boolean): Promise<ThreadResult> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await loadSubmission(auth.caller, contributionId, false)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s } = loaded

  const db = community() as any
  const { error } = await db
    .from('contributions')
    .update({
      thread_closed_at: closed ? new Date().toISOString() : null,
      thread_closed_by: closed ? auth.caller.userId : null,
    })
    .eq('id', s.id)
  if (error) {
    console.error('[portal] togglePortalThreadClosed failed:', error.code)
    return { ok: false, error: 'Could not update the conversation status.' }
  }

  await auditPortal(auth.caller, { action: closed ? 'contribution.thread_closed' : 'contribution.thread_reopened', targetType: 'contribution', targetId: s.id, targetLabel: s.title })
  refresh(s.id)
  return { ok: true }
}
