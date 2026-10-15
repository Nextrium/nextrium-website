// How contributors are named and ranked on the public pages.

export interface Rankable {
  total_points: number
  verified_contributions: number
  name: string
}

/**
 * Most points first; equal points share a rank ("1, 2, 2, 4") and are listed
 * by more verified contributions, then name.
 */
export function rankContributors<T extends Rankable>(list: T[]): (T & { rank: number })[] {
  const sorted = [...list].sort(
    (a, b) => b.total_points - a.total_points || b.verified_contributions - a.verified_contributions || a.name.localeCompare(b.name),
  )
  let lastPoints: number | null = null
  let lastRank = 0
  return sorted.map((c, i) => {
    const rank = c.total_points === lastPoints ? lastRank : i + 1
    lastPoints = c.total_points
    lastRank = rank
    return { ...c, rank }
  })
}

/** The public name: a team's name for team accounts, otherwise the person's name. Never an email. */
export function publicName(c: { name: string; contributor_type: string | null; team_name: string | null }): string {
  const team = c.contributor_type === 'team' ? c.team_name?.trim() : ''
  return team || c.name.trim() || 'Contributor'
}

/** Width of a points bar as a share of the leader's points, never below 4% so it stays visible. */
export function barPercent(points: number, leaderPoints: number): number {
  if (!(leaderPoints > 0) || !(points > 0)) return 4
  return Math.max(4, Math.min(100, (points / leaderPoints) * 100))
}
