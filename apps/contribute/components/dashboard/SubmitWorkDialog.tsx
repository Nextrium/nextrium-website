'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { SUBMISSION_DESCRIPTION_MAX, SUBMISSION_MIN_WORDS, SUBMISSION_TITLE_MAX, wordCount } from '@nextrium/contributions-core/submission'
import { submitWork, type WorkState } from '@/app/actions/work'
import { C, F, tint } from '@/lib/theme'
import Dialog from './Dialog'

export interface SubmitTarget {
  taskId: string
  taskTitle: string
  /** Prefill on a resubmission. */
  title?: string
  description?: string
  evidenceUrl?: string
}

const IDLE: WorkState = { status: 'idle' }

const input: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: C.void, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.light, fontFamily: F.body, fontSize: 13,
}

const OUTCOME_TOKEN = { ai_approved: '--teal-l', rejected: '--orange-w', under_review: '--gold-l', pending: '--gold-l' } as const
const OUTCOME_TITLE = { ai_approved: 'Passed automated review', rejected: 'Changes requested', under_review: 'Submitted for review', pending: 'Submitted' } as const

/** Submit or resubmit work for one of the contributor's tasks. The review runs on the server and can take up to a minute. */
export default function SubmitWorkDialog({ targets, initial, runningCount = 0, onClose }: { targets: SubmitTarget[]; initial: SubmitTarget | null; runningCount?: number; onClose: () => void }) {
  const [state, action, pending] = useActionState(submitWork, IDLE)
  const first = initial ?? targets[0] ?? null
  const [taskId, setTaskId] = useState(first?.taskId ?? '')
  const current = targets.find((t) => t.taskId === taskId) ?? initial
  const [title, setTitle] = useState(initial?.title ?? first?.taskTitle ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [evidenceUrl, setEvidenceUrl] = useState(initial?.evidenceUrl ?? '')
  const words = wordCount(description)

  if (state.status === 'done' && state.outcome) {
    const token = OUTCOME_TOKEN[state.outcome]
    return (
      <Dialog title={OUTCOME_TITLE[state.outcome]} subtitle={current?.taskTitle} onClose={onClose}>
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: tint(token, 8), border: `1px solid ${tint(token, 25)}` }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${token})`, marginTop: 6, flexShrink: 0 }} />
            <p role="status" style={{ fontFamily: F.body, fontSize: 13, color: C.mist, lineHeight: 1.65 }}>{state.message}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/dashboard?tab=submissions" onClick={onClose} className="btn-primary" style={{ fontSize: 13 }}>View submissions</Link>
            <button type="button" onClick={onClose} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      </Dialog>
    )
  }

  if (!current) {
    return (
      <Dialog title="Submit work" onClose={onClose}>
        <div className="p-6 flex flex-col gap-4">
          <p style={{ fontFamily: F.body, fontSize: 14, color: C.mute, lineHeight: 1.7 }}>
            {runningCount > 0
              ? 'Your running tasks already have a submission. If one needs changes, resubmit it from My tasks.'
              : 'Work is submitted against a task you have claimed. Claim a task from the board first.'}
          </p>
          <div>
            {runningCount > 0
              ? <Link href="/dashboard?tab=tasks" onClick={onClose} className="btn-primary" style={{ fontSize: 13 }}>Go to my tasks</Link>
              : <Link href="/dashboard/tasks" onClick={onClose} className="btn-primary" style={{ fontSize: 13 }}>Browse open tasks</Link>}
          </div>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title={initial?.description ? 'Resubmit your work' : 'Submit your work'} subtitle={current.taskTitle} onClose={() => { if (!pending) onClose() }}>
      <form action={action} className="p-6 flex flex-col gap-4">
        {targets.length > 1 && !initial && (
          <div>
            <label className="field-label" htmlFor="sub-task">Task</label>
            <select id="sub-task" name="taskId" value={taskId} onChange={(e) => {
              setTaskId(e.target.value)
              const t = targets.find((x) => x.taskId === e.target.value)
              if (t) setTitle(t.taskTitle)
            }} className="portal-input" style={input}>
              {targets.map((t) => <option key={t.taskId} value={t.taskId}>{t.taskTitle}</option>)}
            </select>
          </div>
        )}
        {(targets.length <= 1 || initial) && <input type="hidden" name="taskId" value={current.taskId} />}

        <div>
          <label className="field-label" htmlFor="sub-title">Title</label>
          <input id="sub-title" name="title" type="text" required maxLength={SUBMISSION_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} className="portal-input" style={input} placeholder="What did you build or complete?" />
        </div>

        <div>
          <label className="field-label" htmlFor="sub-description">What you did</label>
          <textarea
            id="sub-description"
            name="description"
            required
            rows={7}
            maxLength={SUBMISSION_DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="portal-input"
            style={{ ...input, resize: 'vertical' }}
            placeholder="Describe what you built or produced, how you did it, and how it meets the brief."
            aria-describedby="sub-words"
          />
          <p id="sub-words" style={{ fontFamily: F.body, fontSize: 11, marginTop: 5, color: words >= SUBMISSION_MIN_WORDS ? C.teal : C.dim }}>
            {words} / {SUBMISSION_MIN_WORDS} words minimum
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="sub-evidence">Link to your work</label>
          <input id="sub-evidence" name="evidenceUrl" type="url" required value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} className="portal-input" style={input} placeholder="https://github.com/... (pull request, repository, document or design file)" />
          <p style={{ fontFamily: F.body, fontSize: 11, marginTop: 5, color: C.dim }}>Must start with https://. The automated review opens this link.</p>
        </div>

        {state.status === 'error' && <p role="alert" style={{ fontFamily: F.body, fontSize: 13, color: C.danger, lineHeight: 1.6 }}>{state.message}</p>}

        <div className="flex gap-3 mt-2">
          <button type="submit" disabled={pending} className="btn-primary flex-1 justify-center" style={{ opacity: pending ? 0.7 : 1, cursor: pending ? 'progress' : 'pointer' }}>
            {pending ? 'Reviewing your work…' : 'Submit for review'}
          </button>
          <button type="button" onClick={onClose} disabled={pending} className="btn-outline" style={{ fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
        {pending && <p role="status" style={{ fontFamily: F.body, fontSize: 12, color: C.dim, lineHeight: 1.6 }}>The automated review can take up to a minute. Keep this window open.</p>}
      </form>
    </Dialog>
  )
}
