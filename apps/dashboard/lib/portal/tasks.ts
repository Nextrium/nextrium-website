import { community, contributorName } from './server'
import type { AssignableContributor } from '@/app/(console)/portal/tasks/PortalTaskEditor'

/** Approved contributors with how many tasks they are running, for the assignment picker. */
export async function assignableContributors(): Promise<AssignableContributor[]> {
  const db = community()
  const [{ data: people, error: e1 }, { data: running, error: e2 }] = await Promise.all([
    db.from('contributors').select('id, name, contributor_type, team_name, categories, max_claims').eq('status', 'active'),
    db.from('tasks').select('assigned_to').eq('status', 'assigned'),
  ])
  if (e1 || e2) throw new Error('Could not load contributors')
  const counts = new Map<string, number>()
  for (const r of running ?? []) if (r.assigned_to) counts.set(r.assigned_to, (counts.get(r.assigned_to) ?? 0) + 1)
  return (people ?? []).map((p) => ({
    id: p.id,
    name: contributorName(p),
    categories: p.categories ?? [],
    running: counts.get(p.id) ?? 0,
    maxClaims: p.max_claims ?? 2,
  }))
}
