// Single source of truth for which dashboard roles can reach which
// /dashboard paths. Shared by proxy.ts (page-level middleware) and any API
// route that needs the same decision (e.g. /api/email) — duplicating this
// list per-caller risks the two silently drifting apart over time.
export const BLOCKED_PATHS: Record<string, string[]> = {
  admin: [],
  // logs and ai-engine are hidden from these roles in the sidebar
  // (admin/moderator only) but were never blocked here, so the UI promised
  // more than this list enforced.
  content: [
    '/dashboard/applications',
    '/dashboard/contact',
    '/dashboard/email',
    '/dashboard/roles',
    '/dashboard/team',
    '/dashboard/settings',
    '/dashboard/logs',
    '/dashboard/ai-engine',
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
    '/dashboard/logs',
    '/dashboard/ai-engine',
  ],
  // Full access except the two pages that would let a moderator change
  // their own (or anyone's) access level, or see internal processing logs.
  moderator: [
    '/dashboard/settings/team',
    '/dashboard/settings/automations',
    '/dashboard/logs',
  ],
  // Pseudo-role for a staff member whose dashboard_users row has been
  // archived (see Sprint 4 of the archive feature) — blocks the entire
  // /dashboard tree, not just specific pages.
  archived: ['/dashboard'],
  // Pseudo-role for a signed-in account with no dashboard_users row at all
  // (never granted access). Blocks the whole tree, same as archived.
  none: ['/dashboard'],
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
  // An unrecognised role is denied outright. This used to fall back to the
  // community blocklist, which meant any role string this file didn't know
  // about silently received community-level access.
  const blocked = BLOCKED_PATHS[role]
  if (!blocked) return true
  return blocked.some((path) => pathname.startsWith(path))
}
