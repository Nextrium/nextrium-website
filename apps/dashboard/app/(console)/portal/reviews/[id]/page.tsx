import Link from 'next/link'
import { notFound } from 'next/navigation'
import { POINT_RANGES, isCategory, isComplexity } from '@nextrium/contributions-core/constants'
import { isStaffOnlyIssue } from '@nextrium/contributions-core/reviewMapping'
import { sanitizeBrief } from '@nextrium/contributions-core/sanitize'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { UUID, community, contributorName, requirePortalStaff } from '@/lib/portal/server'
import { QUEUE_TABS, canDecideOnPortalSubmission, isDecidable, queueTab } from '@/lib/portal/reviewRules'
import PortalDecisionPanel from './PortalDecisionPanel'
import { findSimilar } from '@/lib/contributions/groupRules'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal submission' }

const label = (k: string) => { const s = k.replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1) }

function safeHref(url: string | null): string | null {
  if (!url) return null
  try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null } catch { return null }
}

export default async function PortalSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalStaff()
  if ('error' in auth) notFound()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const db = community()
  const { data: s, error } = await db.from('contributions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load the submission')
  if (!s) notFound()
  const [{ data: c }, { data: task }] = await Promise.all([
    s.contributor_id ? db.from('contributors').select('id, name, email, contributor_type, team_name, total_points, verified_contributions').eq('id', s.contributor_id).maybeSingle() : Promise.resolve({ data: null }),
    s.task_id ? db.from('tasks').select('id, title, description, point_range_min, point_range_max, status, shared_from').eq('id', s.task_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const tab = queueTab(s)
  const tabLabel = QUEUE_TABS.find((t) => t.key === tab)?.label ?? s.status
  const range = task ?? (isCategory(s.category) && isComplexity(s.complexity) ? { point_range_min: POINT_RANGES[s.category][s.complexity].min, point_range_max: POINT_RANGES[s.category][s.complexity].max } : null)
  const canDecide = !!c && canDecideOnPortalSubmission(auth.caller, c.email)
  const fb = (s.review_feedback && typeof s.review_feedback === 'object' ? s.review_feedback : {}) as Record<string, any>
  const issues: { check: string; message: string }[] = Array.isArray(fb.issues) ? fb.issues.filter((i: any) => i && typeof i.message === 'string') : []
  const checks = fb.checks && typeof fb.checks === 'object' ? Object.entries(fb.checks as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean') : []
  const security: { severity?: string; description?: string; message?: string; file?: string }[] = Array.isArray(fb.code_audit?.security_issues) ? fb.code_audit.security_issues : []
  const evidence = safeHref(s.evidence_url)

  // On a copy of a shared task: other claimers' submissions that look like this one (staff only).
  let similar: { id: string; name: string; score: number; sameLink: boolean }[] = []
  if (task?.shared_from) {
    const { data: copies } = await db.from('tasks').select('id').eq('shared_from', task.shared_from).neq('id', task.id)
    const copyIds = (copies ?? []).map((x) => x.id)
    const { data: others } = copyIds.length
      ? await db.from('contributions').select('id, contributor_id, description, evidence_url').in('task_id', copyIds)
      : { data: [] }
    const found = findSimilar({ id: s.id, description: s.description ?? '', evidence_url: s.evidence_url }, (others ?? []).map((o) => ({ id: o.id, description: o.description ?? '', evidence_url: o.evidence_url })))
    if (found.length) {
      const owners = new Map((others ?? []).map((o) => [o.id, o.contributor_id]))
      const ids = [...new Set(found.map((f) => owners.get(f.id)).filter((x): x is string => !!x))]
      const { data: people } = await db.from('contributors').select('id, name, contributor_type, team_name').in('id', ids)
      const nameOf = new Map((people ?? []).map((p) => [p.id, contributorName(p)]))
      similar = found.map((f) => ({ ...f, name: nameOf.get(owners.get(f.id) ?? '') ?? 'Another contributor' }))
    }
  }
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title={s.title} description={`${tabLabel} · attempt ${s.submission_count ?? 1} of 3`} action={<Link href={`/portal/reviews?tab=${tab}`} className="pt-btn ghost">Back to queue</Link>} />
      <div className="dash-content">
        <div className="pt-layout">
          <div className="pt-main">
            <section className="pt-panel">
              <div className="pt-panel-title">Submission</div>
              <p style={{ color: 'var(--off-white)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.description || '—'}</p>
              {evidence ? <a className="pt-link" href={evidence} target="_blank" rel="noopener noreferrer">{evidence}</a> : <span className="pt-hint">No evidence link.</span>}
              {s.notes && <div className="pt-alert info">Note to the contributor: {s.notes}</div>}
            </section>

            <section className="pt-panel">
              <div className="pt-panel-title">Automated review{s.review_decision ? ` · ${label(s.review_decision)}` : ' · not completed'}{s.review_score != null ? ` · ${s.review_score}/100` : ''}</div>
              {!s.review_decision && <p className="pt-hint">The automated review has not completed for this attempt. You can still decide on it.</p>}
              {fb.summary && <p style={{ color: 'var(--off-white)', fontSize: 13, lineHeight: 1.7 }}>{fb.summary}</p>}
              {checks.length > 0 && (
                <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6, listStyle: 'none' }}>
                  {checks.map(([k, v]) => (
                    <li key={k} className="pt-hint" style={{ color: v ? 'var(--success)' : 'var(--error)' }}>
                      {v ? '✓' : '✗'} {label(k)}{isStaffOnlyIssue(k) && <span className="pt-badge" style={{ marginLeft: 6 }}>staff only</span>}
                    </li>
                  ))}
                </ul>
              )}
              {issues.length > 0 && (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none' }}>
                  {issues.map((i, n) => (
                    <li key={n} style={{ fontSize: 13, color: 'var(--off-white)', lineHeight: 1.6 }}>
                      <span className={`pt-badge ${isStaffOnlyIssue(i.check) ? 'warn' : 'info'}`} style={{ marginRight: 8 }}>{label(i.check)}{isStaffOnlyIssue(i.check) ? ' · staff only' : ''}</span>
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}
              {fb.what_to_do && <p className="pt-hint"><strong style={{ color: 'var(--off-white)' }}>What to do:</strong> {fb.what_to_do}</p>}
              {security.length > 0 && (
                <div className="pt-alert error">
                  <strong>Security findings ({security.length})</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                    {security.map((x, n) => <li key={n}>{x.severity ? `[${x.severity}] ` : ''}{x.description ?? x.message ?? 'Issue'}{x.file ? ` — ${x.file}` : ''}</li>)}
                  </ul>
                </div>
              )}
              {fb.resubmission_assessment?.summary && <p className="pt-hint"><strong style={{ color: 'var(--off-white)' }}>Compared with the last attempt:</strong> {fb.resubmission_assessment.summary}</p>}
              {fb.model && <p className="pt-hint">Model: {String(fb.model)}</p>}
            </section>

            {task && (
              <section className="pt-panel">
                <div className="pt-panel-title">Task brief · <Link href={`/portal/tasks/${task.id}`} className="pt-link">{task.title}</Link></div>
                <div style={{ color: 'var(--off-white)', fontSize: 14, lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: sanitizeBrief(task.description ?? '') }} />
              </section>
            )}
          </div>

          <div className="pt-side">
            {similar.length > 0 && (
              <div className="pt-panel" data-similar>
                <div className="pt-alert warn">This task was open to several contributors, and this submission looks like {similar.length === 1 ? 'another one' : `${similar.length} others`} on it. Compare them before deciding.</div>
                {similar.map((x) => (
                  <div key={x.id} className="pt-kv" style={{ gridTemplateColumns: '1fr auto' }}>
                    <span>{x.name}</span>
                    <span>{x.sameLink ? 'Same evidence link' : `${Math.round(x.score * 100)}% same wording`} · <Link href={`/portal/reviews/${x.id}`}>Open</Link></span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-panel">
              <div className="pt-panel-title">Details</div>
              <dl className="pt-kv" style={{ gridTemplateColumns: '110px 1fr' }}>
                <dt>Contributor</dt><dd>{c ? <Link href={`/portal/applicants/${c.id}`} className="pt-link">{contributorName(c)}</Link> : '—'}</dd>
                <dt>Status</dt><dd>{tabLabel}</dd>
                <dt>Range</dt><dd>{range ? `${range.point_range_min}–${range.point_range_max}` : '—'}</dd>
                {s.status === 'verified' && <><dt>Awarded</dt><dd>{s.final_points ?? s.base_points}</dd><dt>Verified</dt><dd>{fmt(s.verified_at)}</dd></>}
                <dt>Submitted</dt><dd>{fmt(s.created_at)}</dd>
                <dt>Deadline</dt><dd>{fmt(s.deadline_at)}</dd>
              </dl>
            </div>
            {isDecidable(s) && range && (canDecide
              ? <PortalDecisionPanel contributionId={s.id} min={range.point_range_min} max={range.point_range_max} />
              : <div className="pt-alert info">This is your own submission. An admin will decide on it.</div>)}
          </div>
        </div>
      </div>
    </>
  )
}
