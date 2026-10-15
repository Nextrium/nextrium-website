import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { APPLICANT_STATUS_BADGE, APPLICANT_STATUS_LABELS, actionsFor, canDecideOnApplicant, type ApplicantStatus } from '@/lib/portal/applicantRules'
import { UUID, community, contributorName, requirePortalStaff } from '@/lib/portal/server'
import ApplicantDecision from './ApplicantDecision'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal applicant' }

const AVAILABILITY: Record<number, string> = { 2: '1-2 hours per week', 5: '3-5 hours per week', 10: '6-10 hours per week', 20: '10-20 hours per week', 40: 'Full time (20+ hours)' }

function safeHref(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export default async function ApplicantPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalStaff()
  if ('error' in auth) notFound()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const db = community()
  const { data: c, error } = await db.from('contributors').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load the applicant')
  if (!c) notFound()

  const { data: history } = await db
    .from('admin_audit_log')
    .select('id, actor_name, action, metadata, created_at')
    .eq('target_type', 'contributor')
    .eq('target_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const status = (c.status ?? 'inactive') as ApplicantStatus
  const name = contributorName(c)
  const canDecide = canDecideOnApplicant(auth.caller, c.email)
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
  const linkedin = safeHref(c.linkedin_url)
  const portfolio = safeHref(c.portfolio_url)

  const rows: [string, React.ReactNode][] = [
    ['Name', c.name],
    ['Email', c.email],
    ['Type', c.contributor_type === 'team' ? `Team · ${c.team_name ?? ''}` : 'Individual'],
    ['Categories', (c.categories ?? []).join(', ') || '—'],
    ['Location', c.location ?? '—'],
    ['Timezone', c.timezone ?? '—'],
    ['Availability', c.availability_hours_per_week ? AVAILABILITY[c.availability_hours_per_week] ?? `${c.availability_hours_per_week} h/week` : '—'],
    ['Skills', (c.skills ?? []).join(', ') || '—'],
    ['GitHub', c.github_handle ? <a className="pt-link" href={`https://github.com/${encodeURIComponent(c.github_handle.replace(/^@/, ''))}`} target="_blank" rel="noopener noreferrer">{c.github_handle}</a> : '—'],
    ['Twitter / X', c.twitter_handle ? <a className="pt-link" href={`https://x.com/${encodeURIComponent(c.twitter_handle.replace(/^@/, ''))}`} target="_blank" rel="noopener noreferrer">{c.twitter_handle}</a> : '—'],
    ['LinkedIn', linkedin ? <a className="pt-link" href={linkedin} target="_blank" rel="noopener noreferrer">{c.linkedin_url}</a> : '—'],
    ['Portfolio', portfolio ? <a className="pt-link" href={portfolio} target="_blank" rel="noopener noreferrer">{c.portfolio_url}</a> : '—'],
    ['Wallet', c.wallet_address ?? '—'],
    ['Applied', fmt(c.created_at)],
  ]

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title={name} description={`${APPLICANT_STATUS_LABELS[status] ?? status} · portal applicant`} action={<Link href={`/portal/applicants?status=${status}`} className="pt-btn ghost">Back to applicants</Link>} />
      <div className="dash-content">
        <div className="pt-layout">
          <div className="pt-main">
            <section className="pt-panel">
              <div className="pt-panel-title">Bio</div>
              <p style={{ color: 'var(--off-white)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.bio || '—'}</p>
            </section>
            <section className="pt-panel">
              <div className="pt-panel-title">Application</div>
              <dl className="pt-kv">
                {rows.map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {(c.revision_notes || c.rejection_reason) && (
              <section className="pt-panel">
                <div className="pt-panel-title">{c.revision_notes ? 'Changes requested' : 'Reason not approved'}</div>
                <p style={{ color: 'var(--off-white)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.revision_notes ?? c.rejection_reason}</p>
              </section>
            )}
            <section className="pt-panel">
              <div className="pt-panel-title">History</div>
              {(history ?? []).length === 0 ? (
                <p className="pt-hint">No decisions recorded yet.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none' }}>
                  {(history ?? []).map((h) => (
                    <li key={h.id} className="pt-hint">
                      <span style={{ color: 'var(--off-white)' }}>{h.action.replace(/^contributor\./, '').replace(/_/g, ' ')}</span> by {h.actor_name} · {fmt(h.created_at)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="pt-side">
            <div className="pt-panel">
              <div className="pt-panel-title">Status</div>
              <span className={`pt-badge ${APPLICANT_STATUS_BADGE[status] ?? ''}`}>{APPLICANT_STATUS_LABELS[status] ?? c.status}</span>
              {status === 'active' && (
                <div className="pt-hint">{(c.total_points ?? 0).toLocaleString('en-GB')} points · {c.verified_contributions ?? 0} verified · up to {c.max_claims ?? 2} running tasks</div>
              )}
            </div>
            {canDecide ? (
              <ApplicantDecision contributorId={c.id} actions={actionsFor(status)} />
            ) : (
              <div className="pt-alert info">This is your own application. An admin will decide on it.</div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
