import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATEGORY_LABELS, COMPLEXITY_LABELS, type Category, type Complexity } from '@nextrium/contributions-core/constants'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { community, contributorName, requirePortalStaff } from '@/lib/portal/server'
import { QUEUE_TABS, queueTab, type QueueTab } from '@/lib/portal/reviewRules'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal review queue' }

const BADGE: Record<QueueTab, string> = { team: 'warn', passed: 'info', pending: '', changes: 'info', verified: 'good', rejected: 'bad' }

export default async function PortalReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if ('error' in (await requirePortalStaff())) notFound()
  const { tab: raw } = await searchParams
  const tab: QueueTab = QUEUE_TABS.some((t) => t.key === raw) ? (raw as QueueTab) : 'team'

  const db = community()
  const [{ data: subs, error: e1 }, { data: people, error: e2 }] = await Promise.all([
    db.from('contributions').select('id, contributor_id, title, category, complexity, status, notes, submission_count, review_decision, review_score, base_points, final_points, created_at, updated_at').order('updated_at', { ascending: false }).limit(1000),
    db.from('contributors').select('id, name, contributor_type, team_name'),
  ])
  if (e1 || e2) throw new Error('Could not load the review queue')
  const nameOf = new Map((people ?? []).map((p) => [p.id, contributorName(p)]))
  const all = subs ?? []
  const counts = new Map<QueueTab, number>()
  for (const s of all) counts.set(queueTab(s), (counts.get(queueTab(s)) ?? 0) + 1)
  const list = all.filter((s) => queueTab(s) === tab)
  // Oldest first where staff act, newest first in the history tabs.
  if (tab !== 'verified' && tab !== 'rejected') list.reverse()
  const current = QUEUE_TABS.find((t) => t.key === tab)!
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="Portal review queue" description="Verify portal submissions and award points" action={<Link href="/portal" className="pt-btn ghost">Portal overview</Link>} />
      <div className="dash-content">
        <nav className="pt-tabs" aria-label="Queue">
          {QUEUE_TABS.map((t) => (
            <Link key={t.key} href={`/portal/reviews?tab=${t.key}`} className="pt-tab" aria-current={t.key === tab ? 'page' : undefined}>
              {t.label}<span className="n">{counts.get(t.key) ?? 0}</span>
            </Link>
          ))}
        </nav>
        <p className="pt-hint" style={{ marginBottom: 14 }}>{current.hint}</p>

        {list.length === 0 ? (
          <div className="pt-empty">Nothing here.</div>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead><tr><th>Submission</th><th>Contributor</th><th>Category</th><th>Attempt</th><th>Score</th><th>{tab === 'verified' ? 'Points' : 'Updated'}</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/portal/reviews/${s.id}`} className="title">{s.title}</Link></td>
                    <td className="pt-muted">{s.contributor_id ? nameOf.get(s.contributor_id) ?? '—' : '—'}</td>
                    <td className="pt-muted">{CATEGORY_LABELS[s.category as Category] ?? s.category} · {COMPLEXITY_LABELS[s.complexity as Complexity] ?? s.complexity}</td>
                    <td className="pt-muted">{s.submission_count ?? 1}/3</td>
                    <td className="pt-muted">{s.review_score ?? '—'}</td>
                    <td className="pt-muted">{tab === 'verified' ? s.final_points ?? s.base_points : fmt(s.updated_at ?? s.created_at)}</td>
                    <td style={{ textAlign: 'right' }}><span className={`pt-badge ${BADGE[tab]}`}>{current.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
