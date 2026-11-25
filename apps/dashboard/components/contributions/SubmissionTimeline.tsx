'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { brand } from '@nextrium/brand'
import { safeHref } from '@/lib/dashboard/safeHref'
import { hasMemberFixableFailure, isStaffOnlyIssue, memberResubmissionView } from '@nextrium/contributions-core/reviewMapping'
import {
  MAX_MESSAGES_PER_THREAD,
  MESSAGE_MAX,
  buildSubmissionTimeline,
  type AttemptSnapshot,
  type ThreadMessage,
  type TimelineReview,
} from '@nextrium/contributions-core/thread'

const CHECK_LABELS: Record<string, string> = {
  evidence_url_present: 'Evidence link provided',
  evidence_url_reachable: 'Evidence link opens',
  title_descriptive: 'Title is specific',
  description_substance: 'Description explains the work',
  description_protocol_connection: `Connects to ${brand.name}`,
  complexity_proportionate: 'Scope matches complexity',
  category_match: 'Work matches the category',
  category_specific_requirements: 'Meets category requirements',
}

const DECISION_LABELS: Record<string, string> = {
  approved: 'Passed review',
  rejected: 'Changes needed',
  human_required: 'Sent to the team',
  changes_requested: 'Changes requested by the team',
  rejected_by_staff: 'Not accepted',
  verified: 'Verified',
}

const MESSAGE_KIND_LABELS: Record<ThreadMessage['kind'], string> = {
  feedback: 'Team feedback',
  reply: 'Contributor reply',
  decision_verified: 'Approved · Team feedback',
  decision_changes: 'Changes requested',
  decision_rejected: 'Not accepted · Feedback',
}

interface SecurityIssue {
  severity?: string
  description?: string
  location?: string | null
}

interface Props {
  contributionId: string
  attempts: AttemptSnapshot[]
  reviews: TimelineReview[]
  messages: ThreadMessage[]
  threadClosed: boolean
  viewerRole: 'staff' | 'contributor'
  /** False when a staff member views their own submission and cannot moderate it. */
  canModerate?: boolean
  /** True on staff pages so scope/security review notes are visible. */
  showSecurity?: boolean
  postAction?: (contributionId: string, body: string) => Promise<{ ok: boolean; error?: string }>
  toggleClosedAction?: (contributionId: string, closed: boolean) => Promise<{ ok: boolean; error?: string }>
  heading?: string
}

function formatWhen(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return ''
  }
}

