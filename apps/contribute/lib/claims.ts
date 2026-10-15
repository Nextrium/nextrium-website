// Claim rules as the portal explains them. The database enforces them in
// claim_task (open tasks only, one winner, the running-task limit and the
// cooldown after unclaiming); these helpers only describe the outcome.

/** Hours before someone who unclaimed a task may claim it again. */
export const CLAIM_COOLDOWN_HOURS = 48

/** Running tasks a contributor may hold at once unless their record says otherwise. */
export const DEFAULT_MAX_CLAIMS = 2

/**
 * Whole hours left before this contributor may claim the task again, or 0
 * when they may claim now. Uses their most recent unclaim of the task.
 */
export function cooldownHoursLeft(
  task: { unclaimed_by: string[] | null; unclaimed_at: string[] | null },
  contributorId: string,
  now: Date = new Date(),
): number {
  const by = task.unclaimed_by ?? []
  const at = task.unclaimed_at ?? []
  let latest = -Infinity
  by.forEach((id, i) => {
    if (id !== contributorId || !at[i]) return
    const t = new Date(at[i]).getTime()
    if (Number.isFinite(t) && t > latest) latest = t
  })
  if (latest === -Infinity) return 0
  const remainingMs = latest + CLAIM_COOLDOWN_HOURS * 3_600_000 - now.getTime()
  return remainingMs > 0 ? Math.ceil(remainingMs / 3_600_000) : 0
}

export function cooldownMessage(hours: number): string {
  return `You unclaimed this task recently. You can claim it again in ${hours} hour${hours === 1 ? '' : 's'}.`
}

export function limitMessage(maxClaims: number): string {
  return `You already have ${maxClaims} running task${maxClaims === 1 ? '' : 's'}. Submit or unclaim one before claiming another.`
}
