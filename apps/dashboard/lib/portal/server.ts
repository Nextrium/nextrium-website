import { brand } from '@nextrium/brand'
import { sendEmail } from '@nextrium/email/send'
import type { EmailContent } from '@nextrium/contributions-core/emails'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { logActivity } from '@/lib/activityLog'
import { requireStaff, type Caller } from '@/lib/contributions/auth'

// Server-side helpers for the contributor portal section. The portal's data
// lives in the community database; staff identity comes from this
// dashboard's session (requireStaff), never from the browser.

export { requireStaff as requirePortalStaff }
export type { Caller }

export const community = () => createCommunityServiceClient()

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The caller's core team record in the community database (matched by email), if they have one. */
async function coreTeamFor(caller: Caller): Promise<{ id: string; name: string } | null> {
  if (!caller.email) return null
  const { data } = await community().from('core_team').select('id, name, email').eq('is_active', true)
  const wanted = caller.email.toLowerCase()
  const row = (data ?? []).find((r) => r.email.toLowerCase() === wanted)
  return row ? { id: row.id, name: row.name } : null
}

/** Who acted, for audit rows and verified_by: their core team record when they have one. */
export async function portalActor(caller: Caller): Promise<{ coreTeamId: string | null; name: string }> {
  const ct = await coreTeamFor(caller)
  return { coreTeamId: ct?.id ?? null, name: ct?.name ?? caller.email ?? 'Dashboard staff' }
}

/**
 * Records a portal decision in the community audit log (the program's own
 * history) and in this dashboard's team activity log. Never throws: a
 * logging problem must not undo the action it describes.
 */
export async function auditPortal(caller: Caller, entry: {
  action: string
  targetType: 'contributor' | 'task' | 'contribution' | 'core_team'
  targetId: string
  targetLabel: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const actor = await portalActor(caller)
    const { error } = await community().from('admin_audit_log').insert({
      actor_id: actor.coreTeamId,
      actor_name: actor.name,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      target_label: entry.targetLabel.slice(0, 300),
      metadata: { ...(entry.metadata ?? {}), via: 'dashboard', staff_email: caller.email } as never,
    })
    if (error) console.error('[portal] audit insert failed:', error.code)
  } catch (err) {
    console.error('[portal] audit failed:', err)
  }
  await logActivity({
    action: `portal.${entry.action}`,
    targetType: `portal_${entry.targetType}`,
    targetId: entry.targetId,
    details: { label: entry.targetLabel, ...(entry.metadata ?? {}) },
    actorId: caller.userId,
    actorEmail: caller.email ?? undefined,
  })
}

/**
 * Emails one portal contributor from the contributor program's sender.
 * Never throws; returns whether it was sent.
 */
export async function notifyContributor(to: { email: string; name: string }, content: EmailContent): Promise<boolean> {
  try {
    const { results } = await sendEmail({
      senderEmail: brand.emails.contributors,
      subject: content.subject,
      message: content.html,
      recipients: [{ email: to.email, name: to.name }],
      sentBy: 'contributor_portal',
    })
    return results.some((r) => r.success)
  } catch (err) {
    console.error('[portal] email failed:', err)
    return false
  }
}

/** The name a contributor is addressed by: the team name for team accounts. */
export function contributorName(c: { name: string; contributor_type: string | null; team_name: string | null }): string {
  return (c.contributor_type === 'team' && c.team_name?.trim()) || c.name.trim() || 'Contributor'
}
