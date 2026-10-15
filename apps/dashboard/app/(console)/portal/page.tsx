import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brand } from '@nextrium/brand'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { community, requirePortalStaff } from '@/lib/portal/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contributor portal' }

async function count(table: 'contributors' | 'tasks' | 'contributions', filter: (q: any) => any): Promise<number> {
  const { count: n, error } = await filter(community().from(table).select('id', { count: 'exact', head: true }))
  if (error) throw new Error('Could not load portal counts')
  return n ?? 0
}

export default async function PortalOverviewPage() {
  // Staff only, checked here as well as by the page gate: this reads the community database with the service key.
  if ('error' in (await requirePortalStaff())) notFound()

  const [pending, revision, active, openTasks, runningTasks, extensions, awaitingTeam, awaitingReview] = await Promise.all([
    count('contributors', (q) => q.eq('status', 'pending')),
    count('contributors', (q) => q.eq('status', 'revision_requested')),
    count('contributors', (q) => q.eq('status', 'active')),
    count('tasks', (q) => q.eq('status', 'open')),
    count('tasks', (q) => q.eq('status', 'assigned')),
    count('tasks', (q) => q.eq('status', 'assigned').not('extension_requested_at', 'is', null).eq('extension_granted', false)),
    count('contributions', (q) => q.in('status', ['under_review', 'ai_approved'])),
    count('contributions', (q) => q.eq('status', 'submitted')),
  ])

  const stats: { label: string; value: number; href?: string; alert?: boolean }[] = [
    { label: 'Applications to review', value: pending, href: '/portal/applicants', alert: pending > 0 },
    { label: 'Waiting on applicant changes', value: revision, href: '/portal/applicants?status=revision_requested' },
    { label: 'Approved contributors', value: active, href: '/portal/applicants?status=active' },
    { label: 'Submissions waiting for the team', value: awaitingTeam, alert: awaitingTeam > 0 },
    { label: 'Awaiting automated review', value: awaitingReview },
    { label: 'Open tasks', value: openTasks },
    { label: 'Tasks in progress', value: runningTasks },
    { label: 'Extension requests', value: extensions, alert: extensions > 0 },
  ]

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header
        title="Contributor portal"
        description={`Applicants, tasks and submissions for ${brand.urls.contribute.replace(/^https?:\/\//, '')}`}
        action={<a href={brand.urls.contribute} target="_blank" rel="noopener noreferrer" className="pt-btn ghost">Open the portal</a>}
      />
      <div className="dash-content">
        <div className="pt-grid">
          {stats.map((s) => {
            const body = (
              <>
                <span className={`v${s.alert ? ' alert' : ''}`}>{s.value.toLocaleString('en-GB')}</span>
                <span className="l">{s.label}</span>
              </>
            )
            return s.href
              ? <Link key={s.label} href={s.href} className="pt-stat">{body}</Link>
              : <div key={s.label} className="pt-stat">{body}</div>
          })}
        </div>
        <p className="pt-hint">The portal has its own database. Changes here apply to the contributor portal, not to this dashboard&apos;s contributor program.</p>
      </div>
    </>
  )
}
