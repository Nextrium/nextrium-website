import { DEADLINE_DAYS, isComplexity } from '@nextrium/contributions-core/constants'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import { BackLink } from '@/components/PageHeader'
import { CategoryBadge, ComplexityBadge, NeutralBadge } from '@/components/Badges'
import ClaimPanel, { type ClaimView } from '@/app/tasks/[id]/ClaimPanel'
import { DEFAULT_MAX_CLAIMS, cooldownHoursLeft } from '@/lib/claims'
import { sharedState } from '@/lib/sharedTasks'
import type { PortalIdentity } from '@/lib/portal'
import type { TaskDetail } from '@/lib/publicData'
import { C, F, categoryToken } from '@/lib/theme'

export function deadlineDays(task: TaskDetail): number {
  return task.deadline_days ?? (isComplexity(task.complexity) ? DEADLINE_DAYS[task.complexity] : DEADLINE_DAYS.small)
}

/** What the claim box offers this visitor, worked out on the server. */
export async function claimView(task: TaskDetail, me: PortalIdentity | null, mine = false): Promise<ClaimView> {
  // A shared task whose window closed (or whose places are taken) can't be claimed by anyone.
  if (task.shared && sharedState(task.shared) === 'closed') return { kind: 'shared_closed' }
  if (!me) return { kind: 'signed_out' }
  if (!me.contributor || me.contributor.status !== 'active') return { kind: 'not_approved', registered: !!me.contributor }

  const db = createCommunityServiceClient()
  if (mine) {
    // On a copy of a shared task: how many people have it (a count, never names).
    if (!task.sharedFrom) return { kind: 'mine' }
    const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('shared_from', task.sharedFrom)
    return { kind: 'mine', sharedWith: count ?? 0 }
  }
  if (task.shared) {
    const { data: copy } = await db.from('tasks').select('id').eq('shared_from', task.id).eq('assigned_to', me.contributor.id).limit(1)
    if (copy && copy.length > 0) return { kind: 'shared_mine', copyId: copy[0].id }
    if (sharedState(task.shared) === 'full') return { kind: 'shared_full' }
  }

  const [{ count, error: countError }, { data: row, error: rowError }] = await Promise.all([
    db.from('tasks').select('id', { count: 'exact', head: true }).eq('assigned_to', me.contributor.id).eq('status', 'assigned'),
    db.from('contributors').select('max_claims').eq('id', me.contributor.id).maybeSingle(),
  ])
  if (countError || rowError) throw new Error('Could not load your claims')
  const maxClaims = row?.max_claims ?? DEFAULT_MAX_CLAIMS
  if ((count ?? 0) >= maxClaims) return { kind: 'limit', maxClaims }
  const hours = cooldownHoursLeft(task, me.contributor.id)
  if (hours > 0) return { kind: 'cooldown', hours }
  return { kind: 'can_claim' }
}

/** A task's brief, facts, links and claim box. Used by the public task page and the dashboard's. */
export default function TaskDetailView({ task, view, boardHref, boardLabel }: { task: TaskDetail; view: ClaimView; boardHref: string; boardLabel: string }) {
  const days = deadlineDays(task)
  const token = categoryToken(task.category)
  const metaLabel: React.CSSProperties = { fontFamily: F.body, fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.dim }
  const metaValue: React.CSSProperties = { fontFamily: F.display, fontWeight: 600, fontSize: 22, color: C.light, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }

  return (
    <>
      <BackLink href={boardHref} label={boardLabel} current={task.title} />

      <div className="flex items-center gap-2 flex-wrap mb-6">
        <CategoryBadge category={task.category} size="md" />
        <ComplexityBadge complexity={task.complexity} size="md" />
        {task.tags.map((t) => <NeutralBadge key={t} size="md">{t}</NeutralBadge>)}
      </div>

      <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(22px,3vw,36px)', letterSpacing: '-0.02em', lineHeight: 1.2, color: C.light, marginBottom: 32, textWrap: 'balance' }}>
        {task.title}
      </h1>

      <dl className="flex flex-wrap gap-x-10 gap-y-5 p-5 rounded-2xl border mb-10" style={{ background: C.depth, borderColor: C.border }}>
        <div className="flex flex-col gap-1">
          <dt style={metaLabel}>Points</dt>
          <dd style={{ ...metaValue, color: `var(${token})` }}>{task.point_range_min}–{task.point_range_max}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt style={metaLabel}>Deadline</dt>
          <dd style={metaValue}>{days} days</dd>
        </div>
        {task.created_at && (
          <div className="flex flex-col gap-1">
            <dt style={metaLabel}>Posted</dt>
            <dd style={metaValue}>{new Date(task.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</dd>
          </div>
        )}
      </dl>

      {task.descriptionHtml ? (
        // Sanitised on the server by sanitizeBrief (allowlisted tags, attributes and link schemes).
        <div className="task-description mb-10" dangerouslySetInnerHTML={{ __html: task.descriptionHtml }} />
      ) : (
        <p className="mb-10" style={{ fontFamily: F.body, fontSize: 14, color: C.mute }}>No description yet.</p>
      )}

      {task.links.length > 0 && (
        <div className="p-5 rounded-2xl border mb-10" style={{ background: C.depth, borderColor: C.border }}>
          <h2 style={{ ...metaLabel, fontSize: 11, marginBottom: 12 }}>Links and repositories</h2>
          <ul className="flex flex-col gap-3">
            {task.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3" style={{ textDecoration: 'none', overflowWrap: 'anywhere' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="flex-shrink-0">
                    <path d="M5 2H2v10h10V9M9 2h3v3M7 7l5-5" />
                  </svg>
                  <span style={{ fontFamily: F.body, fontSize: 13, color: C.accent }}>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ClaimPanel taskId={task.id} title={task.title} deadlineDays={days} view={view} boardHref={boardHref} shared={task.shared} />
    </>
  )
}
