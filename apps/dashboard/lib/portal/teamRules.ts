// Core team (community database) and contributor limits. Pure, so the
// allowed values match the database's check constraints and are tested.

// core_team_role_check and core_team_department_check in the community database.
export const CORE_ROLES = ['founder', 'lead', 'reviewer', 'coordinator'] as const
export type CoreRole = (typeof CORE_ROLES)[number]
export const DEPARTMENTS = ['technical', 'design', 'community', 'research', 'operations', 'governance'] as const
export type Department = (typeof DEPARTMENTS)[number]

export const CORE_ROLE_LABELS: Record<CoreRole, string> = { founder: 'Founder', lead: 'Lead', reviewer: 'Reviewer', coordinator: 'Coordinator' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface CoreMemberInput {
  name: string
  email: string
  role: CoreRole
  department: Department
}

export function parseCoreMember(raw: { name?: unknown; email?: unknown; role?: unknown; department?: unknown }): { member: CoreMemberInput } | { error: string } {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (name.length < 2 || name.length > 100) return { error: 'Enter a name (2–100 characters).' }
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: 'Enter a valid email address.' }
  if (!(CORE_ROLES as readonly string[]).includes(raw.role as string)) return { error: 'Choose a role.' }
  if (!(DEPARTMENTS as readonly string[]).includes(raw.department as string)) return { error: 'Choose a department.' }
  return { member: { name, email, role: raw.role as CoreRole, department: raw.department as Department } }
}

/** Running tasks a contributor may hold: 1 to 5 (default 2). */
export const MAX_CLAIMS_RANGE = { min: 1, max: 5 } as const

export function parseMaxClaims(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
  return Number.isInteger(n) && n >= MAX_CLAIMS_RANGE.min && n <= MAX_CLAIMS_RANGE.max ? n : null
}

/** Human-readable audit action: "contribution.verified" → "Contribution verified". */
export function auditActionLabel(action: string): string {
  const s = action.replace(/[._]/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}
