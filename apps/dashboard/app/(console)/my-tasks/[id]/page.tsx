import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireMember } from '@/lib/contributions/auth'
import { safeHref } from '@/lib/dashboard/safeHref'
import { CATEGORY_LABELS, COMPLEXITY_LABELS, EXTENSION_DAYS } from '@nextrium/contributions-core/constants'
import { CONTRIBUTION_STATUS_MEMBER_LABELS, TASK_STATUS_LABELS, deadlineLabel, effectiveDeadline, isOverdue } from '@nextrium/contributions-core/taskView'
import { MAX_ATTEMPTS, canResubmitTeam, latestStaffFeedbackNote, type AttemptSnapshot, type ThreadMessage, type TimelineReview } from '@nextrium/contributions-core/thread'
import ExtensionRequest from './ExtensionRequest'
import SubmissionForm from './SubmissionForm'
import SubmissionTimeline from '@/components/contributions/SubmissionTimeline'
import ReviewPoller from '@/components/contributions/ReviewPoller'
import { postContributorReply } from '../actions'
import { loadSubmissionNumbers } from '@nextrium/contributions-core/submissionNumber'
import { sanitizeBrief } from '@nextrium/contributions-core/sanitize'
import type { Contribution, ContributionReview, Task } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Task' }
// The submit action finishes its automated review after responding.
export const maxDuration = 60

interface Props {
  params: Promise<{ id: string }>
}

