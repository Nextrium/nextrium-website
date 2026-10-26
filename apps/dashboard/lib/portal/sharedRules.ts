// Staff-side rules for portal shared tasks: tasks open to several contributors
// during a claim window, where each claim creates the contributor's own copy.
// The community database (claim_shared_task) enforces claiming; these rules
// check what staff ask for before it's written.

export const SHARED_WINDOW_DEFAULT_HOURS = 72
export const SHARED_WINDOW_MAX_HOURS = 24 * 30
export const SHARED_MAX_CLAIMERS = 500

export interface SharedOptions { windowHours: number; maxClaimers: number | null }

const whole = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN
  return Number.isInteger(n) ? n : NaN
}

/** The window (default 72 hours, 1 hour to 30 days) and an optional cap (1 to 500, or none). */
export function parseSharedOptions(raw: { windowHours?: unknown; maxClaimers?: unknown } | null | undefined): SharedOptions | { error: string } {
  const h = whole(raw?.windowHours)
  const windowHours = h === null ? SHARED_WINDOW_DEFAULT_HOURS : h
  if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > SHARED_WINDOW_MAX_HOURS) {
    return { error: `The claim window must be between 1 hour and ${SHARED_WINDOW_MAX_HOURS / 24} days.` }
  }
  const m = whole(raw?.maxClaimers)
  if (m !== null && (!Number.isInteger(m) || m < 1 || m > SHARED_MAX_CLAIMERS)) {
    return { error: `The number of places must be between 1 and ${SHARED_MAX_CLAIMERS}, or left empty for no limit.` }
  }
  return { windowHours, maxClaimers: m }
}

export function windowClose(now: Date, hours: number): string {
  return new Date(now.getTime() + hours * 3_600_000).toISOString()
}

/** Extending adds hours to the later of now and the current close, so a closed window reopens from now. */
export function extendedClose(currentClose: string | null, hours: unknown, now: Date = new Date()): { closesAt: string } | { error: string } {
  const h = whole(hours)
  if (h === null || !Number.isInteger(h) || h < 1 || h > SHARED_WINDOW_MAX_HOURS) return { error: `Extend by 1 hour to ${SHARED_WINDOW_MAX_HOURS / 24} days.` }
  const current = currentClose ? new Date(currentClose).getTime() : NaN
  const from = Number.isFinite(current) && current > now.getTime() ? current : now.getTime()
  return { closesAt: new Date(from + h * 3_600_000).toISOString() }
}

/** A new cap can't be below the people who already claimed. */
export function capRule(raw: unknown, claimed: number): { maxClaimers: number | null } | { error: string } {
  const m = whole(raw)
  if (m === null) return { maxClaimers: null }
  if (!Number.isInteger(m) || m < 1 || m > SHARED_MAX_CLAIMERS) return { error: `The number of places must be between 1 and ${SHARED_MAX_CLAIMERS}, or empty for no limit.` }
  if (m < claimed) return { error: `${claimed} people have already claimed it, so the limit can't be lower than ${claimed}.` }
  return { maxClaimers: m }
}

export interface CopyRow { id: string; status: string | null; assigned_to: string | null }

/** Copies a staff action may change or remove: still running and never given a submission. */
export function untouchedCopies(copies: CopyRow[], withSubmission: Set<string>): CopyRow[] {
  return copies.filter((c) => c.status === 'assigned' && !withSubmission.has(c.id))
}

/** "6 claimed · 2 submitted · 1 completed" */
export function sharedProgress(copies: CopyRow[], withSubmission: Set<string>): string {
  const completed = copies.filter((c) => c.status === 'completed').length
  const submitted = copies.filter((c) => withSubmission.has(c.id)).length
  return `${copies.length} claimed · ${submitted} submitted · ${completed} completed`
}
