import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import ReviewHistory from '@/components/contributions/ReviewHistory'
import DecisionPanel from './DecisionPanel'
import RetryReview from './RetryReview'
import AdjustComplexity from './AdjustComplexity'
import { SCOPE_CHECK, hasMemberFixableFailure } from '@/lib/contributions/reviewMapping'
import { requireStaff } from '@/lib/contributions/auth'
import { OWN_SUBMISSION_MESSAGE, canDecideOnSubmission } from '@/lib/contributions/decisionRules'
import { getMemberDirectory } from '@/lib/contributions/members'
import { sanitizeBrief } from '@/lib/contributions/sanitize'
import { CATEGORY_LABELS, COMPLEXITY_LABELS } from '@/lib/contributions/constants'
import { QUEUE_TABS, effectiveDeadline, isReviewStale } from '@/lib/contributions/taskView'
import ReviewPoller from '@/components/contributions/ReviewPoller'
import { loadSubmissionNumbers } from '@/lib/contributions/submissionNumber'
import type { Contribution, ContributionReview, Task } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Review' }
// Retrying the automated review waits for the service.
export const maxDuration = 60

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReviewDetailPage({ params }: Props) {
  const auth = await requireStaff()
  if ('error' in auth) notFound()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = createServiceClient() as any
  const { data: c }: { data: Contribution | null } = await supabase.from('contributions').select('*').eq('id', id).maybeSingle()
  if (!c) notFound()
  const [{ data: task }, { data: reviewRows }, members] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', c.task_id).maybeSingle() as Promise<{ data: Task }>,
    supabase.from('contribution_reviews').select('*').eq('contribution_id', c.id)
      .order('submission_number', { ascending: false }).order('created_at', { ascending: false }),
    getMemberDirectory(),
  ])
  const reviews: ContributionReview[] = reviewRows ?? []
  // Did the latest automated review flag the work as not matching the task's complexity?
  const latestReview = reviews.find((r) => r.id === c.latest_review_id) ?? reviews[0]
  const scopeFlagged = (latestReview?.checks as Record<string, unknown> | null)?.[SCOPE_CHECK] === false
  // The service said "rejected" although nothing the member can fix failed.
  const rejectedWithoutMemberFailure = ['needs_human', 'changes_requested'].includes(c.status)
    && latestReview?.source === 'service' && latestReview.decision === 'rejected'
    && !hasMemberFixableFailure(latestReview.checks as Record<string, unknown> | null)
  const member = members.find((m) => m.userId === c.contributor_id)
  const deadline = effectiveDeadline(task)
  const stale = isReviewStale(c)
  const submissionNo = (await loadSubmissionNumbers(supabase)).get(c.id)

  const statusLabel = QUEUE_TABS.find((t) => t.key === c.status)?.label ?? c.status
  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <>
      <style>{`
        .mt-layout { display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: start; }
        .mt-main { display: flex; flex-direction: column; gap: 20px; }
        .mt-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .mt-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .mt-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .mt-kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--off-white); }
        .mt-kv span:first-child { color: var(--grey-mid); }
        .mt-brief { color: var(--off-white); font-size: 14px; line-height: 1.7; }
        .mt-brief a, .mt-link { color: var(--orange); word-break: break-all; }
        .mt-text { color: var(--off-white); font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
        .mt-hint { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
        .mt-input { background: var(--navy-mid, #0b1a2e); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; }
        .mt-textarea { min-height: 90px; resize: vertical; }
        .mt-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 18px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; }
        .mt-btn:disabled { opacity: 0.6; cursor: default; }
        .mt-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .mt-btn.danger { background: none; border-color: rgba(232,69,69,0.35); color: var(--error); }
        .mt-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; }
        .mt-alert.error { background: rgba(232,69,69,0.08); border-color: rgba(232,69,69,0.3); color: var(--error); }
        .mt-alert.warn { background: rgba(212,168,67,0.08); border-color: rgba(212,168,67,0.3); color: var(--warning); line-height: 1.5; }
        .mt-alert.success { background: rgba(34,193,122,0.08); border-color: rgba(34,193,122,0.3); color: var(--success); }
        @media (max-width: 1100px) { .mt-layout { grid-template-columns: 1fr; } .mt-side { position: static; } }
      `}</style>
      <Header title={c.title} description={`${statusLabel} · Submission #${submissionNo ?? '—'} · attempt ${c.submission_count}`}
        action={<Link href={`/dashboard/reviews?tab=${c.status}`} className="mt-btn ghost" style={{ textDecoration: 'none' }}>Back to queue</Link>} />
      <div className="dash-content">
        <div className="mt-layout">
          <div className="mt-main">
            <div className="mt-panel">
              <div className="mt-panel-title">Submission</div>
              <div className="mt-text">{c.description}</div>
              {c.evidence_url && <a className="mt-link" href={c.evidence_url} target="_blank" rel="noopener noreferrer">{c.evidence_url}</a>}
            </div>
            <div className="mt-panel">
              <div className="mt-panel-title">Task brief · {task.title}</div>
              <div className="mt-brief" dangerouslySetInnerHTML={{ __html: sanitizeBrief(task.description) }} />
            </div>
            <ReviewHistory reviews={reviews} showSecurity />
          </div>

          <div className="mt-side">
            <div className="mt-panel">
              <div className="mt-panel-title">Details</div>
              <div className="mt-kv"><span>Member</span><span>{member?.name ?? 'Unknown'}</span></div>
              <div className="mt-kv"><span>Task</span><span>{CATEGORY_LABELS[task.category]} · {COMPLEXITY_LABELS[task.complexity]}</span></div>
              <div className="mt-kv"><span>Points range</span><span>{task.point_range_min}–{task.point_range_max}</span></div>
              <div className="mt-kv"><span>Deadline</span><span>{fmt(deadline?.toISOString() ?? null)}</span></div>
              <div className="mt-kv"><span>Submitted</span><span>{fmt(c.submitted_at)}</span></div>
              {c.review_score !== null && <div className="mt-kv"><span>Automated score</span><span>{Math.round(Number(c.review_score))}/100</span></div>}
              {c.final_points !== null && <div className="mt-kv"><span>Points awarded</span><span>{c.final_points}</span></div>}
            </div>
            {rejectedWithoutMemberFailure && (
              <div className="mt-panel">
                <div className="mt-alert warn">
                  The automated review rejected this although every check the member can fix passed. Its reasons are in the review history: judge them yourself before deciding.
                </div>
              </div>
            )}
            {(c.status === 'review_failed' || stale) && <RetryReview contributionId={c.id} />}
            {['needs_human', 'ai_approved', 'review_failed', 'changes_requested'].includes(c.status) && (
              canDecideOnSubmission(auth.caller, c.contributor_id)
                ? <>
                    <AdjustComplexity contributionId={c.id} category={task.category} complexity={task.complexity} scopeFlagged={scopeFlagged} />
                    <DecisionPanel key={`${task.point_range_min}-${task.point_range_max}`} contributionId={c.id} min={task.point_range_min} max={task.point_range_max} />
                  </>
                : <div className="mt-panel"><span className="mt-hint">{OWN_SUBMISSION_MESSAGE}</span></div>
            )}
            {c.status === 'pending_review' && !stale && (
              <div className="mt-panel"><ReviewPoller /><span className="mt-hint">The automated review is running. Decisions open when it finishes.</span></div>
            )}
            {c.status === 'verified' && <div className="mt-panel"><span className="mt-hint">Verified{c.verified_at ? ` on ${fmt(c.verified_at)}` : ''}. {c.final_points} points awarded.</span></div>}
            {c.status === 'rejected' && <div className="mt-panel"><span className="mt-hint">Rejected. The task was cancelled.</span></div>}
          </div>
        </div>
      </div>
    </>
  )
}