export default async function MyTaskPage({ params }: Props) {
  const auth = await requireMember()
  if ('error' in auth) notFound()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = createServiceClient() as any
  // 404 unless this task is assigned to the caller — never reveal others' tasks.
  const { data } = await supabase.from('tasks').select('*').eq('id', id).eq('assigned_to', auth.caller.userId).maybeSingle()
  const task: Task | null = data
  if (!task || task.status === 'draft') notFound()

  const { data: contributionRow } = await supabase.from('contributions')
    .select('*').eq('task_id', task.id).eq('contributor_id', auth.caller.userId).maybeSingle()
  const contribution: Contribution | null = contributionRow
  // Hide tasks cancelled before submission, but keep rejected-submission tasks open so the member can read feedback and reply.
  if (task.status === 'cancelled' && !contribution) notFound()

  const [{ data: reviewRows }, { data: messageRows }, { data: attemptRows }] = contribution
    ? await Promise.all([
        supabase.from('contribution_reviews').select('*').eq('contribution_id', contribution.id)
          .order('submission_number', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('contribution_messages').select('*').eq('contribution_id', contribution.id)
          .order('created_at', { ascending: true }),
        supabase.from('contribution_attempts').select('*').eq('contribution_id', contribution.id)
          .order('submission_number', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]
  const reviews: ContributionReview[] = reviewRows ?? []
  const messages: ThreadMessage[] = messageRows ?? []
  const attempts: AttemptSnapshot[] = attemptRows ?? []
  const submissionNo = contribution ? (await loadSubmissionNumbers(supabase)).get(contribution.id) : undefined

  // If this task is a follow-up from an earlier submission, show only the original task title (and link only if the caller owned it).
  let followUpSource: { title: string; ownTaskId: string | null } | null = null
  if (task.source_contribution_id) {
    const { data: srcSub } = await supabase.from('contributions')
      .select('task_id, contributor_id').eq('id', task.source_contribution_id).maybeSingle()
    if (srcSub?.task_id) {
      const { data: srcTask } = await supabase.from('tasks').select('title').eq('id', srcSub.task_id).maybeSingle()
      if (srcTask?.title) {
        followUpSource = {
          title: srcTask.title,
          ownTaskId: srcSub.contributor_id === auth.caller.userId ? srcSub.task_id : null,
        }
      }
    }
  }

  // On a shared task the member learns only how many have it: never who, never their work.
  const { count: sharedWith } = task.group_id
    ? await supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('group_id', task.group_id).neq('status', 'cancelled')
    : { count: 0 }

  const now = new Date()
  const deadline = effectiveDeadline(task)
  const open = task.status === 'assigned' || task.status === 'changes_requested'
  const canRequestExtension = open && task.extension_status === 'none' && !!deadline && now < deadline
  const canSubmit = canResubmitTeam(open, contribution)
  const latestFeedback = contribution
    ? latestStaffFeedbackNote({
        messages,
        reviews: reviews as unknown as TimelineReview[],
        fallbackStaffNotes: contribution.staff_notes,
      })
    : null
  const safeEvidence = safeHref(contribution?.evidence_url)

  return (
    <>
      <style>{`
        .mt-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: start; }
        .mt-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .mt-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; min-width: 0; }
        .mt-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .mt-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .mt-kv { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13px; color: var(--off-white); }
        .mt-kv span:first-child { color: var(--grey-mid); }
        .mt-kv .bad { color: var(--error); }
        .mt-brief { color: var(--off-white); font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
        .mt-brief a, .mt-link { color: var(--orange); word-break: break-all; }
        .mt-brief img { max-width: 100%; }
        .mt-links a { display: block; color: var(--orange); font-size: 13px; margin-bottom: 6px; word-break: break-all; }
        .mt-hint { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
        .mt-input { background: var(--navy-mid, #0b1a2e); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; }
        .mt-textarea { min-height: 90px; resize: vertical; }
        .mt-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 18px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; width: fit-content; min-height: 38px; }
        .mt-btn:disabled { opacity: 0.6; cursor: default; }
        .mt-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .mt-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; }
        .mt-alert.error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
        .mt-alert.ok, .mt-alert.success { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
        .mt-feedback-banner { border: 1px solid color-mix(in srgb, var(--orange) 35%, transparent); background: color-mix(in srgb, var(--orange) 7%, transparent); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
        .mt-feedback-body { color: var(--white); font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
        @media (max-width: 1100px) { .mt-layout { grid-template-columns: 1fr; } .mt-side { position: static; } }
      `}</style>
      <Header title={task.title} description={`${CATEGORY_LABELS[task.category]} · ${COMPLEXITY_LABELS[task.complexity]} · ${TASK_STATUS_LABELS[task.status]}`} />
      <div className="dash-content">
        <div className="mt-layout">
          <div className="mt-main">
            {followUpSource && (
              <div className="mt-panel">
                <div className="mt-panel-title">Follow-up context</div>
                <div className="mt-hint" style={{ color: 'var(--off-white)' }}>
                  Follow-up task building on{' '}
                  {followUpSource.ownTaskId
                    ? <Link href={`/my-tasks/${followUpSource.ownTaskId}`} className="mt-link">{followUpSource.title}</Link>
                    : <strong>{followUpSource.title}</strong>}.
                </div>
              </div>
            )}
            <div className="mt-panel">
              <div className="mt-panel-title">Brief</div>
              {/* Sanitized again at render (server-side), not only when staff save it,
                  so a brief that reached the database any other way can't run script. */}
              <div className="mt-brief" dangerouslySetInnerHTML={{ __html: sanitizeBrief(task.description) }} />
            </div>
            {canSubmit && contribution && latestFeedback && (
              <div className="mt-feedback-banner" role="region" aria-label="Latest team feedback">
                <div className="mt-panel-title" style={{ borderBottomColor: 'color-mix(in srgb, var(--orange) 25%, transparent)', color: 'var(--orange)' }}>
                  Latest team feedback · Address before resubmitting
                </div>
                <div className="mt-feedback-body">{latestFeedback}</div>
              </div>
            )}
            {canSubmit && (
              <SubmissionForm
                taskId={task.id}
                taskTitle={task.title}
                isResubmission={!!contribution}
                attemptNumber={contribution ? contribution.submission_count + 1 : 1}
                initial={contribution ? { title: contribution.title, description: contribution.description, evidenceUrl: contribution.evidence_url ?? '' } : null}
              />
            )}
            {contribution?.status === 'pending_review' && <ReviewPoller />}
            {contribution && !canSubmit && (
              <div className="mt-panel">
                <div className="mt-panel-title">Your submission</div>
                <div className="mt-kv"><span>Status</span><span>{CONTRIBUTION_STATUS_MEMBER_LABELS[contribution.status]}</span></div>
                <div className="mt-kv"><span>Submission</span><span>#{submissionNo ?? '—'}</span></div>
                <div className="mt-kv"><span>Attempt</span><span>{contribution.submission_count} of {MAX_ATTEMPTS}</span></div>
                {contribution.final_points !== null && <div className="mt-kv"><span>Points awarded</span><span>{contribution.final_points}</span></div>}
                {contribution.status === 'changes_requested' && contribution.submission_count >= MAX_ATTEMPTS && (
                  <span className="mt-hint">You have used all {MAX_ATTEMPTS} submission attempts for this task. Reply in the thread below if you need to follow up with the team.</span>
                )}
                {contribution.evidence_url && (safeEvidence
                  ? <a className="mt-link" href={safeEvidence} target="_blank" rel="noopener noreferrer">{contribution.evidence_url}</a>
                  : <span className="mt-hint">{contribution.evidence_url}</span>)}
              </div>
            )}
            {contribution && (
              <SubmissionTimeline
                contributionId={contribution.id}
                attempts={attempts}
                reviews={reviews as unknown as TimelineReview[]}
                messages={messages}
                submissionCount={contribution.submission_count}
                legacyStaffNote={{ body: contribution.staff_notes, status: contribution.status, submissionNumber: contribution.submission_count, timestamp: contribution.verified_at ?? contribution.updated_at ?? contribution.submitted_at }}
                threadClosed={!!contribution.thread_closed_at}
                viewerRole="contributor"
                showSecurity={false}
                postAction={postContributorReply}
              />
            )}
            {task.links.length > 0 && (
              <div className="mt-panel mt-links">
                <div className="mt-panel-title">Links</div>
                {task.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>)}
              </div>
            )}
          </div>

          <div className="mt-side">
            <div className="mt-panel">
              <div className="mt-panel-title">Details</div>
              <div className="mt-kv"><span>Points</span><span>{task.point_range_min}–{task.point_range_max}</span></div>
              {(sharedWith ?? 0) > 1 && (
                <span className="mt-hint">You&apos;re one of {sharedWith} people working on this task. Each person submits their own work and earns their own points.</span>
              )}
              <div className="mt-kv"><span>Deadline</span><span>{deadline ? deadline.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span></div>
              {open && <div className="mt-kv"><span>Time left</span><span className={isOverdue(task, now) ? 'bad' : ''}>{deadlineLabel(task, now)}</span></div>}            </div>

            {open && (
              <div className="mt-panel">
                <div className="mt-panel-title">Extension</div>
                {task.extension_status === 'none' && canRequestExtension && (
                  <ExtensionRequest taskId={task.id} days={EXTENSION_DAYS[task.complexity]} />
                )}
                {task.extension_status === 'none' && !canRequestExtension && <span className="mt-hint">The deadline has passed, so an extension can no longer be requested.</span>}
                {task.extension_status === 'requested' && <span className="mt-hint">Extension requested. The team will decide soon.</span>}
                {task.extension_status === 'granted' && <span className="mt-hint">Extension granted. Your deadline above includes it.</span>}
                {task.extension_status === 'denied' && <span className="mt-hint">Your extension request was declined.</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
