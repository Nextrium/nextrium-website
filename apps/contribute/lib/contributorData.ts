import { cache } from 'react'
import { sanitizeBrief } from '@nextrium/contributions-core/sanitize'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { isUuid } from './publicData'
import { parseTaskLinks, safeExternalUrl, type TaskLink } from './links'

// The signed-in contributor's own records. Every query is scoped to the
// contributor id the caller passes, which always comes from
// getActiveContributor() (the verified session), never from the browser.

export interface MyProfile {
  id: string
  name: string
  email: string
  contributor_type: string | null
  team_name: string | null
  categories: string[]
  location: string | null
  timezone: string | null
  availability_hours_per_week: number | null
  bio: string | null
  skills: string[] | null
  github_handle: string | null
  twitter_handle: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  wallet_address: string | null
  notification_email: boolean
  total_points: number
  verified_contributions: number
  max_claims: number
}

export interface MySubmission {
  id: string
  task_id: string | null
  title: string
  description: string | null
  category: string
  complexity: string
  base_points: number
  final_points: number | null
  status: string
  notes: string | null
  evidence_url: string | null
  submission_count: number | null
  review_decision: string | null
  review_score: number | null
  review_feedback: unknown
  deadline_at: string | null
  verified_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface MyTask {
  id: string
  title: string
  category: string
  complexity: string
  point_range_min: number
  point_range_max: number
  claimed_at: string | null
  deadline_at: string | null
  deadline_days: number | null
  extension_granted: boolean | null
  extension_requested_at: string | null
  extended_deadline_at: string | null
  /** Set on a copy of a shared task. */
  shared_from: string | null
}

const PROFILE_COLUMNS = 'id, name, email, contributor_type, team_name, categories, location, timezone, availability_hours_per_week, bio, skills, github_handle, twitter_handle, linkedin_url, portfolio_url, wallet_address, notification_email, total_points, verified_contributions, max_claims'
const SUBMISSION_COLUMNS = 'id, task_id, title, description, category, complexity, base_points, final_points, status, notes, evidence_url, submission_count, review_decision, review_score, review_feedback, deadline_at, verified_at, created_at, updated_at'
const TASK_COLUMNS = 'id, title, category, complexity, point_range_min, point_range_max, claimed_at, deadline_at, deadline_days, extension_granted, extension_requested_at, extended_deadline_at, shared_from'

/** Profile, submissions (newest first) and running tasks, once per request. */
export const getMyDashboard = cache(async (contributorId: string) => {
  const db = createCommunityServiceClient()
  const [profile, submissions, tasks] = await Promise.all([
    db.from('contributors').select(PROFILE_COLUMNS).eq('id', contributorId).single(),
    db.from('contributions').select(SUBMISSION_COLUMNS).eq('contributor_id', contributorId).order('updated_at', { ascending: false, nullsFirst: false }),
    db.from('tasks').select(TASK_COLUMNS).eq('assigned_to', contributorId).eq('status', 'assigned').order('claimed_at', { ascending: true }),
  ])
  if (profile.error || submissions.error || tasks.error || !profile.data) throw new Error('Could not load your dashboard')
  const p = profile.data
  const me: MyProfile = {
    ...p,
    categories: p.categories ?? [],
    notification_email: p.notification_email ?? true,
    total_points: p.total_points ?? 0,
    verified_contributions: p.verified_contributions ?? 0,
    max_claims: p.max_claims ?? 2,
  }
  return { me, submissions: (submissions.data ?? []) as MySubmission[], tasks: (tasks.data ?? []) as MyTask[] }
})

export interface MySubmissionDetail extends MySubmission {
  task: {
    id: string
    title: string
    descriptionHtml: string
    status: string | null
    point_range_min: number
    point_range_max: number
    deadline_days: number | null
    tags: string[]
    links: TaskLink[]
  } | null
}

/** One of the contributor's own submissions with its task, or null (including when it is someone else's). */
export async function getMySubmission(contributorId: string, id: string): Promise<MySubmissionDetail | null> {
  if (!isUuid(id)) return null
  const db = createCommunityServiceClient()
  const { data: sub, error } = await db.from('contributions').select(SUBMISSION_COLUMNS).eq('id', id).eq('contributor_id', contributorId).maybeSingle()
  if (error) throw new Error('Could not load the submission')
  if (!sub) return null

  let task: MySubmissionDetail['task'] = null
  if (sub.task_id) {
    const { data: t } = await db
      .from('tasks')
      .select('id, title, description, status, point_range_min, point_range_max, deadline_days, primitives, links')
      .eq('id', sub.task_id)
      .maybeSingle()
    if (t) {
      task = {
        id: t.id,
        title: t.title,
        descriptionHtml: sanitizeBrief(t.description ?? ''),
        status: t.status,
        point_range_min: t.point_range_min,
        point_range_max: t.point_range_max,
        deadline_days: t.deadline_days,
        tags: (t.primitives ?? []).filter(Boolean).map((p) => p.slice(0, 40)),
        links: parseTaskLinks(t.links),
      }
    }
  }
  return { ...(sub as MySubmission), evidence_url: safeExternalUrl(sub.evidence_url), task }
}

/** The latest submission per task, so the task list can show "submitted / changes requested". */
export function latestByTask(submissions: MySubmission[]): Map<string, MySubmission> {
  const map = new Map<string, MySubmission>()
  for (const s of submissions) {
    if (!s.task_id) continue
    const prev = map.get(s.task_id)
    if (!prev || (s.created_at ?? '') > (prev.created_at ?? '')) map.set(s.task_id, s)
  }
  return map
}
