'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rejectContribution, requestChanges, verifyContribution } from '../actions'

interface Props {
  contributionId: string
  min: number
  max: number
}

export default function DecisionPanel({ contributionId, min, max }: Props) {
  const router = useRouter()
  const [points, setPoints] = useState(Math.round((min + max) / 2))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(label); setError(null)
    const res = await fn()
    setBusy(null); setConfirmReject(false)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    router.refresh()
  }

  return (
    <div className="mt-panel">
      <div className="mt-panel-title">Decision</div>
      {error && <div className="mt-alert error">{error}</div>}

      <label className="mt-hint" htmlFor="dec-points">Points to award: <strong style={{ color: 'var(--white)' }}>{points}</strong> ({min}–{max})</label>
      <input id="dec-points" type="range" min={min} max={max} step={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />

      <label className="mt-hint" htmlFor="dec-notes">Note for the member (required to request changes or reject)</label>
      <textarea id="dec-notes" className="mt-input mt-textarea" maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <button type="button" className="mt-btn" disabled={!!busy} onClick={() => run('verify', () => verifyContribution(contributionId, points, notes))}>
        {busy === 'verify' ? 'Verifying…' : 'Verify & award points'}
      </button>
      <button type="button" className="mt-btn ghost" disabled={!!busy} onClick={() => run('changes', () => requestChanges(contributionId, notes))}>
        {busy === 'changes' ? 'Sending…' : 'Request changes'}
      </button>
      {!confirmReject ? (
        <button type="button" className="mt-btn danger" disabled={!!busy} onClick={() => setConfirmReject(true)}>Reject</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="mt-hint">Reject for good? The task is cancelled and no points are awarded.</span>
          <button type="button" className="mt-btn danger" disabled={!!busy} onClick={() => run('reject', () => rejectContribution(contributionId, notes))}>
            {busy === 'reject' ? 'Rejecting…' : 'Yes, reject'}
          </button>
          <button type="button" className="mt-btn ghost" disabled={!!busy} onClick={() => setConfirmReject(false)}>Keep</button>
        </div>
      )}
    </div>
  )
}
