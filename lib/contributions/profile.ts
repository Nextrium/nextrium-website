import { CATEGORIES, type Category } from './constants'

export const SKILLS_MAX = 20
export const SKILL_CHARS_MAX = 40

export interface ContributorProfileInput {
  categories: Category[]
  skills: string[]
  availabilityHoursPerWeek: number | null
  notifyEmail: boolean
}

/** Validates the contributor section of the profile form. Pure. */
export function parseContributorProfile(raw: unknown): { profile: ContributorProfileInput } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid profile.' }
  const r = raw as Record<string, unknown>

  const categories = Array.isArray(r.categories)
    ? [...new Set(r.categories.filter((c): c is Category => (CATEGORIES as readonly unknown[]).includes(c)))]
    : []
  if (categories.length === 0) return { error: 'Choose at least one area you want to contribute to.' }

  const skills = Array.isArray(r.skills)
    ? [...new Set(r.skills.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean))]
    : []
  if (skills.length > SKILLS_MAX) return { error: `List at most ${SKILLS_MAX} skills.` }
  if (skills.some((s) => s.length > SKILL_CHARS_MAX)) return { error: `Keep each skill under ${SKILL_CHARS_MAX} characters.` }

  let availability: number | null = null
  if (r.availabilityHoursPerWeek !== null && r.availabilityHoursPerWeek !== undefined && r.availabilityHoursPerWeek !== '') {
    const n = Number(r.availabilityHoursPerWeek)
    if (!Number.isInteger(n) || n < 0 || n > 168) return { error: 'Weekly availability must be a whole number of hours between 0 and 168.' }
    availability = n
  }

  return { profile: { categories, skills, availabilityHoursPerWeek: availability, notifyEmail: r.notifyEmail !== false } }
}

/** Splits a comma-separated skills field into a list. */
export function splitSkills(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}
