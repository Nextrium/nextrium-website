'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NOTE_MAX, TRANSITIONS, type ApplicantAction } from '@/lib/portal/applicantRules'
import { decideApplicant } from '../actions'

const LABELS: Record<ApplicantAction, { button: string; busy: string; confirm?: string }> = {
  approve: { button: 'Approve', busy: 'Approving…' },
  request_revision: { button: 'Request changes', busy: 'Sending…' },
  reject: { button: 'Do not approve', busy: 'Saving…', confirm: 'Decline this application? The applicant is emailed and cannot claim tasks.' },
  deactivate: { button: 'Deactivate account', busy: 'Deactivating…', confirm: 'Deactivate this contributor? They lose access to the dashboard and drop off the leaderboard.' },
  reactivate: { button: 'Reactivate account', busy: 'Reactivating…' },
}

export default function ApplicantDecision({ contributorId, actions }: { contributorId: string; actions: ApplicantAction[] }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<ApplicantAction | null>(null)
  const [confirming, setConfirming] = useState<ApplicantAction | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  if (actions.length === 0) return null
  const wantsNote = actions.some((a) => TRANSITIONS[a].note !== 'none')

  async function run(action: ApplicantAction) {
    setBusy(action)
    setResult(null)
    const res = await decideApplicant(contributorId, action, note)
    setBusy(null)
    setConfirming(null)
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

      {wantsNote && (
        <>
          <label className="pt-hint" htmlFor="ap-note">Note to the applicant (required to request changes; optional when declining)</label>
          <textarea id="ap-note" className="pt-input pt-textarea" maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </>
      )}

      {actions.map((a) => {
        const l = LABELS[a]
        const danger = a === 'reject' || a === 'deactivate'
        if (confirming === a) {
          return (
            <div key={a} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="pt-hint">{l.confirm}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="pt-btn danger" disabled={!!busy} onClick={() => run(a)}>{busy === a ? l.busy : `Yes, ${l.button.toLowerCase()}`}</button>
                <button type="button" className="pt-btn ghost" disabled={!!busy} onClick={() => setConfirming(null)}>Keep</button>
              </div>
            </div>
          )
        }
        return (
          <button
            key={a}
            type="button"
            className={`pt-btn${danger ? ' danger' : a === 'request_revision' ? ' ghost' : ''}`}
            disabled={!!busy || (a === 'request_revision' && !note.trim())}
            onClick={() => (l.confirm ? setConfirming(a) : run(a))}
          >
            {busy === a ? l.busy : l.button}
          </button>
        )
      })}
    </div>
  )
}
