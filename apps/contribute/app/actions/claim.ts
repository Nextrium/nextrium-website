'use server'

import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { getActiveContributor } from '@/lib/portal'
import { isUuid } from '@/lib/publicData'
import { DEFAULT_MAX_CLAIMS, cooldownHoursLeft, cooldownMessage, limitMessage } from '@/lib/claims'
import { sharedClaimMessage } from '@/lib/sharedTasks'

export type ClaimState =
  | { status: 'idle' }
  | { status: 'claimed'; title: string; shared?: boolean }
  | { status: 'error'; message: string }

/**
 * Claims an open task for the signed-in, approved contributor. claim_task
 * decides atomically (first come, first served) and enforces the cooldown
 * and the running-task limit; this action only passes the verified
 * contributor and explains a refusal.
 */
export async function claimTask(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const taskId = formData.get('taskId')
  if (!isUuid(taskId)) return { status: 'error', message: 'This task could not be found.' }

  const me = await getActiveContributor()
  if (!me) return { status: 'error', message: 'Only approved contributors can claim tasks. Sign in, or check your application status on your dashboard.' }

  const db = createCommunityServiceClient()

  // A shared task: the claim creates this contributor's own copy.
  const { data: kind } = await db.from('tasks').select('title, shared').eq('id', taskId).maybeSingle()
  if (kind?.shared) {
    const { data: copyId, error: sharedError } = await db.rpc('claim_shared_task', { p_task_id: taskId, p_contributor_id: me.id })
    if (sharedError || !copyId) {
      let maxClaims: number | undefined
      if (/claim_limit_reached/.test(sharedError?.message ?? '')) {
        const { data: row } = await db.from('contributors').select('max_claims').eq('id', me.id).maybeSingle()
        maxClaims = row?.max_claims ?? DEFAULT_MAX_CLAIMS
      } else if (sharedError) console.error('[contribute] shared claim refused:', sharedError.message.slice(0, 80))
      return { status: 'error', message: sharedClaimMessage(sharedError?.message, { maxClaims }) }
    }
    return { status: 'claimed', title: kind.title, shared: true }
  }

  const { data: claimed, error } = await db.rpc('claim_task', {
    task_id: taskId,
    contributor_id: me.id,
    // Required by the function's signature but ignored: the deadline comes from the task.
    deadline_days_val: 0,
    deadline_at_val: new Date().toISOString(),
  })

  if (error) {
    if (/claim_limit_reached/.test(error.message)) {
      const { data: row } = await db.from('contributors').select('max_claims').eq('id', me.id).maybeSingle()
      return { status: 'error', message: limitMessage(row?.max_claims ?? DEFAULT_MAX_CLAIMS) }
    }
    console.error('[contribute] claim failed:', error.code)
    return { status: 'error', message: 'The task could not be claimed. Try again in a moment.' }
  }

  const { data: task } = await db.from('tasks').select('title, status, assigned_to, unclaimed_by, unclaimed_at').eq('id', taskId).maybeSingle()

  if (claimed === true && task?.assigned_to === me.id) return { status: 'claimed', title: task.title }
  if (!task) return { status: 'error', message: 'This task could not be found.' }
  if (task.status !== 'open') return { status: 'error', message: 'This task was just claimed by someone else.' }
  const hours = cooldownHoursLeft(task, me.id)
  if (hours > 0) return { status: 'error', message: cooldownMessage(hours) }
  return { status: 'error', message: 'The task could not be claimed. Try again in a moment.' }
}
