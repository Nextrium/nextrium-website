'use server'

import { revalidatePath } from 'next/cache'
import { UUID, auditPortal, community, contributorName, requirePortalStaff } from '@/lib/portal/server'
import { MAX_CLAIMS_RANGE, parseMaxClaims } from '@/lib/portal/teamRules'

type Result = { ok: true; message: string } | { ok: false; error: string }

/** Sets how many tasks a contributor may run at once. Admins only. */
export async function setMaxClaims(contributorId: string, value: unknown): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  if (auth.caller.role !== 'admin') return { ok: false, error: 'Only admins can change running-task limits.' }
  if (!UUID.test(contributorId)) return { ok: false, error: 'That contributor could not be found.' }
  const n = parseMaxClaims(value)
  if (n === null) return { ok: false, error: `Choose a limit from ${MAX_CLAIMS_RANGE.min} to ${MAX_CLAIMS_RANGE.max}.` }

  const db = community()
  const { data: c } = await db.from('contributors').select('id, name, contributor_type, team_name, max_claims').eq('id', contributorId).maybeSingle()
  if (!c) return { ok: false, error: 'That contributor could not be found.' }
  if ((c.max_claims ?? 2) === n) return { ok: true, message: 'No change.' }
  const { error } = await db.from('contributors').update({ max_claims: n }).eq('id', contributorId)
  if (error) return { ok: false, error: 'Could not save the limit.' }
  await auditPortal(auth.caller, { action: 'contributor.max_claims_changed', targetType: 'contributor', targetId: c.id, targetLabel: contributorName(c), metadata: { from: c.max_claims ?? 2, to: n } })
  revalidatePath('/portal/contributors')
  revalidatePath(`/portal/applicants/${contributorId}`)
  return { ok: true, message: `${contributorName(c)} can now run ${n} task${n === 1 ? '' : 's'} at once.` }
}
