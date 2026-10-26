import { cache } from 'react'
import { sanitizeBrief } from '@nextrium/contributions-core/sanitize'
import { createCommunityClient, createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { excerptOf } from './excerpt'
import { parseTaskLinks, safeExternalUrl, type TaskLink } from './links'
import { sharedState, type SharedInfo } from './sharedTasks'

// Everything the public pages show, read on the server with explicit column
// lists. Only open tasks, approved (active) contributors and verified
// contributions are ever returned; emails and private fields never are.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Whether a visitor is signed in at all (for the header). Never throws. */
export async function isSignedIn(): Promise<boolean> {
  try {
    const supabase = await createCommunityClient()
    const { data } = await supabase.auth.getUser()
    return !!data.user
  } catch {
    return false
  }
}

export interface TaskCard {
  id: string
  title: string
  excerpt: string
  category: string
  complexity: string
  point_range_min: number
  point_range_max: number
  created_at: string | null
  /** Set for a task open to several contributors. */
  shared: SharedInfo | null
}

/** How many people have claimed each shared task (their copies). */
async function claimerCounts(db: ReturnType<typeof createCommunityServiceClient>, ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (ids.length === 0) return counts
  const { data, error } = await db.from('tasks').select('shared_from').in('shared_from', ids)
  if (error) throw new Error('Could not load tasks')
  for (const r of data ?? []) if (r.shared_from) counts.set(r.shared_from, (counts.get(r.shared_from) ?? 0) + 1)
  return counts
}

function sharedOf(row: { id: string; shared?: boolean | null; claim_closes_at?: string | null; max_claimers?: number | null }, counts: Map<string, number>): SharedInfo | null {
  if (!row.shared || !row.claim_closes_at) return null
  return { closesAt: row.claim_closes_at, claimers: counts.get(row.id) ?? 0, maxClaimers: row.max_claimers ?? null }
}

export async function listOpenTasks(): Promise<TaskCard[]> {
  const db = createCommunityServiceClient()
  const { data, error } = await db
    .from('tasks')
    .select('id, title, description, category, complexity, point_range_min, point_range_max, created_at, shared, claim_closes_at, max_claimers')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw new Error('Could not load tasks')
  const rows = data ?? []
  const counts = await claimerCounts(db, rows.filter((r) => r.shared).map((r) => r.id))
  return rows
    .map(({ description, shared, claim_closes_at, max_claimers, ...t }) => ({
      ...t,
      excerpt: excerptOf(description ?? ''),
      shared: sharedOf({ id: t.id, shared, claim_closes_at, max_claimers }, counts),
    }))
    // A shared task whose claim window has closed is no longer on the board.
    .filter((t) => !t.shared || sharedState(t.shared) !== 'closed')
}

export interface TaskDetail {
  id: string
  title: string
  /** Sanitised HTML, safe to render. */
  descriptionHtml: string
  category: string
  complexity: string
  point_range_min: number
  point_range_max: number
  deadline_days: number | null
  tags: string[]
  links: TaskLink[]
  created_at: string | null
  unclaimed_by: string[] | null
  unclaimed_at: string[] | null
  /** Set for a task open to several contributors. */
  shared: SharedInfo | null
  /** On a contributor's copy: the shared task it was claimed from. */
  sharedFrom: string | null
}

/** A task with who holds it, or null. Callers decide who may see it. Once per request. */
const getTask = cache(async (id: string): Promise<{ task: TaskDetail; status: string | null; assignedTo: string | null } | null> => {
  if (!isUuid(id)) return null
  const db = createCommunityServiceClient()
  const { data, error } = await db
    .from('tasks')
    .select('id, title, description, category, complexity, point_range_min, point_range_max, deadline_days, primitives, links, created_at, status, assigned_to, unclaimed_by, unclaimed_at, shared, claim_closes_at, max_claimers, shared_from')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('Could not load the task')
  if (!data) return null
  const { description, primitives, links, status, assigned_to, shared, claim_closes_at, max_claimers, shared_from, ...rest } = data
  const counts = shared ? await claimerCounts(db, [data.id]) : new Map<string, number>()
  return {
    status,
    assignedTo: assigned_to,
    task: {
      ...rest,
      shared: sharedOf({ id: data.id, shared, claim_closes_at, max_claimers }, counts),
      sharedFrom: shared_from ?? null,
      descriptionHtml: sanitizeBrief(description ?? ''),
      tags: (primitives ?? []).filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim().slice(0, 40)),
      links: parseTaskLinks(links),
    },
  }
})

