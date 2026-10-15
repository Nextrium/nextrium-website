import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { APPLICANT_STATUSES, APPLICANT_STATUS_BADGE as STATUS_BADGE, APPLICANT_STATUS_LABELS, type ApplicantStatus } from '@/lib/portal/applicantRules'
import { community, contributorName, requirePortalStaff } from '@/lib/portal/server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal applicants' }

const TAB_ORDER: ApplicantStatus[] = ['pending', 'revision_requested', 'active', 'rejected', 'inactive']

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>
}

export default async function ApplicantsPage({ searchParams }: Props) {
  if ('error' in (await requirePortalStaff())) notFound()

  const params = await searchParams
  const status: ApplicantStatus = (APPLICANT_STATUSES as readonly string[]).includes(params.status ?? '') ? (params.status as ApplicantStatus) : 'pending'
  const q = (params.q ?? '').trim().slice(0, 100)

  const db = community()
  const [{ data: all, error: countError }, { data: rows, error }] = await Promise.all([
    db.from('contributors').select('status'),
    db
      .from('contributors')
      .select('id, name, email, contributor_type, team_name, categories, location, status, created_at, total_points')
      .eq('status', status)
      .order('created_at', { ascending: status !== 'pending' ? false : true })
      .limit(500),
  ])
  if (countError || error) throw new Error('Could not load applicants')

  const counts = new Map<string, number>()
  for (const r of all ?? []) counts.set(r.status ?? '', (counts.get(r.status ?? '') ?? 0) + 1)

  // Search in memory (the list is small), so no user text reaches a query filter.
  const needle = q.toLowerCase()
  const list = (rows ?? []).filter((r) => !needle || [r.name, r.email, r.team_name ?? '', r.location ?? ''].some((v) => v.toLowerCase().includes(needle)))
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="Portal applicants" description="Approve, return or decline contributor applications" action={<Link href="/portal" className="pt-btn ghost">Portal overview</Link>} />
      <div className="dash-content">
        <nav className="pt-tabs" aria-label="Applicant status">
          {TAB_ORDER.map((s) => (
            <Link key={s} href={`/portal/applicants?status=${s}`} className="pt-tab" aria-current={s === status ? 'page' : undefined}>
              {APPLICANT_STATUS_LABELS[s]}<span className="n">{counts.get(s) ?? 0}</span>
            </Link>
          ))}
        </nav>

        <form className="pt-search" method="get">
          <input type="hidden" name="status" value={status} />
          <input id="pt-q" name="q" aria-label="Search applicants" defaultValue={q} placeholder="Search name, email, team or location" className="pt-input" />
          <button type="submit" className="pt-btn ghost">Search</button>
        </form>

        {list.length === 0 ? (
          <div className="pt-empty">{q ? 'No applicants match that search.' : `No applicants are ${APPLICANT_STATUS_LABELS[status].toLowerCase()} right now.`}</div>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr><th>Applicant</th><th>Email</th><th>Categories</th><th>Location</th><th>Applied</th><th>Status</th></tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/portal/applicants/${r.id}`} className="title">{contributorName(r)}</Link>
                      {r.contributor_type === 'team' && <div className="pt-muted">Team · {r.name}</div>}
                    </td>
                    <td className="pt-muted">{r.email}</td>
                    <td className="pt-muted">{(r.categories ?? []).join(', ')}</td>
                    <td className="pt-muted">{r.location ?? '—'}</td>
                    <td className="pt-muted">{fmt(r.created_at)}</td>
                    <td><span className={`pt-badge ${STATUS_BADGE[(r.status ?? 'inactive') as ApplicantStatus] ?? ''}`}>{APPLICANT_STATUS_LABELS[(r.status ?? 'inactive') as ApplicantStatus] ?? r.status}</span></td>
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
