'use client'

import { useEffect, useRef, useState } from 'react'
import Badge from '@/components/dashboard/Badge'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import {
  getRebuttalDetail,
  triggerRebuttalRescreen,
  resolveRebuttalAction,
  markApplicationReviewed,
  type RebuttalDetail,
  type ReviewedInfo,
} from './actions'

/**
 * Self-contained rebuttal dispute card, isolated from ApplicationsClient.tsx
 * on purpose — that file is already large, and this keeps the new rebuttal
 * resolution feature (fetch, poll, resolve) from adding to that surface.
 * Rendered only when a candidate has an actual rebuttal on file.
 */
export default function RebuttalPanel({
  reportId,
  applicationId,
  candidateName,
  onResolved,
  onReviewed,
}: {
  reportId: string
  applicationId: string
  candidateName: string
  onResolved?: () => void
  onReviewed?: (reviewed: ReviewedInfo) => void
}) {
  const { openCopilot } = useDashboard()
  const [rebuttal, setRebuttal] = useState<RebuttalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [declineNotes, setDeclineNotes] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const [showAcceptForm, setShowAcceptForm] = useState(false)
  const [acceptScore, setAcceptScore] = useState('')
  const [acceptRecommendation, setAcceptRecommendation] = useState('')
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  async function load() {
    const { rebuttal: data, error: err } = await getRebuttalDetail(reportId)
    if (!mounted.current) return
    if (err) setError(err)
    setRebuttal(data ?? null)
    setLoading(false)

    if (data?.status === 'rescreening') {
      pollTimer.current = setTimeout(load, 3000)
    } else if (data?.status === 'in_review') {
      // Waiting on evidence fed through the Co-Pilot chat drawer, which is
      // a separate component with no direct link to this one — the only
      // way this panel finds out a chat reply produced a new delta (moving
      // status to 'rescreened' server-side) is by checking back itself.
      // Slower than the rescreening poll since this can sit here for
      // minutes while a recruiter is actively chatting, not a few seconds
      // of automated work.
      pollTimer.current = setTimeout(load, 12000)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  async function handleRescreen() {
    if (!rebuttal) return
    setError(null)
    setActionPending('rescreen')
    const res = await triggerRebuttalRescreen(rebuttal.id)
    setActionPending(null)

    if (res.error && res.httpStatus !== 409) {
      setError(res.error)
      return
    }
    // Either it started, or it's already running (409) — either way, poll.
    setRebuttal((prev) => (prev ? { ...prev, status: 'rescreening' } : prev))
    pollTimer.current = setTimeout(load, 3000)
  }

  async function handleResolve(action: 'accept' | 'refine' | 'decline') {
    if (!rebuttal) return

    if (action === 'refine') {
      openCopilot({
        domainType: 'hr_screening',
        resourceId: applicationId,
        reportId,
        candidateName,
        initialPrompt: `Continuing the evidence review for ${candidateName}'s rebuttal — additional context:`,
        onDelta: onResolved,
      })
    }

    const manualOverrides = action === 'accept' && (acceptScore.trim() || acceptRecommendation)
      ? {
          compositeScore: acceptScore.trim() ? Number(acceptScore) : undefined,
          recommendation: acceptRecommendation || undefined,
        }
      : undefined

    setError(null)
    setActionPending(action)
    const res = await resolveRebuttalAction(
      rebuttal.id,
      action,
      action === 'decline' ? declineNotes : undefined,
      manualOverrides
    )
    setActionPending(null)

    if (res.error) {
      setError(res.error)
      return
    }

    setShowDeclineForm(false)
    setShowAcceptForm(false)
    setAcceptScore('')
    setAcceptRecommendation('')
    await load()
    onResolved?.()

    // Accepting, refining, or declining a rebuttal is a human recruiter
    // actively deciding this application's outcome - exactly the kind of
    // secondary look the reviewed marker exists to record.
    markApplicationReviewed(applicationId).then(({ reviewed }) => {
      if (reviewed) onReviewed?.(reviewed)
    })
  }

  if (loading) {
    return <div style={{ fontSize: '11px', color: 'var(--grey-mid)' }}>Loading rebuttal…</div>
  }
  // A fetch error used to be silently discarded here — the panel just
  // vanished with no indication anything went wrong, which is exactly why
  // a candidate correctly flagged as having a submitted rebuttal appeared
  // to have no rebuttal content at all whenever the underlying query
  // failed (as it always did — see getRebuttalDetail's submitted_at fix).
  if (!rebuttal) {
    if (error) {
      return (
        <div className="rebuttal-panel">
          <style>{`.rebuttal-error { color: var(--error); font-size: 11.5px; }`}</style>
          <div className="rebuttal-error">Could not load this rebuttal: {error}</div>
        </div>
      )
    }
    return null
  }

  const isRescreening = rebuttal.status === 'rescreening'
  const isFinal = rebuttal.status === 'resolved' || rebuttal.status === 'dismissed'
  const hasDelta = rebuttal.status === 'rescreened' && rebuttal.newScore != null

  return (
    <div className="rebuttal-panel">
      <style>{`
        .rebuttal-panel { background: rgba(219,103,39,0.04); border: 1px solid rgba(219,103,39,0.2); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
        .rebuttal-panel-title { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); }
        .rebuttal-dim-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .rebuttal-dim { font-size: 10.5px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 3px 8px; color: var(--grey-light); }
        .rebuttal-evidence { font-size: 12px; color: var(--grey-light); line-height: 1.5; white-space: pre-wrap; }
        .rebuttal-url { font-size: 11px; color: var(--slate-l); word-break: break-all; display: block; }
        .rebuttal-delta-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .rebuttal-btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .rebuttal-btn { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; padding: 8px 14px; border: none; cursor: pointer; transition: opacity 0.15s ease; }
        .rebuttal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rebuttal-btn.accept { background: var(--success); color: var(--black); }
        .rebuttal-btn.refine { background: var(--gold); color: var(--black); }
        .rebuttal-btn.decline { background: transparent; color: var(--error); border: 1px solid rgba(232,69,69,0.4); }
        .rebuttal-btn.rescreen { background: var(--slate); color: var(--white); }
        .rebuttal-textarea { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: var(--white); padding: 8px 10px; font-size: 12px; min-height: 50px; }
        .rebuttal-error { color: var(--error); font-size: 11.5px; }
      `}</style>

      <div className="rebuttal-panel-title">Rebuttal dispute</div>

      <div className="rebuttal-dim-list">
        {rebuttal.disputedDimensions.map((dim) => (
          <span key={dim} className="rebuttal-dim">{dim}</span>
        ))}
      </div>

      <div className="rebuttal-evidence">{rebuttal.evidenceStatement}</div>

      {rebuttal.evidenceUrls.length > 0 && (
        <div>
          {rebuttal.evidenceUrls.map((url) => (
            <a key={url} className="rebuttal-url" href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          ))}
        </div>
      )}

      {isFinal && (
        <Badge variant={rebuttal.status === 'resolved' ? 'success' : 'neutral'}>
          {rebuttal.status === 'resolved' ? 'Accepted — report updated' : 'Declined — findings upheld'}
        </Badge>
      )}

      {rebuttal.status === 'in_review' && (
        <Badge variant="warning">Awaiting further evidence via Co-Pilot</Badge>
      )}

      {isRescreening && (
        <div style={{ fontSize: '11.5px', color: 'var(--grey-mid)' }}>
          Running forensic AI audit — checking submitted evidence links and re-evaluating disputed dimensions…
        </div>
      )}

      {rebuttal.rescreenError && rebuttal.status === 'pending' && (
        <div className="rebuttal-error">Last rescreen attempt failed: {rebuttal.rescreenError}</div>
      )}

      {hasDelta && (
        <>
          <div className="rebuttal-delta-row">
            <span style={{ color: 'var(--grey-mid)' }}>{rebuttal.previousScore}%</span>
            <span style={{ color: 'var(--grey-mid)' }}>→</span>
            <span style={{ color: 'var(--white)', fontWeight: 700 }}>{rebuttal.newScore}%</span>
            <Badge variant={(rebuttal.newScore! - (rebuttal.previousScore ?? 0)) >= 0 ? 'success' : 'error'}>
              {(rebuttal.newScore! - (rebuttal.previousScore ?? 0)) >= 0 ? '+' : ''}
              {rebuttal.newScore! - (rebuttal.previousScore ?? 0)} pts
            </Badge>
          </div>
          {rebuttal.deltaSummary && (
            <div style={{ fontSize: '12px', color: 'var(--grey-light)' }}>{rebuttal.deltaSummary}</div>
          )}
        </>
      )}

      {error && <div className="rebuttal-error">{error}</div>}

      {!isFinal && (
        <div className="rebuttal-btn-row">
          {(rebuttal.status === 'pending' || rebuttal.rescreenError) && !isRescreening && (
            <button className="rebuttal-btn rescreen" disabled={actionPending === 'rescreen'} onClick={handleRescreen}>
              {actionPending === 'rescreen' ? 'Starting…' : 'Run forensic rescreen'}
            </button>
          )}
          {hasDelta && (
            <>
              <button
                className="rebuttal-btn accept"
                disabled={!!actionPending}
                onClick={() => setShowAcceptForm((v) => !v)}
              >
                {actionPending === 'accept' ? 'Applying…' : 'Accept'}
              </button>
              <button className="rebuttal-btn refine" disabled={!!actionPending} onClick={() => handleResolve('refine')}>
                Refine
              </button>
              <button
                className="rebuttal-btn decline"
                disabled={!!actionPending}
                onClick={() => setShowDeclineForm((v) => !v)}
              >
                Decline
              </button>
            </>
          )}
        </div>
      )}

      {showAcceptForm && (
        <div>
          <div style={{ fontSize: '10.5px', color: 'var(--grey-mid)', marginBottom: '6px' }}>
            Human recruiter manual adjustment (optional) — leave blank to accept the AI-computed score above as-is.
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '9px', color: 'var(--grey-mid)', display: 'block', marginBottom: '4px' }}>Override score</label>
              <input
                className="rebuttal-textarea"
                style={{ minHeight: 'auto' }}
                type="number"
                min={0}
                max={100}
                value={acceptScore}
                onChange={(e) => setAcceptScore(e.target.value)}
                placeholder={rebuttal.newScore != null ? String(rebuttal.newScore) : 'e.g. 78'}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '9px', color: 'var(--grey-mid)', display: 'block', marginBottom: '4px' }}>Override recommendation</label>
              <select
                className="rebuttal-textarea"
                style={{ minHeight: 'auto' }}
                value={acceptRecommendation}
                onChange={(e) => setAcceptRecommendation(e.target.value)}
              >
                <option value="">— No change —</option>
                <option value="Strong Hire">Strong Hire</option>
                <option value="Proceed to Recruiter Screen">Proceed to Recruiter Screen</option>
                <option value="Hold">Hold</option>
                <option value="Reject">Reject</option>
              </select>
            </div>
          </div>
          <div className="rebuttal-btn-row">
            <button className="rebuttal-btn accept" disabled={actionPending === 'accept'} onClick={() => handleResolve('accept')}>
              {actionPending === 'accept' ? 'Applying…' : 'Confirm accept'}
            </button>
          </div>
        </div>
      )}

      {showDeclineForm && (
        <div>
          <textarea
            className="rebuttal-textarea"
            placeholder="Optional note to include in the dismissal email…"
            value={declineNotes}
            onChange={(e) => setDeclineNotes(e.target.value)}
          />
          <div className="rebuttal-btn-row" style={{ marginTop: '8px' }}>
            <button className="rebuttal-btn decline" disabled={actionPending === 'decline'} onClick={() => handleResolve('decline')}>
              {actionPending === 'decline' ? 'Sending…' : 'Confirm decline'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
