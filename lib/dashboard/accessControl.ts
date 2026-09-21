// Single source of truth for which dashboard roles can reach which
// /dashboard paths. Shared by proxy.ts (page-level middleware) and any API
// route that needs the same decision (e.g. /api/email) — duplicating this
// list per-caller risks the two silently drifting apart over time.
export const BLOCKED_PATHS: Record<string, string[]> = {
  admin: [],
  content: [
    '/dashboard/applications',
    '/dashboard/contact',
    '/dashboard/email',
    '/dashboard/roles',
    '/dashboard/team',
    '/dashboard/settings',
  ],
  community: [
    '/dashboard/applications',
    '/dashboard/contact',
    '/dashboard/email',
    '/dashboard/roles',
    '/dashboard/team',
    '/dashboard/settings',
    '/dashboard/posts',
    '/dashboard/products',
  ],
  // Full access except the two pages that would let a moderator change
  // their own (or anyone's) access level, or see internal processing logs.
  moderator: [
    '/dashboard/settings/team',
    '/dashboard/logs',
  ],
  // Pseudo-role for a staff member whose dashboard_users row has been
  // archived (see Sprint 4 of the archive feature) — blocks the entire
  // /dashboard tree, not just specific pages.
  archived: ['/dashboard'],
}

// member is the one role that needs "deny everything except X" instead of
// "allow everything except X" — a blocklist would have to enumerate every
// current and future admin page to stay safe, and silently under-block any
// new page added later. Listed here, isRestricted treats the role as
// allowlisted instead of falling through to BLOCKED_PATHS.
export const ALLOWED_PATHS: Record<string, string[]> = {
  member: ['/dashboard/people'],
}

export function isRestricted(pathname: string, role: string): boolean {
  const allowed = ALLOWED_PATHS[role]
  if (allowed) {
    return !allowed.some((path) => pathname.startsWith(path))
  }
  const blocked = BLOCKED_PATHS[role] ?? BLOCKED_PATHS['community']
  return blocked.some((path) => pathname.startsWith(path))
}
