import { getVerifiedDashboardRole, type DashboardRole } from './getRole'

// Who may run which dashboard actions. These mirror the page-level access
// lists in accessControl.ts: staff pages are admin + moderator, and the
// settings/logs pages are admin only.
export const STAFF_ROLES: DashboardRole[] = ['admin', 'moderator']
export const ADMIN_ONLY: DashboardRole[] = ['admin']

/**
 * Call at the top of every server action that isn't open to all signed-in
 * accounts. Returns an error message when the caller (identity verified
 * with the auth server, role read fresh from the database) is not in
 * `allowed`, or null when they are. Server actions can be invoked outside
 * the page that renders them, so the page's middleware gate is not enough.
 */
export async function roleDenial(allowed: DashboardRole[]): Promise<string | null> {
  const role = await getVerifiedDashboardRole()
  return allowed.includes(role) ? null : 'You do not have permission to do this.'
}
