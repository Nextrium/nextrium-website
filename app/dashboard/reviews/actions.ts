'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'
import { requireStaff } from '@/lib/contributions/auth'
import { describeDbError } from '@/lib/contributions/errors'

type Result = { ok: true } | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTES_MAX = 4000
const db = () => createServiceClient() as any

function revalidate(contributionId: string) {
  revalidatePath('/dashboard/reviews')
  revalidatePath(`/dashboard/reviews/${contributionId}`)
  revalidatePath('/dashboard/my-tasks')
  revalidatePath('/dashboard/tasks')
}

async function log(action: string, contributionId: string, details: Record<string, unknown>, caller: { userId: string; email: string | null }) {
  await logActivity({
    action, targetType: 'contribution', targetId: contributionId, details,
    actorId: caller.userId, actorEmail: caller.email ?? undefined,
  })
}

/**
 * Verifies a contribution and awards points. The database function clamps
 * the base points to the task's range, applies the timing multiplier on the
 * server clock, writes the ledger and completes the task — idempotently.
 */
export async function verifyContribution(contributionId: string, basePoints: number, notes?: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }
  if (!Number.isInteger(basePoints) || basePoints < 0) return { ok: false, error: 'Choose the base points to award.' }

  const { data, error } = await db().rpc('verify_contribution', {
    p_contribution_id: contributionId, p_actor: auth.caller.userId, p_base_points: basePoints,
    p_notes: notes?.trim() ? notes.trim().slice(0, NOTES_MAX) : null,
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not verify the submission.') }

  await log('contribution_verified', contributionId, { title: data.title, points: data.final_points }, auth.caller)
  revalidate(contributionId)
  return { ok: true }
}

/** Sends the submission back to the member with a note; they can resubmit. */
export async function requestChanges(contributionId: string, notes: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }

  const { data, error } = await db().rpc('request_contribution_changes', {
    p_contribution_id: contributionId, p_actor: auth.caller.userId, p_notes: (notes ?? '').slice(0, NOTES_MAX),
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not request changes.') }

  await log('contribution_changes_requested', contributionId, { title: data.title }, auth.caller)
  revalidate(contributionId)
  return { ok: true }
}

/** Rejects the submission (final, no points) and cancels the task. */
export async function rejectContribution(contributionId: string, notes: string): Promise<Result> {
  const auth = await requireStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (!UUID.test(contributionId)) return { ok: false, error: 'That submission could not be found.' }

  const { data, error } = await db().rpc('reject_contribution', {
    p_contribution_id: contributionId, p_actor: auth.caller.userId, p_notes: (notes ?? '').slice(0, NOTES_MAX),
  })
  if (error || !data) return { ok: false, error: describeDbError(error, 'Could not reject the submission.') }

  await log('contribution_rejected', contributionId, { title: data.title }, auth.caller)
  revalidate(contributionId)
  return { ok: true }
}
