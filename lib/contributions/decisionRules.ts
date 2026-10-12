// Who may decide (verify, request changes, reject) on a submission.
// Admins may decide on any submission, including their own. Moderators may
// decide on anyone's except their own, so nobody below admin can award
// themselves points. Everyone else never decides.
export function canDecideOnSubmission(
  caller: { userId: string; role: string },
  contributorId: string | null | undefined,
): boolean {
  if (caller.role === 'admin') return true
  if (caller.role === 'moderator') return !!contributorId && contributorId !== caller.userId
  return false
}

export const OWN_SUBMISSION_MESSAGE = 'You cannot review your own submission. An admin will review it.'
