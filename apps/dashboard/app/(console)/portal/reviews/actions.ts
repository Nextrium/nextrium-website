'use server'

import { revalidatePath } from 'next/cache'
import { POINT_RANGES, isCategory, isComplexity } from '@nextrium/contributions-core/constants'
import { UUID, auditPortal, community, contributorName, notifyContributor, portalActor, requirePortalStaff, type Caller } from '@/lib/portal/server'
import { canDecideOnPortalSubmission, clampPoints, isDecidable, parseNote } from '@/lib/portal/reviewRules'
import { portalRejectedEmail, portalVerifiedEmail } from '@/lib/portal/emails'

type Result = { ok: true; message: string } | { ok: false; error: string }

function refresh(id: string) {
  revalidatePath('/portal')
  revalidatePath('/portal/reviews')
  revalidatePath(`/portal/reviews/${id}`)
  revalidatePath('/portal/tasks')
}

/** Loads a submission and checks this caller may decide on it now. */
async function load(caller: Caller, id: string) {
  if (!UUID.test(id)) return { error: 'That submission could not be found.' } as const
  const db = community()
  const { data: s } = await db
    .from('contributions')
    .select('id, contributor_id, task_id, title, status, notes, submission_count, category, complexity')
    .eq('id', id)
    .maybeSingle()
  if (!s || !s.contributor_id) return { error: 'That submission could not be found.' } as const
  const { data: c } = await db.from('contributors').select('id, name, email, contributor_type, team_name').eq('id', s.contributor_id).maybeSingle()
  if (!c) return { error: 'The contributor for this submission could not be found.' } as const
  if (!canDecideOnPortalSubmission(caller, c.email)) return { error: 'You cannot decide on your own submission. An admin will.' } as const
  if (!isDecidable(s)) return { error: 'This submission has already been decided.' } as const
  return { s, c }
}

/** Verifies a submission and awards points within the task's range. The database adds them to the contributor's total. */
export async function verifyPortalSubmission(id: string, points: unknown, note?: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await load(auth.caller, id)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s, c } = loaded
  const parsedNote = parseNote(note, false)
  if ('error' in parsedNote) return { ok: false, error: parsedNote.error }

  const db = community()
  const { data: task } = s.task_id ? await db.from('tasks').select('id, point_range_min, point_range_max').eq('id', s.task_id).maybeSingle() : { data: null }
  const range = task ?? (isCategory(s.category) && isComplexity(s.complexity)
    ? { point_range_min: POINT_RANGES[s.category][s.complexity].min, point_range_max: POINT_RANGES[s.category][s.complexity].max }
    : null)
  if (!range) return { ok: false, error: 'This submission has no point range to award within.' }
  const awarded = clampPoints(points, range.point_range_min, range.point_range_max)
  if (awarded === null) return { ok: false, error: 'Enter the points to award.' }

  const actor = await portalActor(auth.caller)
  let q = db
    .from('contributions')
    .update({ status: 'verified', final_points: awarded, notes: parsedNote.note, verified_at: new Date().toISOString(), verified_by: actor.coreTeamId })
    .eq('id', s.id)
    .eq('status', s.status ?? '')
  if (s.status === 'rejected') q = q.is('notes', null)
  const { data: updated, error } = await q.select('id')
  if (error) {
    console.error('[portal] verify failed:', error.code)
    return { ok: false, error: 'Could not verify the submission.' }
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'This submission changed meanwhile. Reload to see it.' }

  if (s.task_id) {
    await db.from('tasks').update({ status: 'completed' }).eq('id', s.task_id).eq('assigned_to', c.id).eq('status', 'assigned')
  }
  const emailed = await notifyContributor({ email: c.email, name: contributorName(c) }, portalVerifiedEmail({ title: s.title, points: awarded, note: parsedNote.note, contributionId: s.id }))
  await auditPortal(auth.caller, { action: 'contribution.verified', targetType: 'contribution', targetId: s.id, targetLabel: s.title, metadata: { points: awarded, contributor: contributorName(c), from: s.status, emailed } })
  refresh(s.id)
  return { ok: true, message: `Verified. ${awarded} points awarded to ${contributorName(c)}.` }
}

/** Rejects a submission for good, with a note. The task goes back to the open board. */
export async function rejectPortalSubmission(id: string, note: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const loaded = await load(auth.caller, id)
  if ('error' in loaded) return { ok: false, error: loaded.error as string }
  const { s, c } = loaded
  const parsedNote = parseNote(note, true)
  if ('error' in parsedNote) return { ok: false, error: parsedNote.error }

  const db = community()
  let q = db.from('contributions').update({ status: 'rejected', notes: parsedNote.note }).eq('id', s.id).eq('status', s.status ?? '')
  if (s.status === 'rejected') q = q.is('notes', null)
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
  const emailed = await notifyContributor({ email: c.email, name: contributorName(c) }, portalRejectedEmail({ title: s.title, note: parsedNote.note!, contributionId: s.id }))
  await auditPortal(auth.caller, { action: 'contribution.rejected', targetType: 'contribution', targetId: s.id, targetLabel: s.title, metadata: { contributor: contributorName(c), from: s.status, note: parsedNote.note, emailed } })
  refresh(s.id)
  return { ok: true, message: 'Submission not accepted. The task is back on the open board.' }
}
