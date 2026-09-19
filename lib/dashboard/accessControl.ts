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
}

export function isRestricted(pathname: string, role: string): boolean {
  const blocked = BLOCKED_PATHS[role] ?? BLOCKED_PATHS['community']
  return blocked.some((path) => pathname.startsWith(path))
}
