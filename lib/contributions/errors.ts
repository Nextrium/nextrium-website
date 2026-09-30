// The database functions raise short codes; turn them into messages staff
// and members can act on. Unknown errors get a generic message (the detail
// is logged on the server, never shown).
const MESSAGES: Record<string, string> = {
  task_not_found: 'That task could not be found.',
  task_not_assignable: 'Only draft or assigned tasks can be assigned.',
  task_not_assigned: 'That task is not assigned.',
  task_has_submission: 'This task already has a submission, so it can no longer be reassigned or unassigned.',
  assignee_not_active_member: 'Tasks can only be assigned to active members (onboarded and not archived).',
  deadline_in_past: 'The deadline must be in the future.',
  task_not_open: 'This task is not open for that.',
  extension_already_used: 'An extension has already been requested for this task.',
  deadline_passed: 'The deadline has passed.',
  no_extension_requested: 'There is no pending extension request.',
  contribution_not_found: 'That submission could not be found.',
}

export function describeDbError(error: { message?: string } | null | undefined, fallback = 'Something went wrong. Please try again.'): string {
  const code = error?.message?.trim() ?? ''
  return MESSAGES[code] ?? fallback
}
