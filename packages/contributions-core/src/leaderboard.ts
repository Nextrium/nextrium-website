// Leaderboard ranking. Pure, so ranking and tie rules are tested in one place.

export interface LeaderboardEntry {
  userId: string
  name: string
  points: number
  verified: number
  /** When the person submitted the work that brought them to this score (their latest counted submission). */
  reachedAt?: string | null
  /** When they submitted their earliest counted work. */
  firstAt?: string | null
}

export interface RankedEntry extends LeaderboardEntry {
  rank: number
  /** True when someone else has the same points, so submission time decided the order. */
  tied: boolean
}

/** Shown on the leaderboard so everyone knows how equal scores are ordered. */
export const TIE_RULE = 'Equal points: whoever submitted the work that brought them to that score first ranks higher. Submission time counts, not when the team verified it.'

const time = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : Infinity
}

/**
 * Every person gets their own position (1, 2, 3, ...). Highest points first;
 * equal points are ordered by who submitted the work that brought them to that
 * score first, then more verified contributions, then the earlier first
 * submission, then name. People with no points are left off.
 */
export function rankLeaderboard(entries: LeaderboardEntry[]): RankedEntry[] {
  const sorted = entries
    .filter((e) => e.points > 0)
    .sort((a, b) =>
      b.points - a.points
      || time(a.reachedAt) - time(b.reachedAt)
      || b.verified - a.verified
      || time(a.firstAt) - time(b.firstAt)
      || a.name.localeCompare(b.name)
      || a.userId.localeCompare(b.userId))
  const counts = new Map<number, number>()
  for (const e of sorted) counts.set(e.points, (counts.get(e.points) ?? 0) + 1)
  return sorted.map((e, i) => ({ ...e, rank: i + 1, tied: (counts.get(e.points) ?? 0) > 1 }))
}

/** Per person: when they reached their score (latest counted submission) and their first counted submission. */
export function submissionMarks(rows: { contributor_id: string; submitted_at: string | null }[]): Map<string, { reachedAt: string | null; firstAt: string | null }> {
  const marks = new Map<string, { reachedAt: string | null; firstAt: string | null }>()
  for (const r of rows) {
    if (!r.submitted_at || !Number.isFinite(Date.parse(r.submitted_at))) continue
    const m = marks.get(r.contributor_id) ?? { reachedAt: null, firstAt: null }
    if (!m.reachedAt || Date.parse(r.submitted_at) > Date.parse(m.reachedAt)) m.reachedAt = r.submitted_at
    if (!m.firstAt || Date.parse(r.submitted_at) < Date.parse(m.firstAt)) m.firstAt = r.submitted_at
    marks.set(r.contributor_id, m)
  }
  return marks
}

/** A submission time as shown on the leaderboard, in Lagos time, to the minute. */
export function submittedLabel(iso: string | null | undefined): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—'
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (Lagos)'
}

/**
 * Name shown on the leaderboard: the contributor's chosen display name, else
 * another name they gave us (their application, their account). Never derived
 * from their email.
 */
export function leaderboardName(displayName: string | null | undefined, ...otherNames: (string | null | undefined)[]): string {
  for (const n of [displayName, ...otherNames]) {
    const s = typeof n === 'string' ? n.trim() : ''
    if (s) return s.slice(0, 60)
  }
  return 'Unnamed contributor'
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
