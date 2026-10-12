import { isCategory, isComplexity, taskDefaults, type Category, type Complexity } from './constants'
import { briefToText, sanitizeBrief } from './sanitize'

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
  if (!briefToText(description)) return { error: 'A brief is required.' }

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

const ASSIGNEE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Checks the assignee and optional custom deadline before anything is written. */
export function parseAssignment(
  assigneeId: unknown,
  deadlineAt: unknown,
  now: Date = new Date(),
): { assigneeId: string; deadline: string | null } | { error: string } {
  if (typeof assigneeId !== 'string' || !ASSIGNEE_ID.test(assigneeId)) return { error: 'Choose a member to assign.' }
  if (deadlineAt === null || deadlineAt === undefined || deadlineAt === '') return { assigneeId, deadline: null }
  if (typeof deadlineAt !== 'string') return { error: 'That deadline is not a valid date.' }
  const d = new Date(deadlineAt)
  if (Number.isNaN(d.getTime())) return { error: 'That deadline is not a valid date.' }
  if (d.getTime() <= now.getTime()) return { error: 'The deadline must be in the future.' }
  return { assigneeId, deadline: d.toISOString() }
}

export interface TaskFormValues {
  title: string
  description: string
  category: string
  complexity: string
  links: TaskLink[]
}

function normaliseTaskForm(v: TaskFormValues): string {
  const links = v.links
    .map((l) => ({ label: (l.label ?? '').trim(), url: (l.url ?? '').trim() }))
    .filter((l) => l.label || l.url)
  return JSON.stringify([v.title.trim(), v.description.trim(), v.category, v.complexity, links])
}

/** True when the editor differs from the last saved version of the task. */
export function taskHasChanges(saved: TaskFormValues, current: TaskFormValues): boolean {
  return normaliseTaskForm(saved) !== normaliseTaskForm(current)
}
