import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { CONTRIBUTOR_ROLES, requireMember, requireStaff } from '@/lib/contributions/auth'
import { leaderboardName } from '@/lib/contributions/leaderboard'
import { sanitizeBrief } from '@/lib/contributions/sanitize'
import { CATEGORY_LABELS, COMPLEXITY_LABELS, type Category, type Complexity } from '@/lib/contributions/constants'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contributions' }

interface Props {
  params: Promise<{ id: string }>
}

interface Delivery {
  id: string
  task_id: string
  title: string
  description: string
  evidence_url: string | null
  final_points: number | null
  verified_at: string | null
}

interface TaskSummary {
  id: string
  title: string
  description: string
  category: Category
  complexity: Complexity
}

/**
 * What one contributor delivered and the points each piece earned, so anyone
 * on the leaderboard can see why points were awarded. Verified work only;
 * staff notes, review feedback and security findings stay private.
 */
export default async function ContributorDeliveriesPage({ params }: Props) {
  const staff = await requireStaff()
  if ('error' in staff && 'error' in (await requireMember())) notFound()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = createServiceClient() as any
  // Same people the leaderboard lists: active, onboarded, any contributor role.
  const { data: person } = await supabase.from('dashboard_users').select('user_id')
    .eq('user_id', id).in('role', CONTRIBUTOR_ROLES).eq('archived', false).not('onboarding_completed_at', 'is', null)
    .limit(1).maybeSingle()
  if (!person) notFound()

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('contributor_profiles').select('display_name, total_points, verified_contributions').eq('user_id', id).maybeSingle(),
    supabase.from('contributions')
      .select('id, task_id, title, description, evidence_url, final_points, verified_at')
      .eq('contributor_id', id).eq('status', 'verified').order('verified_at', { ascending: false }),
  ])
  const deliveries: Delivery[] = rows ?? []
  const taskIds = deliveries.map((d) => d.task_id)
  const { data: taskRows } = taskIds.length
    ? await supabase.from('tasks').select('id, title, description, category, complexity').in('id', taskIds)
    : { data: [] }
  const tasks = new Map<string, TaskSummary>((taskRows ?? []).map((t: TaskSummary) => [t.id, t]))

  const name = leaderboardName(profile?.display_name)
  const awarded = deliveries.reduce((s, d) => s + (d.final_points ?? 0), 0)
  const total: number = profile?.total_points ?? awarded
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

  return (
    <>
      <style>{`
        .cd-summary { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 20px; color: var(--off-white); font-size: 13px; }
        .cd-summary strong { color: var(--white); font-family: var(--font-exo2); font-size: 18px; margin-right: 6px; }
        .cd-list { display: flex; flex-direction: column; gap: 12px; max-width: 820px; }
        .cd-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }
        .cd-head { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
        .cd-title { color: var(--white); font-size: 15px; font-weight: 600; }
        .cd-points { color: var(--orange); font-family: var(--font-exo2); font-size: 18px; font-weight: 700; white-space: nowrap; }
        .cd-meta { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); }
        .cd-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); margin-top: 4px; }
        .cd-text { color: var(--off-white); font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
        .cd-brief { color: var(--off-white); font-size: 13px; line-height: 1.7; }
        .cd-brief a, .cd-link { color: var(--orange); word-break: break-all; }
        .cd-brief img { max-width: 100%; }
        .cd-card summary { cursor: pointer; color: var(--grey-mid); font-size: 12px; }
        .cd-muted { color: var(--grey-mid); font-size: 12px; }
        .cd-empty { padding: 32px; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); max-width: 820px; }
        .cd-back { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; }
        .cd-back:hover { color: var(--orange); }
      `}</style>
      <Header title={name} description="Verified contributions and the points they earned"
        action={<Link href="/dashboard/leaderboard" className="cd-back">Leaderboard</Link>} />
      <div className="dash-content">
        <div className="cd-summary">
          <span><strong>{total}</strong>total points</span>
          <span><strong>{deliveries.length}</strong>verified contribution{deliveries.length === 1 ? '' : 's'}</span>
        </div>
        {total > awarded && (
          <p className="cd-muted" style={{ marginTop: -8, marginBottom: 16 }}>
            The total includes {total - awarded} points of consistency bonus on top of the points listed below.
          </p>
        )}
        {deliveries.length === 0 ? (
          <div className="cd-empty">No verified contributions yet.</div>
        ) : (
          <div className="cd-list">
            {deliveries.map((d) => {
              const task = tasks.get(d.task_id)
              return (
                <div key={d.id} className="cd-card">
                  <div className="cd-head">
                    <span className="cd-title">{task?.title ?? d.title}</span>
                    <span className="cd-points">{d.final_points ?? 0} pts</span>
                  </div>
                  <span className="cd-meta">
                    {task ? `${CATEGORY_LABELS[task.category]} · ${COMPLEXITY_LABELS[task.complexity]} · ` : ''}Verified {fmt(d.verified_at)}
                  </span>

                  {task && (
                    <details>
                      <summary>Task brief</summary>
                      <div className="cd-brief" dangerouslySetInnerHTML={{ __html: sanitizeBrief(task.description) }} />
                    </details>
                  )}

                  <span className="cd-label">Delivered · {d.title}</span>
                  <div className="cd-text">{d.description}</div>
                  {d.evidence_url && /^https?:\/\//i.test(d.evidence_url) && (
                    <a className="cd-link" href={d.evidence_url} target="_blank" rel="noopener noreferrer nofollow">{d.evidence_url}</a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
