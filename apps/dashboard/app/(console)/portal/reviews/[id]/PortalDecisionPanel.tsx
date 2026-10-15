'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NOTE_MAX } from '@/lib/portal/reviewRules'
import { rejectPortalSubmission, verifyPortalSubmission } from '../actions'

export default function PortalDecisionPanel({ contributionId, min, max }: { contributionId: string; min: number; max: number }) {
  const router = useRouter()
  const [points, setPoints] = useState(Math.round((min + max) / 2))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'verify' | 'reject' | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function run(kind: 'verify' | 'reject') {
    setBusy(kind)
    setResult(null)
    const res = kind === 'verify' ? await verifyPortalSubmission(contributionId, points, note) : await rejectPortalSubmission(contributionId, note)
    setBusy(null)
    setConfirmReject(false)
    setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error })
    if (res.ok) router.refresh()
  }

  return (
    <div className="pt-panel">
      <div className="pt-panel-title">Decision</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}

      <label className="pt-hint" htmlFor="pd-points">Points to award: <strong style={{ color: 'var(--white)' }}>{points}</strong> ({min}–{max})</label>
      <input id="pd-points" type="range" min={min} max={max} step={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />

      <label className="pt-hint" htmlFor="pd-note">Note for the contributor (optional to verify, required to reject)</label>
      <textarea id="pd-note" className="pt-input pt-textarea" maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />

      <button type="button" className="pt-btn" disabled={!!busy} onClick={() => run('verify')}>{busy === 'verify' ? 'Verifying…' : 'Verify & award points'}</button>
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
