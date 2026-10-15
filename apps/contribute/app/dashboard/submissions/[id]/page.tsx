import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { COMPLEXITY_LABELS, type Complexity } from '@nextrium/contributions-core/constants'
import { getActiveContributor } from '@/lib/portal'
import { getMyDashboard, getMySubmission } from '@/lib/contributorData'
import { memberFeedback, submissionState } from '@/lib/submissionView'
import { C, F, categoryToken, tint } from '@/lib/theme'
import { NeutralBadge } from '@/components/Badges'
import StatusBadge from '@/components/dashboard/StatusBadge'
import FeedbackPanel from '@/components/dashboard/FeedbackPanel'
import { RetryReviewButton } from '@/components/dashboard/TaskActions'

export const metadata: Metadata = { title: 'Submission' }
export const dynamic = 'force-dynamic'

const label: React.CSSProperties = { fontFamily: F.body, fontSize: 11, color: C.mute, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }
const value: React.CSSProperties = { fontFamily: F.body, fontSize: 14, color: C.light, lineHeight: 1.6 }
const card: React.CSSProperties = { background: C.depth, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }
const cardTitle: React.CSSProperties = { fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light, marginBottom: 16 }
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getActiveContributor()
  if (!me) return null
  const { id } = await params
  const sub = await getMySubmission(me.id, id)
  if (!sub) notFound()

  const { tasks } = await getMyDashboard(me.id)
  const raw = submissionState(sub)
  const held = !!sub.task_id && tasks.some((t) => t.id === sub.task_id)
  const state = raw.canResubmit && !held ? { ...raw, canResubmit: false, hint: 'Claim this task again to resubmit.' } : raw
  const feedback = sub.review_decision ? memberFeedback(sub.review_feedback) : null
  const token = categoryToken(sub.category)
  const verified = sub.status === 'verified'

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 lg:px-14 py-12 lg:py-16">
      <nav aria-label="Breadcrumb" className="flex items-center gap-3 mb-6">
        <Link href="/dashboard?tab=submissions" className="nav-link">Submissions</Link>
        <span aria-hidden="true" style={{ color: C.dim }}>/</span>
        <span style={{ fontFamily: F.body, fontSize: 13, color: C.mute }}>Detail</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="min-w-0">
          <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(24px,3vw,40px)', letterSpacing: '-0.02em', lineHeight: 1.1, color: C.light, marginBottom: 10, overflowWrap: 'anywhere' }}>{sub.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: F.body, fontSize: 11, color: `var(${token})`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sub.category}</span>
            <span aria-hidden="true" style={{ color: C.dim }}>·</span>
            <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute }}>{COMPLEXITY_LABELS[sub.complexity as Complexity] ?? sub.complexity}</span>
            {(sub.submission_count ?? 1) > 1 && <><span aria-hidden="true" style={{ color: C.dim }}>·</span><span style={{ fontFamily: F.body, fontSize: 11, color: C.dim }}>Submission {sub.submission_count}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
          <div className="text-right">
            <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 28, color: `var(${token})`, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{verified ? sub.final_points ?? sub.base_points : sub.base_points}</div>
            <div style={{ fontFamily: F.body, fontSize: 10, color: C.mute, marginTop: 2 }}>{verified ? 'pts' : 'est. pts'}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl flex-wrap" style={{ background: tint('--orange', 5), border: `1px solid ${C.border}` }}>
          <p style={{ fontFamily: F.body, fontSize: 13, color: C.mist, lineHeight: 1.6, flex: 1, minWidth: 200 }}>{state.hint}</p>
          {state.canRetryReview && <RetryReviewButton contributionId={sub.id} />}
          {state.canResubmit && (
            <Link href={`/dashboard?tab=tasks#task-${sub.task_id}`} className="btn-primary" style={{ fontSize: 12, padding: '8px 18px' }}>Resubmit</Link>
          )}
        </div>

        <section style={card}>
          <h2 style={cardTitle}>Submission</h2>
          <div className="mb-5">
            <span style={label}>Description</span>
            <p style={{ ...value, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{sub.description || <span style={{ color: C.dim }}>No description provided.</span>}</p>
          </div>
          <div className={sub.notes ? 'mb-5' : ''}>
            <span style={label}>Evidence</span>
            {sub.evidence_url ? (
              <a href={sub.evidence_url} target="_blank" rel="noopener noreferrer" style={{ ...value, color: C.accent, overflowWrap: 'anywhere', textDecoration: 'none' }}>{sub.evidence_url} ↗</a>
            ) : (
              <p style={{ ...value, color: C.dim }}>No evidence link.</p>
            )}
          </div>
          {sub.notes && (
            <div>
              <span style={label}>Note from the core team</span>
              <p style={{ ...value, whiteSpace: 'pre-wrap' }}>{sub.notes}</p>
            </div>
          )}
        </section>

        <section style={card}>
          <h2 style={cardTitle}>Scoring</h2>
          <dl className="grid sm:grid-cols-2 gap-y-5 gap-x-8">
            <div><dt style={label}>Estimated points</dt><dd style={value}>{sub.base_points}</dd></div>
            <div><dt style={label}>Final points</dt><dd style={value}>{verified ? sub.final_points ?? sub.base_points : '—'}</dd></div>
            <div><dt style={label}>Review score</dt><dd style={value}>{sub.review_score ?? '—'}</dd></div>
            <div><dt style={label}>Submitted</dt><dd style={value}>{fmt(sub.created_at)}</dd></div>
            <div><dt style={label}>Deadline</dt><dd style={value}>{fmt(sub.deadline_at)}</dd></div>
            <div><dt style={label}>Verified</dt><dd style={value}>{fmt(sub.verified_at)}</dd></div>
          </dl>
        </section>

        {feedback && (
          <section style={card}>
            <h2 style={cardTitle}>Review feedback</h2>
            <FeedbackPanel feedback={feedback} score={sub.review_score} attempt={sub.submission_count} />
          </section>
        )}

        {sub.task && (
          <section style={card}>
            <h2 style={cardTitle}>Task</h2>
            <div className="mb-4">
              <span style={label}>Title</span>
              <Link href={`/dashboard/tasks/${sub.task.id}`} style={{ ...value, color: C.accent, textDecoration: 'none' }}>{sub.task.title}</Link>
            </div>
            {sub.task.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">{sub.task.tags.map((t) => <NeutralBadge key={t}>{t}</NeutralBadge>)}</div>
            )}
            {sub.task.descriptionHtml && (
              <div className="mb-4">
                <span style={label}>Brief</span>
                {/* Sanitised on the server by sanitizeBrief. */}
                <div className="task-description" style={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: sub.task.descriptionHtml }} />
              </div>
            )}
            <dl className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
              <div><dt style={label}>Point range</dt><dd style={value}>{sub.task.point_range_min}–{sub.task.point_range_max}</dd></div>
              <div><dt style={label}>Deadline window</dt><dd style={value}>{sub.task.deadline_days ? `${sub.task.deadline_days} days` : '—'}</dd></div>
            </dl>
            {sub.task.links.length > 0 && (
              <div className="mt-4">
                <span style={label}>Task links</span>
                <ul className="flex flex-col gap-1 mt-1">
                  {sub.task.links.map((l) => (
                    <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: F.body, fontSize: 13, color: C.accent, textDecoration: 'none', overflowWrap: 'anywhere' }}>{l.label} ↗</a></li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <Link href="/dashboard?tab=submissions" className="btn-outline self-start" style={{ fontSize: 13 }}>Back to submissions</Link>
      </div>
    </div>
  )
}
