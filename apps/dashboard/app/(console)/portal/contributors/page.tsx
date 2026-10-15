import Link from 'next/link'
import { notFound } from 'next/navigation'
import { brand } from '@nextrium/brand'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { community, contributorName, requirePortalStaff } from '@/lib/portal/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal contributors' }

export default async function PortalContributorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if ('error' in (await requirePortalStaff())) notFound()
  const q = ((await searchParams).q ?? '').trim().toLowerCase().slice(0, 100)

  const db = community()
  const [{ data: people, error: e1 }, { data: running, error: e2 }, { data: waiting, error: e3 }] = await Promise.all([
    db.from('contributors').select('id, name, email, contributor_type, team_name, categories, location, total_points, verified_contributions, max_claims').eq('status', 'active'),
    db.from('tasks').select('assigned_to').eq('status', 'assigned'),
    db.from('contributions').select('contributor_id').in('status', ['submitted', 'under_review', 'ai_approved']),
  ])
  if (e1 || e2 || e3) throw new Error('Could not load contributors')
  const tally = (rows: { [k: string]: string | null }[] | null, key: string) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) if (r[key]) m.set(r[key]!, (m.get(r[key]!) ?? 0) + 1)
    return m
  }
  const runningBy = tally(running, 'assigned_to')
  const waitingBy = tally(waiting, 'contributor_id')
  const list = (people ?? [])
    .filter((p) => !q || [p.name, p.email, p.team_name ?? '', p.location ?? ''].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0) || a.name.localeCompare(b.name))

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="Portal contributors" description="Approved contributors, their points and current work" action={<Link href="/portal/applicants" className="pt-btn ghost">Applicants</Link>} />
      <div className="dash-content">
        <form className="pt-search" method="get">
          <input name="q" aria-label="Search contributors" defaultValue={q} placeholder="Search name, email, team or location" className="pt-input" />
          <button type="submit" className="pt-btn ghost">Search</button>
        </form>
        {list.length === 0 ? (
          <div className="pt-empty">No approved contributors{q ? ' match that search' : ' yet'}.</div>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead><tr><th>Contributor</th><th>Categories</th><th>Points</th><th>Verified</th><th>Running</th><th>Waiting review</th><th></th></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/portal/applicants/${p.id}`} className="title">{contributorName(p)}</Link>
                      <div className="pt-muted">{p.email}</div>
                    </td>
                    <td className="pt-muted">{(p.categories ?? []).join(', ')}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{(p.total_points ?? 0).toLocaleString('en-GB')}</td>
                    <td className="pt-muted">{p.verified_contributions ?? 0}</td>
                    <td className="pt-muted">{runningBy.get(p.id) ?? 0}/{p.max_claims ?? 2}</td>
                    <td>{waitingBy.get(p.id) ? <span className="pt-badge warn">{waitingBy.get(p.id)}</span> : <span className="pt-muted">0</span>}</td>
                    <td style={{ textAlign: 'right' }}><a className="pt-link" href={`${brand.urls.contribute}/contributors/${p.id}`} target="_blank" rel="noopener noreferrer">Public profile</a></td>
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