/** An open task, or null when it does not exist or is no longer open. */
export async function getOpenTask(id: string): Promise<TaskDetail | null> {
  const found = await getTask(id)
  if (!found || found.status !== 'open') return null
  // A shared task whose claim window has closed is no longer open.
  if (found.task.shared && sharedState(found.task.shared) === 'closed') return null
  return found.task
}

/** An open task, or a task this contributor is working on; null otherwise. */
export async function getTaskForContributor(id: string, contributorId: string): Promise<{ task: TaskDetail; mine: boolean } | null> {
  const found = await getTask(id)
  if (!found) return null
  if (found.status === 'open') {
    if (found.task.shared && sharedState(found.task.shared) === 'closed') return null
    return { task: found.task, mine: false }
  }
  if (found.status === 'assigned' && found.assignedTo === contributorId) return { task: found.task, mine: true }
  return null
}

export interface PublicContributor {
  id: string
  name: string
  contributor_type: string | null
  team_name: string | null
  categories: string[]
  location: string | null
  total_points: number
  verified_contributions: number
}

export interface PublicContribution {
  id: string
  contributor_id: string
  title: string
  category: string
  complexity: string
  points: number
  verified_at: string | null
  evidence_url: string | null
}

const CONTRIBUTOR_COLUMNS = 'id, name, contributor_type, team_name, categories, location, total_points, verified_contributions'
const CONTRIBUTION_COLUMNS = 'id, contributor_id, title, category, complexity, base_points, final_points, verified_at, evidence_url'

function toPublicContributor(c: {
  id: string; name: string; contributor_type: string | null; team_name: string | null; categories: string[]
  location: string | null; total_points: number | null; verified_contributions: number | null
}): PublicContributor {
  return { ...c, categories: c.categories ?? [], total_points: c.total_points ?? 0, verified_contributions: c.verified_contributions ?? 0 }
}

function toPublicContribution(c: {
  id: string; contributor_id: string | null; title: string; category: string; complexity: string
  base_points: number; final_points: number | null; verified_at: string | null; evidence_url: string | null
}): PublicContribution {
  return {
    id: c.id,
    contributor_id: c.contributor_id ?? '',
    title: c.title,
    category: c.category,
    complexity: c.complexity,
    points: c.final_points ?? c.base_points,
    verified_at: c.verified_at,
    evidence_url: safeExternalUrl(c.evidence_url),
  }
}

/** Approved contributors and their verified contributions, for the leaderboard. */
export async function getLeaderboard(): Promise<{ contributors: PublicContributor[]; contributions: PublicContribution[] }> {
  const db = createCommunityServiceClient()
  const { data: people, error } = await db.from('contributors').select(CONTRIBUTOR_COLUMNS).eq('status', 'active')
  if (error) throw new Error('Could not load the leaderboard')
  const contributors = (people ?? []).map(toPublicContributor)
  if (contributors.length === 0) return { contributors, contributions: [] }

  const { data: work, error: workError } = await db
    .from('contributions')
    .select(CONTRIBUTION_COLUMNS)
    .eq('status', 'verified')
    .in('contributor_id', contributors.map((c) => c.id))
    .order('verified_at', { ascending: false })
  if (workError) throw new Error('Could not load the leaderboard')
  // The leaderboard never shows evidence links, so they are not sent to the browser.
  return { contributors, contributions: (work ?? []).map((w) => ({ ...toPublicContribution(w), evidence_url: null })) }
}

/** An approved contributor's public profile, or null when there is none to show. Once per request. */
export const getPublicProfile = cache(async (id: string): Promise<{ contributor: PublicContributor; contributions: PublicContribution[] } | null> => {
  if (!isUuid(id)) return null
  const db = createCommunityServiceClient()
  const { data: person, error } = await db.from('contributors').select(CONTRIBUTOR_COLUMNS).eq('id', id).eq('status', 'active').maybeSingle()
  if (error) throw new Error('Could not load the profile')
  if (!person) return null

  const { data: work, error: workError } = await db
    .from('contributions')
    .select(CONTRIBUTION_COLUMNS)
    .eq('contributor_id', id)
    .eq('status', 'verified')
    .order('verified_at', { ascending: false })
  if (workError) throw new Error('Could not load the profile')
  return { contributor: toPublicContributor(person), contributions: (work ?? []).map(toPublicContribution) }
})
