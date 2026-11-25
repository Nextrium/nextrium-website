'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitContribution } from '../actions'
import { DIRECT_SUBMISSION_MIN_WORDS, SUBMISSION_MIN_WORDS, initialSubmissionTitle, wordCount } from '@nextrium/contributions-core/submission'
import { MAX_ATTEMPTS } from '@nextrium/contributions-core/thread'

interface Props {
  taskId: string
  taskTitle: string
  initial: { title: string; description: string; evidenceUrl: string } | null
  isResubmission: boolean
  attemptNumber?: number
  directReview?: boolean
}

export default function SubmissionForm({ taskId, taskTitle, initial, isResubmission, attemptNumber = 1, directReview = false }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(() => initialSubmissionTitle(taskTitle, initial?.title))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [evidenceUrl, setEvidenceUrl] = useState(initial?.evidenceUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = wordCount(description)
  const minWords = directReview ? DIRECT_SUBMISSION_MIN_WORDS : SUBMISSION_MIN_WORDS

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await submitContribution(taskId, { title, description, evidenceUrl })
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  return (
    <form className="mt-panel" onSubmit={submit}>
      <div className="mt-panel-title">
        {isResubmission ? `Resubmit your work · Attempt ${attemptNumber} of ${MAX_ATTEMPTS}` : `Submit your work · Attempt 1 of ${MAX_ATTEMPTS}`}
      </div>
      {directReview && (
        <span className="mt-hint" style={{ color: 'var(--off-white)' }}>
          Direct team review — this goes straight to the team without an automated AI check. A short summary (at least {minWords} words) is enough, and adding a link is optional.
        </span>
      )}
      {error && <div className="mt-alert error">{error}</div>}
      <label className="mt-hint" htmlFor="sub-title">Title</label>
      <input id="sub-title" className="mt-input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder={directReview ? 'e.g. Weekly sync confirmation & notes' : 'What you delivered, specifically'} />
      <label className="mt-hint" htmlFor="sub-description">{directReview ? 'Summary / confirmation' : 'What you did'}</label>
      <textarea id="sub-description" className="mt-input mt-textarea" style={{ minHeight: directReview ? 130 : 180 }} maxLength={10000}
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder={
          directReview
            ? 'Confirm attendance, summarize what you coordinated or completed this cycle, and note any key outcomes.'
            : 'What you built or produced, how you did it, and how it meets the brief.'
        } />
      <span className="mt-hint">{words} word{words === 1 ? '' : 's'}{words < minWords ? ` · at least ${minWords} needed` : ''}</span>
      <label className="mt-hint" htmlFor="sub-evidence">{directReview ? 'Link to supporting notes or work (optional)' : 'Link to your work'}</label>
      <input id="sub-evidence" className="mt-input" type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)}
        placeholder={directReview ? 'Optional: https://… (meeting notes, doc, or thread)' : 'https://github.com/… or a document / design link'} />
      {!directReview && <span className="mt-hint">Make sure the link is public, so the review can open it.</span>}
      <button type="submit" className="mt-btn" disabled={busy}>{busy ? 'Submitting…' : isResubmission ? 'Resubmit' : 'Submit'}</button>
    </form>
  )
}
