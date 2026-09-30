import { isCategory, isComplexity, taskDefaults, type Category, type Complexity } from './constants'
import { sanitizeBrief } from './sanitize'

export const TITLE_MAX = 200
export const BRIEF_MAX = 20_000
export const LINKS_MAX = 10

export interface TaskLink {
  label: string
  url: string
}

export interface TaskInput {
  title: string
  description: string
  category: Category
  complexity: Complexity
  links: TaskLink[]
}

export interface TaskFields extends TaskInput {
  point_range_min: number
  point_range_max: number
  deadline_days: number
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Validates and normalises task form input on the server. Returns the
 * database fields (brief sanitized, point range and deadline derived from
 * category + complexity) or an error message.
 */
export function parseTaskInput(raw: unknown): { fields: TaskFields } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid task.' }
  const input = raw as Record<string, unknown>

  const title = typeof input.title === 'string' ? input.title.trim() : ''
  if (!title) return { error: 'Title is required.' }
  if (title.length > TITLE_MAX) return { error: `Title must be ${TITLE_MAX} characters or fewer.` }

  if (!isCategory(input.category)) return { error: 'Choose a category.' }
  if (!isComplexity(input.complexity)) return { error: 'Choose a complexity.' }

  const rawBrief = typeof input.description === 'string' ? input.description : ''
  if (rawBrief.length > BRIEF_MAX) return { error: 'The brief is too long.' }
  const description = sanitizeBrief(rawBrief)
  if (!description.replace(/<[^>]*>/g, '').trim()) return { error: 'A brief is required.' }

  const rawLinks = Array.isArray(input.links) ? input.links : []
  if (rawLinks.length > LINKS_MAX) return { error: `At most ${LINKS_MAX} links.` }
  const links: TaskLink[] = []
  for (const l of rawLinks) {
    const label = typeof l?.label === 'string' ? l.label.trim().slice(0, 100) : ''
    const url = typeof l?.url === 'string' ? l.url.trim() : ''
    if (!url) continue
    if (!isHttpUrl(url)) return { error: `Not a valid link: ${url.slice(0, 60)}` }
    links.push({ label: label || url, url })
  }

  const d = taskDefaults(input.category, input.complexity)
  return {
    fields: {
      title,
      description,
      category: input.category,
      complexity: input.complexity,
      links,
      point_range_min: d.pointRangeMin,
      point_range_max: d.pointRangeMax,
      deadline_days: d.deadlineDays,
    },
  }
}
