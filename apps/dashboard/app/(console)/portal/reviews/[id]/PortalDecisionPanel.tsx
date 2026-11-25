'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_ATTEMPTS, NOTE_MAX } from '@/lib/portal/reviewRules'
import { canRequestMoreChanges } from '@nextrium/contributions-core/thread'
import { rejectPortalSubmission, requestPortalChanges, verifyPortalSubmission } from '../actions'

export default function PortalDecisionPanel({ contributionId, min, max, submissionCount }: { contributionId: string; min: number; max: number; submissionCount: number }) {
  const router = useRouter()
  const [points, setPoints] = useState(Math.round((min + max) / 2))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'verify' | 'changes' | 'reject' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const changesAllowed = canRequestMoreChanges(submissionCount)

  async function run(kind: 'verify' | 'changes' | 'reject') {
    setBusy(kind)
    setResult(null)
    const res =
      kind === 'verify' ? await verifyPortalSubmission(contributionId, points, note)
      : kind === 'changes' ? await requestPortalChanges(contributionId, note)
      : await rejectPortalSubmission(contributionId, note)
    setBusy(null)
    setConfirmReject(false)
    setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error })
    if (res.ok) {
      setNote('')
      router.refresh()
    }
  }

  return (
    <div className="pt-panel">
      <div className="pt-panel-title">Decision</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}

      <label className="pt-hint" htmlFor="pd-points">Points to award: <strong style={{ color: 'var(--white)' }}>{points}</strong> ({min}–{max})</label>
      <input id="pd-points" type="range" min={min} max={max} step={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />

      <label className="pt-hint" htmlFor="pd-note">Feedback for the contributor (shown in the thread and emailed; required for changes or rejection)</label>
      <textarea
        id="pd-note"
        className="pt-input pt-textarea"
        maxLength={NOTE_MAX}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Share what stood out, what you are adopting, why this score was awarded, or what needs changing…"
      />

      <button type="button" className="pt-btn" disabled={!!busy} onClick={() => run('verify')}>{busy === 'verify' ? 'Verifying…' : 'Verify & award points'}</button>
      <button type="button" className="pt-btn ghost" disabled={!!busy || !changesAllowed || !note.trim()} onClick={() => run('changes')}>
        {busy === 'changes' ? 'Sending…' : 'Request changes'}
      </button>
      {!changesAllowed && (
        <span className="pt-hint">All {MAX_ATTEMPTS} submission attempts have been used. Verify or do not accept this submission instead.</span>
      )}
      {!confirmReject ? (
        <button type="button" className="pt-btn danger" disabled={!!busy || !note.trim()} onClick={() => setConfirmReject(true)}>Do not accept</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="pt-hint">Reject for good? No points are awarded, the contributor cannot resubmit, and the task returns to the open board.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => run('reject')}>{busy === 'reject' ? 'Saving…' : 'Yes, do not accept'}</button>
            <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirmReject(false)}>Keep</button>
          </div>
        </div>
      )}
    </div>
  )
}
