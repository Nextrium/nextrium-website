const ROLE_BADGES: Record<string, string> = {
  admin: 'Admin',
  moderator: 'Moderator',
  content: 'Content',
  community: 'Community',
  member: 'Member',
}

/** Text for the sidebar badge beside the logo; null for any role without one. */
export function roleBadgeLabel(role: string | null | undefined): string | null {
  return (role && Object.hasOwn(ROLE_BADGES, role)) ? ROLE_BADGES[role] : null
}
