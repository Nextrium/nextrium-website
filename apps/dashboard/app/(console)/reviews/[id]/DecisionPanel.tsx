'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rejectContribution, requestChanges, verifyContribution } from '../actions'
import { MAX_ATTEMPTS, canRequestMoreChanges } from '@nextrium/contributions-core/thread'

interface Props {
  contributionId: string
  min: number
  max: number
  submissionCount: number
}

export default function DecisionPanel({ contributionId, min, max, submissionCount }: Props) {
  const router = useRouter()
  const [points, setPoints] = useState(Math.round((min + max) / 2))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const changesAllowed = canRequestMoreChanges(submissionCount)

  // Every click ends in a message: the result, the server's reason, or a connection failure.
  async function run(label: string, success: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(label); setError(null); setDone(null)
    try {
      const res = await fn()
      if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
      setNotes('')
      setDone(success)
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(null); setConfirmReject(false)
    }
  }

  const needsNote = (fn: () => void) => () => {
    if (!notes.trim()) { setDone(null); setError('Write a note for the member first.'); return }
    fn()
  }

  return (
    <div className="mt-panel">
      <div className="mt-panel-title">Decision</div>
      {error && <div className="mt-alert error" role="alert">{error}</div>}
      {done && <div className="mt-alert success" role="status">{done}</div>}

      <label className="mt-hint" htmlFor="dec-points">Points to award: <strong style={{ color: 'var(--white)' }}>{points}</strong> ({min}–{max})</label>
      <input id="dec-points" type="range" min={min} max={max} step={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />

      <label className="mt-hint" htmlFor="dec-notes">Feedback for the member (shown in the thread and emailed; required for changes or rejection)</label>
      <textarea
        id="dec-notes"
        className="mt-input mt-textarea"
        maxLength={4000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Share what stood out, what you are adopting, why this score was awarded, or what needs changing…"
      />

      <button type="button" className="mt-btn" disabled={!!busy} onClick={() => run('verify', 'Verified. Points awarded and the member has been emailed.', () => verifyContribution(contributionId, points, notes))}>
        {busy === 'verify' ? 'Verifying…' : 'Verify & award points'}
      </button>
      <button
        type="button"
        className="mt-btn ghost"
        disabled={!!busy || !changesAllowed}
        onClick={needsNote(() => run('changes', 'Changes requested. The member has been emailed your note.', () => requestChanges(contributionId, notes)))}
      >
        {busy === 'changes' ? 'Sending…' : 'Request changes'}
      </button>
      {!changesAllowed && (
        <span className="mt-hint">
          All {MAX_ATTEMPTS} submission attempts have been used. Verify or reject this submission instead.
        </span>
      )}
      {!confirmReject ? (
        <button type="button" className="mt-btn danger" disabled={!!busy} onClick={needsNote(() => { setError(null); setConfirmReject(true) })}>Reject</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="mt-hint">Reject for good? The task is cancelled and no points are awarded.</span>
          <button type="button" className="mt-btn danger" disabled={!!busy} onClick={() => run('reject', 'Rejected. The task was cancelled and the member has been emailed.', () => rejectContribution(contributionId, notes))}>
            {busy === 'reject' ? 'Rejecting…' : 'Yes, reject'}
          </button>
          <button type="button" className="mt-btn ghost" disabled={!!busy} onClick={() => setConfirmReject(false)}>Keep</button>
        </div>
      )}
    </div>
  )
}
