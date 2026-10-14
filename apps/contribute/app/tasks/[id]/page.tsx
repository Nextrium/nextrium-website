import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DEADLINE_DAYS, isComplexity } from '@nextrium/contributions-core/constants'
import { createCommunityServiceClient } from '@nextrium/supabase/community/server'
import PublicShell from '@/components/PublicShell'
import { BackLink } from '@/components/PageHeader'
import { CategoryBadge, ComplexityBadge, NeutralBadge } from '@/components/Badges'
import { DEFAULT_MAX_CLAIMS, cooldownHoursLeft } from '@/lib/claims'
import { getPortalIdentity } from '@/lib/portal'
import { getOpenTask, type TaskDetail } from '@/lib/publicData'
import { C, F, categoryToken } from '@/lib/theme'
import ClaimPanel, { type ClaimView } from './ClaimPanel'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const task = await getOpenTask((await params).id)
  return { title: task ? task.title : 'Task not available' }
}

function deadlineDays(task: TaskDetail): number {
  return task.deadline_days ?? (isComplexity(task.complexity) ? DEADLINE_DAYS[task.complexity] : DEADLINE_DAYS.small)
}

/** What the claim box offers this visitor, worked out on the server. */
async function claimView(task: TaskDetail): Promise<ClaimView> {
  const me = await getPortalIdentity()
  if (!me) return { kind: 'signed_out' }
  if (!me.contributor || me.contributor.status !== 'active') return { kind: 'not_approved', registered: !!me.contributor }

  const db = createCommunityServiceClient()
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

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params
  const task = await getOpenTask(id)

  if (!task) notFound()

  const view = await claimView(task)
  const days = deadlineDays(task)
  const token = categoryToken(task.category)
  const metaLabel: React.CSSProperties = { fontFamily: F.body, fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.dim }
  const metaValue: React.CSSProperties = { fontFamily: F.display, fontWeight: 600, fontSize: 22, color: C.light, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }

  return (
    <PublicShell signedIn={view.kind !== 'signed_out'}>
      <div className="bg-void pt-20 pb-28">
        <div className="max-w-3xl mx-auto px-8 lg:px-14">
          <BackLink href="/tasks" label="Open tasks" current={task.title} />

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

          <ClaimPanel taskId={task.id} title={task.title} deadlineDays={days} view={view} />
        </div>
      </div>
    </PublicShell>
  )
}
