/**
 * True when staff already asked for changes on this submission (a repeated click).
 * The automated review also sets changes_requested; staff adding their own note
 * on top of that is a new request, not a repeat.
 */
export async function staffAlreadyRequestedChanges(db: any, contributionId: string): Promise<boolean> {
  const { data: c } = await db.from('contributions').select('status, latest_review_id').eq('id', contributionId).maybeSingle()
  if (c?.status !== 'changes_requested' || !c.latest_review_id) return false
  const { data: r } = await db.from('contribution_reviews').select('source').eq('id', c.latest_review_id).maybeSingle()
  return r?.source === 'staff'
}
