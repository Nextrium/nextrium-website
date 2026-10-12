// Leaderboard ranking. Pure, so ranking and tie rules are tested in one place.

export interface LeaderboardEntry {
  userId: string
  name: string
  points: number
  verified: number
}

export interface RankedEntry extends LeaderboardEntry {
  rank: number
}

/**
 * Highest points first; ties share a rank ("1, 2, 2, 4") and are listed by
 * more verified contributions, then name. People with no points are left
 * off so the board shows contributors only.
 */
export function rankLeaderboard(entries: LeaderboardEntry[]): RankedEntry[] {
  const sorted = entries
    .filter((e) => e.points > 0)
    .sort((a, b) => b.points - a.points || b.verified - a.verified || a.name.localeCompare(b.name))
  let lastPoints = -1
  let lastRank = 0
  return sorted.map((e, i) => {
    const rank = e.points === lastPoints ? lastRank : i + 1
    lastPoints = e.points
    lastRank = rank
    return { ...e, rank }
  })
}

/** Name shown on the leaderboard: the contributor's chosen display name, never derived from their email. */
export function leaderboardName(displayName: string | null | undefined): string {
  return displayName?.trim() || 'Unnamed contributor'
}

/** Greeting name for emails sent to the person themselves: the part of their email before "@". */
export function displayNameFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0]?.trim()
  return local || 'Member'
}

export interface LeaderboardStats {
  contributors: number
  points: number
  verified: number
}

/** Totals for the stats strip, over the people shown on the board. */
export function leaderboardStats(entries: Pick<LeaderboardEntry, 'points' | 'verified'>[]): LeaderboardStats {
  return entries.reduce<LeaderboardStats>(
    (acc, e) => ({ contributors: acc.contributors + 1, points: acc.points + e.points, verified: acc.verified + e.verified }),
    { contributors: 0, points: 0, verified: 0 },
  )
}

/** Width of a card's points bar, as a percentage of the leader's points (never below 4%, so it stays visible). */
export function pointsBarPercent(points: number, leaderPoints: number): number {
  if (!(leaderPoints > 0) || !(points > 0)) return 4
  return Math.max(4, Math.min(100, Math.round((points / leaderPoints) * 100)))
}
