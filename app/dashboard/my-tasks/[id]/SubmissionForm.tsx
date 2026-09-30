'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitContribution } from '../actions'
import { SUBMISSION_MIN_WORDS, wordCount } from '@/lib/contributions/submission'

interface Props {
  taskId: string
  initial: { title: string; description: string; evidenceUrl: string } | null
  isResubmission: boolean
}

export default function SubmissionForm({ taskId, initial, isResubmission }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [evidenceUrl, setEvidenceUrl] = useState(initial?.evidenceUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = wordCount(description)

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
      <div className="mt-panel-title">{isResubmission ? 'Resubmit your work' : 'Submit your work'}</div>
      {error && <div className="mt-alert error">{error}</div>}
      <label className="mt-hint" htmlFor="sub-title">Title</label>
      <input id="sub-title" className="mt-input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="What you delivered, specifically" />
      <label className="mt-hint" htmlFor="sub-description">What you did</label>
      <textarea id="sub-description" className="mt-input mt-textarea" style={{ minHeight: 180 }} maxLength={10000}
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="What you built or produced, how you did it, and how it meets the brief." />
      <span className="mt-hint">{words} word{words === 1 ? '' : 's'}{words < SUBMISSION_MIN_WORDS ? ` · at least ${SUBMISSION_MIN_WORDS} needed` : ''}</span>
      <label className="mt-hint" htmlFor="sub-evidence">Link to your work</label>
      <input id="sub-evidence" className="mt-input" type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)}
        placeholder="https://github.com/… or a document / design link" />
      <span className="mt-hint">Make sure the link is public, so the review can open it.</span>
      <button type="submit" className="mt-btn" disabled={busy}>{busy ? 'Submitting…' : isResubmission ? 'Resubmit' : 'Submit'}</button>
    </form>
  )
}
