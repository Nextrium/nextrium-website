import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireStaff } from '@/lib/contributions/auth'
import { getMemberDirectory } from '@/lib/contributions/members'
import { CATEGORY_LABELS } from '@/lib/contributions/constants'
import { QUEUE_TABS } from '@/lib/contributions/taskView'
import type { Contribution, Task } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Review queue' }

interface Props {
  searchParams: Promise<{ tab?: string }>
}

function ago(iso: string, now: Date): string {
  const h = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 3_600_000))
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export default async function ReviewQueuePage({ searchParams }: Props) {
  if ('error' in (await requireStaff())) notFound()

  const { tab: rawTab } = await searchParams
  const tab = QUEUE_TABS.find((t) => t.key === rawTab) ?? QUEUE_TABS[0]
  const supabase = createServiceClient() as any

  const [{ data: rows }, { data: all }] = await Promise.all([
    supabase.from('contributions').select('*').eq('status', tab.key).order('submitted_at', { ascending: true }).limit(200),
    supabase.from('contributions').select('status'),
  ])
  const contributions: Contribution[] = rows ?? []
  const counts = new Map<string, number>()
  for (const r of (all ?? []) as { status: string }[]) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)

  const taskIds = [...new Set(contributions.map((c) => c.task_id))]
  const { data: taskRows } = taskIds.length
    ? await supabase.from('tasks').select('id, title, category, complexity').in('id', taskIds)
    : { data: [] }
  const taskOf = new Map((taskRows as Pick<Task, 'id' | 'title' | 'category' | 'complexity'>[] ?? []).map((t) => [t.id, t]))
  const emailOf = new Map((await getMemberDirectory()).map((m) => [m.userId, m.email]))
  const now = new Date()

  return (
    <>
      <style>{`
        .rq-tabs { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid rgba(255,255,255,0.08); width: fit-content; margin-bottom: 8px; }
        .rq-tab { padding: 9px 16px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; color: var(--grey-mid); }
        .rq-tab.active { background: rgba(219,103,39,0.1); color: var(--orange); }
        .rq-hint { font-size: 12px; color: var(--grey-mid); margin-bottom: 18px; }
        .rq-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
        .rq-table { width: 100%; border-collapse: collapse; }
        .rq-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
        .rq-table td { padding: 14px 16px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .rq-table tr:last-child td { border-bottom: none; }
        .rq-table a { color: var(--white); text-decoration: none; font-weight: 600; }
        .rq-table a:hover { color: var(--orange); }
        .rq-muted { color: var(--grey-mid); font-size: 12px; }
        .rq-empty { padding: 48px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); }
      `}</style>
      <Header
        title="Review queue"
        description="Verify contributions, request changes, or reject"
        action={<Link href="/dashboard/reviews/analytics" className="rq-tab">Analytics</Link>}
      />
      <div className="dash-content">
        <div className="rq-tabs">
          {QUEUE_TABS.map((t) => (
            <Link key={t.key} href={`/dashboard/reviews?tab=${t.key}`} className={`rq-tab ${t.key === tab.key ? 'active' : ''}`}>
              {t.label} ({counts.get(t.key) ?? 0})
            </Link>
          ))}
        </div>
        <div className="rq-hint">{tab.hint}</div>

        {contributions.length === 0 ? (
          <div className="rq-empty">Nothing here.</div>
        ) : (
          <div className="rq-wrap">
            <table className="rq-table">
              <thead>
                <tr><th>Submission</th><th>Task</th><th>Member</th><th>Round</th><th>Score</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {contributions.map((c) => {
                  const t = taskOf.get(c.task_id)
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/dashboard/reviews/${c.id}`}>{c.title}</Link></td>
                      <td>{t ? t.title : '—'} <span className="rq-muted">{t ? `· ${CATEGORY_LABELS[t.category]}` : ''}</span></td>
                      <td className="rq-muted">{emailOf.get(c.contributor_id) ?? 'Unknown'}</td>
                      <td className="rq-muted">#{c.submission_count}</td>
                      <td>{c.review_score !== null ? Math.round(Number(c.review_score)) : '—'}</td>
                      <td className="rq-muted">{ago(c.submitted_at, now)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
