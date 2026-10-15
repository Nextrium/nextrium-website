'use server'

import { revalidatePath } from 'next/cache'
import { UUID, auditPortal, community, contributorName, notifyContributor, requirePortalStaff } from '@/lib/portal/server'
import { canDecideOnApplicant, isApplicantAction, planDecision, type ApplicantAction } from '@/lib/portal/applicantRules'
import {
  accountDeactivatedEmail,
  accountReactivatedEmail,
  applicationApprovedEmail,
  applicationRejectedEmail,
  revisionRequestedEmail,
} from '@/lib/portal/emails'

type Result = { ok: true; message: string } | { ok: false; error: string }

const AUDIT_ACTION: Record<ApplicantAction, string> = {
  approve: 'contributor.approved',
  request_revision: 'contributor.revision_requested',
  reject: 'contributor.rejected',
  deactivate: 'contributor.deactivated',
  reactivate: 'contributor.reactivated',
}

const DONE: Record<ApplicantAction, string> = {
  approve: 'Approved. The applicant has been emailed.',
  request_revision: 'Changes requested. The applicant has been emailed.',
  reject: 'Application not approved. The applicant has been emailed.',
  deactivate: 'Account deactivated.',
  reactivate: 'Account reactivated.',
}

/**
 * Applies one decision to an applicant. Staff only (checked here, not just
 * by the page gate); moderators cannot decide on their own application. The
 * update is conditional on the status the decision was planned from, so two
 * staff acting at once cannot both win.
 */
export async function decideApplicant(contributorId: string, action: string, note?: string): Promise<Result> {
  const auth = await requirePortalStaff()
  if ('error' in auth) return { ok: false, error: auth.error }
  const { caller } = auth
  if (!UUID.test(contributorId) || !isApplicantAction(action)) return { ok: false, error: 'Invalid request.' }

  const db = community()
  const { data: c, error: readError } = await db
    .from('contributors')
    .select('id, name, email, status, contributor_type, team_name')
    .eq('id', contributorId)
    .maybeSingle()
  if (readError) return { ok: false, error: 'Could not load the applicant. Try again.' }
  if (!c) return { ok: false, error: 'That applicant could not be found.' }
  if (!canDecideOnApplicant(caller, c.email)) return { ok: false, error: 'You cannot decide on your own application. An admin will.' }

  const plan = planDecision(action, c.status, note)
  if (!plan.ok) return { ok: false, error: plan.error }

  const { data: updated, error } = await db
    .from('contributors')
    .update(plan.update)
    .eq('id', c.id)
    .eq('status', c.status ?? '')
    .select('id')
  if (error) {
    console.error('[portal] applicant decision failed:', error.code)
    return { ok: false, error: 'The decision could not be saved. Try again.' }
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'This applicant changed meanwhile. Reload to see where they stand.' }

  const name = contributorName(c)
  const trimmed = typeof note === 'string' ? note.trim() : ''
  const email = {
    approve: applicationApprovedEmail(),
    request_revision: revisionRequestedEmail(trimmed),
    reject: applicationRejectedEmail(trimmed || null),
    deactivate: accountDeactivatedEmail(),
    reactivate: accountReactivatedEmail(),
  }[action]
  const emailed = await notifyContributor({ email: c.email, name }, email)

  await auditPortal(caller, {
    action: AUDIT_ACTION[action],
    targetType: 'contributor',
    targetId: c.id,
    targetLabel: name,
    metadata: { from: c.status, to: plan.to, ...(trimmed ? { note: trimmed } : {}), emailed },
  })

  revalidatePath('/portal')
  revalidatePath('/portal/applicants')
  revalidatePath(`/portal/applicants/${c.id}`)
  return { ok: true, message: emailed ? DONE[action] : `${DONE[action].split('.')[0]}. The email could not be sent; let them know another way.` }
}
