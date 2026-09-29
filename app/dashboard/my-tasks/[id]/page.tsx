import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireMember } from '@/lib/contributions/auth'
import { CATEGORY_LABELS, COMPLEXITY_LABELS, EXTENSION_DAYS } from '@/lib/contributions/constants'
import { CONTRIBUTION_STATUS_MEMBER_LABELS, TASK_STATUS_LABELS, deadlineLabel, effectiveDeadline, isOverdue } from '@/lib/contributions/taskView'
import ExtensionRequest from './ExtensionRequest'
import SubmissionForm from './SubmissionForm'
import { sanitizeBrief } from '@/lib/contributions/sanitize'
import type { Contribution, Task } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Task' }

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
  if (!task || task.status === 'draft' || task.status === 'cancelled') notFound()

  const { data: contributionRow } = await supabase.from('contributions')
    .select('*').eq('task_id', task.id).eq('contributor_id', auth.caller.userId).maybeSingle()
  const contribution: Contribution | null = contributionRow

  const now = new Date()
  const deadline = effectiveDeadline(task)
  const open = task.status === 'assigned' || task.status === 'changes_requested'
  const canRequestExtension = open && task.extension_status === 'none' && !!deadline && now < deadline
  const canSubmit = open && (!contribution || contribution.status === 'changes_requested')

  return (
    <>
      <style>{`
        .mt-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
        .mt-main { display: flex; flex-direction: column; gap: 20px; }
        .mt-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .mt-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .mt-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .mt-kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--off-white); }
        .mt-kv span:first-child { color: var(--grey-mid); }
        .mt-kv .bad { color: var(--error); }
        .mt-brief { color: var(--off-white); font-size: 14px; line-height: 1.7; }
        .mt-brief a { color: var(--orange); }
        .mt-brief img { max-width: 100%; }
        .mt-links a { display: block; color: var(--orange); font-size: 13px; margin-bottom: 6px; word-break: break-all; }
        .mt-hint { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
        .mt-input { background: var(--navy-mid, #0b1a2e); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; }
        .mt-textarea { min-height: 90px; resize: vertical; }
        .mt-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 18px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; width: fit-content; }
        .mt-btn:disabled { opacity: 0.6; cursor: default; }
        .mt-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .mt-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; }
        .mt-alert.error { background: rgba(232,69,69,0.08); border-color: rgba(232,69,69,0.3); color: var(--error); }
        .mt-alert.ok { background: rgba(34,193,122,0.08); border-color: rgba(34,193,122,0.3); color: var(--success); }
        @media (max-width: 1100px) { .mt-layout { grid-template-columns: 1fr; } .mt-side { position: static; } }
      `}</style>
      <Header title={task.title} description={`${CATEGORY_LABELS[task.category]} · ${COMPLEXITY_LABELS[task.complexity]} · ${TASK_STATUS_LABELS[task.status]}`} />
      <div className="dash-content">
        <div className="mt-layout">
          <div className="mt-main">
            <div className="mt-panel">
              <div className="mt-panel-title">Brief</div>
              {/* Sanitized again at render (server-side), not only when staff save it,
                  so a brief that reached the database any other way can't run script. */}
              <div className="mt-brief" dangerouslySetInnerHTML={{ __html: sanitizeBrief(task.description) }} />
            </div>
            {canSubmit && (
              <SubmissionForm
                taskId={task.id}
                isResubmission={!!contribution}
                initial={contribution ? { title: contribution.title, description: contribution.description, evidenceUrl: contribution.evidence_url ?? '' } : null}
              />
            )}
            {contribution && !canSubmit && (
              <div className="mt-panel">
                <div className="mt-panel-title">Your submission</div>
                <div className="mt-kv"><span>Status</span><span>{CONTRIBUTION_STATUS_MEMBER_LABELS[contribution.status]}</span></div>
                <div className="mt-kv"><span>Submission</span><span>#{contribution.submission_count}</span></div>
                {contribution.final_points !== null && <div className="mt-kv"><span>Points awarded</span><span>{contribution.final_points}</span></div>}
                {contribution.evidence_url && <a className="mt-hint" href={contribution.evidence_url} target="_blank" rel="noopener noreferrer">{contribution.evidence_url}</a>}
              </div>
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
              <div className="mt-kv"><span>Deadline</span><span>{deadline ? deadline.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span></div>
              {open && <div className="mt-kv"><span>Time left</span><span className={isOverdue(task, now) ? 'bad' : ''}>{deadlineLabel(task, now)}</span></div>}
              <span className="mt-hint">Finishing in the first half of the window earns 1.2× points; late work earns 0.8×.</span>
            </div>

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
