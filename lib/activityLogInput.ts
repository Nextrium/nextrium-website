export interface ClientLogInput {
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
}

const ACTION_PATTERN = /^[a-z0-9_.:-]{1,64}$/
const MAX_TARGET_CHARS = 200
const MAX_DETAILS_CHARS = 4000

// Sign-in and sign-out are the only events an account without dashboard
// access can produce, because a session exists when each happens.
const ANY_SESSION_ACTIONS = new Set(['sign_in', 'sign_out'])

function cap(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, MAX_TARGET_CHARS) : undefined
}

function capDetails(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  try {
    return JSON.stringify(value).length <= MAX_DETAILS_CHARS
      ? (value as Record<string, unknown>)
      : { truncated: true }
  } catch {
    return { truncated: true }
  }
}

/** Keeps only the fields a client may set, in a bounded shape. Null = drop. */
export function sanitizeLogInput(input: unknown): ClientLogInput | null {
  if (!input || typeof input !== 'object') return null
  const p = input as Record<string, unknown>
  if (typeof p.action !== 'string' || !ACTION_PATTERN.test(p.action)) return null
  return {
    action: p.action,
    targetType: cap(p.targetType),
    targetId: cap(p.targetId),
    details: capDetails(p.details),
  }
}

/** Accounts with dashboard access may log anything; others only sign-in/out. */
export function canLogAction(action: string, role: string): boolean {
  const hasAccess = role !== 'none' && role !== 'archived'
  return hasAccess || ANY_SESSION_ACTIONS.has(action)
}
