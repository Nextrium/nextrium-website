// Who may see whose profile in the Team directory.
//   admin      everyone
//   moderator  team members only (never admins or other moderators)
//   others     their own profile only
// Applied on the server, to the list and to each profile, so the data never
// reaches a browser that isn't allowed to see it.
const DIRECTORY_ROLES = ['admin', 'moderator']
const PROFILE_ROLES = ['admin', 'moderator', 'content', 'community', 'member']

export interface PersonRef {
  userId: string
  role: string
  isTeamMember: boolean
}

export function canSeeDirectory(viewerRole: string): boolean {
  return DIRECTORY_ROLES.includes(viewerRole)
}

export function canViewPerson(viewer: { userId: string; role: string }, target: PersonRef): boolean {
  if (!PROFILE_ROLES.includes(viewer.role)) return false
  if (viewer.userId === target.userId) return true
  if (viewer.role === 'admin') return true
  if (viewer.role === 'moderator') {
    return target.isTeamMember && target.role !== 'admin' && target.role !== 'moderator'
  }
  return false
}