export default function SubmissionTimeline({
  contributionId,
  attempts,
  reviews,
  messages,
  threadClosed,
  viewerRole,
  canModerate = true,
  showSecurity = false,
  postAction,
  toggleClosedAction,
  heading = 'Conversation & timeline',
}: Props) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const entries = buildSubmissionTimeline({ attempts, reviews, messages })
  const latestAttemptNumber = attempts.reduce((max, a) => Math.max(max, a.submission_number), 0)
  const atMessageLimit = messages.length >= MAX_MESSAGES_PER_THREAD
  const canCompose = !!postAction && !threadClosed && !atMessageLimit && (viewerRole === 'contributor' || canModerate)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!postAction) return
    const trimmed = body.trim()
    if (!trimmed) {
      setError('Write a message first.')
      setStatusMsg(null)
      return
    }
    setSending(true)
    setError(null)
    setStatusMsg(null)
    try {
      const res = await postAction(contributionId, body)
      if (!res.ok) {
        setError(res.error ?? 'Could not send your message.')
        return
      }
      setBody('')
      setStatusMsg(viewerRole === 'staff' ? 'Feedback sent and the contributor has been notified.' : 'Reply sent and the reviewer has been notified.')
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  async function handleToggleClosed() {
    if (!toggleClosedAction) return
    setToggling(true)
    setError(null)
    setStatusMsg(null)
    try {
      const nextClosed = !threadClosed
      const res = await toggleClosedAction(contributionId, nextClosed)
      if (!res.ok) {
        setError(res.error ?? 'Could not update the conversation status.')
        return
      }
      setStatusMsg(nextClosed ? 'Conversation closed.' : 'Conversation reopened.')
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <section className="st-panel st-wrap" aria-label={heading}>
      <style>{`
        .st-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .st-wrap { min-width: 0; }
        .st-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .st-title-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .st-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .st-pill { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .st-pill.open { color: var(--success); border-color: color-mix(in srgb, var(--success) 35%, transparent); }
        .st-pill.closed { color: var(--warning); border-color: color-mix(in srgb, var(--gold) 35%, transparent); }
        .st-list { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .st-card { border: 1px solid rgba(255,255,255,0.06); padding: 14px; display: flex; flex-direction: column; gap: 8px; min-width: 0; background: rgba(255,255,255,0.015); }
        .st-card.staff { border-left: 2px solid var(--orange); background: color-mix(in srgb, var(--orange) 5%, transparent); }
        .st-card.contributor { border-left: 2px solid rgba(255,255,255,0.28); }
        .st-card.decision-verified { border-left: 2px solid var(--success); background: color-mix(in srgb, var(--success) 6%, transparent); }
        .st-card.decision-rejected { border-left: 2px solid var(--error); background: color-mix(in srgb, var(--error) 6%, transparent); }
        .st-card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--grey-mid); }
        .st-author { color: var(--white); font-weight: 600; font-size: 13px; }
        .st-kind { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); }
        .st-kind.verified { color: var(--success); }
        .st-kind.rejected { color: var(--error); }
        .st-kind.contributor { color: var(--off-white); }
        .st-body { color: var(--off-white); font-size: 13.5px; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
        .st-hint { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
        .st-link { color: var(--orange); word-break: break-all; text-decoration: none; }
        .st-link:hover { text-decoration: underline; }
        .st-input { background: var(--navy-mid, #0b1a2e); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; min-height: 92px; resize: vertical; }
        .st-input:focus { border-color: var(--orange); }
        .st-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 18px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; }
        .st-btn:disabled { opacity: 0.6; cursor: default; }
        .st-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .st-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; }
        .st-alert.error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
        .st-alert.ok { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
        .st-attempt summary { cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--off-white); font-size: 13px; list-style: none; }
        .st-attempt summary::-webkit-details-marker { display: none; }
        .st-attempt-body { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 8px; }
        .st-checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
        .st-composer { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
        .st-composer-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .st-empty { font-size: 13px; color: var(--grey-mid); line-height: 1.5; }
        @media (max-width: 640px) {
          .st-panel { padding: 16px; }
          .st-card { padding: 12px; }
          .st-checks { grid-template-columns: 1fr; }
          .st-composer-foot .st-btn { width: 100%; }
        }
      `}</style>

      <div className="st-head">
        <div className="st-title-group">
          <span className="st-title">{heading}</span>
          <span className={`st-pill ${threadClosed ? 'closed' : 'open'}`}>
            {threadClosed ? 'Closed' : 'Open'}
          </span>
        </div>
        {viewerRole === 'staff' && canModerate && toggleClosedAction && (
          <button
            type="button"
            className="st-btn ghost"
            disabled={toggling}
            onClick={handleToggleClosed}
          >
            {toggling ? 'Updating…' : threadClosed ? 'Reopen thread' : 'Close thread'}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="st-empty">
          No feedback or review updates yet. Start the conversation below to share notes or ask questions.
        </div>
      ) : (
        <div className="st-list">
          {entries.map((entry) => {
            if (entry.type === 'attempt') {
              const a = entry.attempt
              const isOlder = attempts.length > 1 && a.submission_number < latestAttemptNumber
              const safeUrl = safeHref(a.evidence_url)
              return (
                <details key={entry.id} className="st-card st-attempt" open={!isOlder && attempts.length > 1}>
                  <summary>
                    <span>
                      <strong style={{ color: 'var(--white)' }}>Attempt {a.submission_number} submitted</strong>
                      {a.title ? ` · ${a.title}` : ''}
                    </span>
                    <span className="st-hint">{formatWhen(a.submitted_at)} · {isOlder ? 'Compare' : 'Details'}</span>
                  </summary>
                  <div className="st-attempt-body">
                    <div className="st-body">{a.description}</div>
                    {a.evidence_url && (
                      safeUrl
                        ? <a className="st-link" href={safeUrl} target="_blank" rel="noopener noreferrer">{a.evidence_url}</a>
                        : <span className="st-body">{a.evidence_url}</span>
                    )}
                  </div>
                </details>
              )
            }

            if (entry.type === 'review') {
              const r = entry.review
              const f = r.feedback ?? {}
              const allChecks = r.checks ?? {}
              const checks = showSecurity
                ? allChecks
                : Object.fromEntries(Object.entries(allChecks).filter(([k]) => !isStaffOnlyIssue(k)))
              const issues = showSecurity ? f.issues : f.issues?.filter((i) => !isStaffOnlyIssue(i.check))
              const whatToDo = showSecurity || hasMemberFixableFailure(allChecks) ? f.what_to_do : undefined
              const comparison = showSecurity ? (f.resubmission_assessment ?? null) : memberResubmissionView(f.resubmission_assessment)
              return (
                <div key={entry.id} className="st-card">
                  <div className="st-card-head">
                    <span>
                      <strong className="st-author">{r.source === 'staff' ? 'Team review' : 'Automated review'}</strong>
                      {' · '}Attempt {r.submission_number}
                    </span>
                    <span>
                      {DECISION_LABELS[r.decision] ?? r.decision}
                      {r.overall_score !== null ? ` · ${Math.round(Number(r.overall_score))}/100` : ''}
                      {r.created_at ? ` · ${formatWhen(r.created_at)}` : ''}
                    </span>
                  </div>
                  {f.summary && <div className="st-body">{f.summary}</div>}
                  {Object.keys(checks).length > 0 && (
                    <div className="st-checks">
                      {Object.entries(checks).map(([k, v]) => (
                        <span key={k} className="st-hint" style={{ color: v ? 'var(--success)' : 'var(--error)' }}>
                          {v ? '✓' : '✕'} {CHECK_LABELS[k] ?? k}
                        </span>
                      ))}
                    </div>
                  )}
                  {issues && issues.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {issues.map((i, n) => (
                        <li key={n} className="st-hint" style={{ color: 'var(--off-white)' }}>{i.message}</li>
                      ))}
                    </ul>
                  )}
                  {whatToDo && (
                    <div className="st-hint" style={{ whiteSpace: 'pre-wrap', color: 'var(--off-white)', overflowWrap: 'anywhere' }}>
                      <strong>What to do: </strong>{whatToDo}
                    </div>
                  )}
                  {showSecurity && Array.isArray((r.code_audit as any)?.security_issues) && (r.code_audit as any).security_issues.length > 0 && (
                    <div className="st-hint" style={{ overflowWrap: 'anywhere' }}>
                      <strong style={{ color: 'var(--error)' }}>Security findings</strong>
                      {((r.code_audit as any).security_issues as SecurityIssue[]).map((i, n) => (
                        <div key={n}>[{(i.severity ?? 'unknown').toUpperCase()}] {i.description}{i.location ? ` (${i.location})` : ''}</div>
                      ))}
                    </div>
                  )}
                  {comparison && (comparison.summary || (comparison.previous_issues_resolved ?? []).length > 0) && (
                    <div className="st-hint" style={{ overflowWrap: 'anywhere' }}>
                      <strong>Compared with your last submission: </strong>{comparison.summary}
                      {(comparison.previous_issues_resolved ?? []).map((p, n) => (
                        <div key={n}>
                          {p.status === 'resolved' ? '✓' : p.status === 'partially_resolved' ? '◐' : '✕'} {CHECK_LABELS[p.check] ?? p.check} — {p.explanation}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            const m = entry.message
            const cardTone =
              m.kind === 'decision_verified' ? 'decision-verified'
              : m.kind === 'decision_rejected' ? 'decision-rejected'
              : m.author_role === 'staff' ? 'staff' : 'contributor'
            const kindTone =
              m.kind === 'decision_verified' ? 'verified'
              : m.kind === 'decision_rejected' ? 'rejected'
              : m.author_role === 'contributor' ? 'contributor' : ''

            return (
              <div key={entry.id} className={`st-card ${cardTone}`}>
                <div className="st-card-head">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="st-author">{m.author_name}</span>
                    <span className={`st-kind ${kindTone}`}>{MESSAGE_KIND_LABELS[m.kind] ?? m.kind}</span>
                  </span>
                  <span>Attempt {m.submission_number} · {formatWhen(m.created_at)}</span>
                </div>
                <div className="st-body">{m.body}</div>
              </div>
            )
          })}
        </div>
      )}

      {error && <div className="st-alert error" role="alert">{error}</div>}
      {statusMsg && <div className="st-alert ok" role="status">{statusMsg}</div>}

      {threadClosed ? (
        <div className="st-hint">
          This conversation is closed. {viewerRole === 'staff' && canModerate ? 'Reopen the thread above if you want to continue discussing this submission.' : 'No new replies can be added.'}
        </div>
      ) : atMessageLimit ? (
        <div className="st-hint">This thread has reached its {MAX_MESSAGES_PER_THREAD}-message limit.</div>
      ) : canCompose ? (
        <form className="st-composer" onSubmit={handleSend}>
          <label className="st-hint" htmlFor={`thread-msg-${contributionId}`}>
            {viewerRole === 'staff'
              ? 'Leave feedback or reply to the contributor'
              : 'Reply to the team or ask a clarifying question'}
          </label>
          <textarea
            id={`thread-msg-${contributionId}`}
            className="st-input"
            maxLength={MESSAGE_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              viewerRole === 'staff'
                ? 'Share what you are adopting, ask a follow-up question, or explain next steps…'
                : 'Respond to feedback, share your thoughts on trade-offs, or ask a question…'
            }
          />
          <div className="st-composer-foot">
            <span className="st-hint">{body.length.toLocaleString()} / {MESSAGE_MAX.toLocaleString()}</span>
            <button type="submit" className="st-btn" disabled={sending || !body.trim()}>
              {sending ? 'Sending…' : viewerRole === 'staff' ? 'Send feedback' : 'Send reply'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
