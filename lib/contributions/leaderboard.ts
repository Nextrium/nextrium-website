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

/** Display name used across the dashboard: the part of the email before "@". */
export function displayNameFromEmail(email: string | null | undefined): string {
  const local = (email ?? '').split('@')[0]?.trim()
  return local || 'Member'
}
