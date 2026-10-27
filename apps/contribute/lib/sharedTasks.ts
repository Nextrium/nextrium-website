// Shared tasks: open to several contributors during a claim window. Each claim
// creates that contributor's own copy, which works like any claimed task. The
// database (claim_shared_task) enforces every rule; these helpers describe the
// state and explain refusals.

export interface SharedInfo {
  /** When claiming stops. */
  closesAt: string
  /** People who have claimed it (their copies). */
  claimers: number
  /** Optional cap on claimers; null means no cap. */
  maxClaimers: number | null
}

export type SharedState = 'open' | 'closed' | 'full'

export function sharedState(s: SharedInfo, now: Date = new Date()): SharedState {
  // An unreadable date counts as closed: never offer a claim the database would refuse.
  if (!(new Date(s.closesAt).getTime() > now.getTime())) return 'closed'
  if (s.maxClaimers !== null && s.claimers >= s.maxClaimers) return 'full'
  return 'open'
}

/** "closes in 2d 5h", "closes in 3h 10m", "closes in 4m", or "claims closed". */
export function windowLabel(closesAt: string, now: Date = new Date()): string {
  const ms = new Date(closesAt).getTime() - now.getTime()
  if (!(ms > 0)) return 'claims closed'
  const mins = Math.max(1, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60
  if (d > 0) return `closes in ${d}d ${h}h`
  if (h > 0) return `closes in ${h}h ${m}m`
  return `closes in ${m}m`
}

/** "4 working on it" / "3 of 10 places taken" / "Be the first to claim it". */
export function claimersLabel(s: SharedInfo): string {
  if (s.maxClaimers !== null) return `${s.claimers} of ${s.maxClaimers} places taken`
  if (s.claimers === 0) return 'Be the first to claim it'
  return `${s.claimers} working on it`
}

/** "You're one of 4 people working on this task." Only a count, never names. */
export function oneOfLabel(n: number): string | null {
  return n > 1 ? `You're one of ${n} people working on this task. Each person submits their own work and earns their own points.` : null
}

/** The database's refusal codes, in words. */
export function sharedClaimMessage(errorMessage: string | undefined, ctx: { maxClaims?: number } = {}): string {
  const m = errorMessage ?? ''
  if (/claim_window_closed/.test(m)) return 'Claims for this task have closed.'
  if (/already_claimed/.test(m)) return 'You have already claimed this task. You will find it in your tasks on your dashboard.'
  if (/claimers_full/.test(m)) return 'All places on this task have been taken.'
  if (/cooldown/.test(m)) return 'You gave this task back recently. You can claim it again 48 hours after you did.'
  if (/claim_limit_reached/.test(m)) {
    const n = ctx.maxClaims ?? 2
    return `You already have ${n} running task${n === 1 ? '' : 's'}. Submit or unclaim one before claiming another.`
  }
  if (/not_active/.test(m)) return 'Only approved contributors can claim tasks.'
  if (/not_shared/.test(m)) return 'This task is no longer open for claiming.'
  return 'The task could not be claimed. Try again in a moment.'
}

export function sharedUnclaimMessage(errorMessage: string | undefined): string {
  const m = errorMessage ?? ''
  if (/has_submission/.test(m)) return 'You have submitted work for this task, so it stays with you until it is reviewed.'
  if (/not_yours/.test(m)) return 'This task is not one of your running tasks.'
  return 'Something went wrong. Try again.'
}
