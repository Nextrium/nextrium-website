'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAX_MESSAGES_PER_THREAD,
  MESSAGE_MAX,
  buildSubmissionTimeline,
  type AttemptSnapshot,
  type LegacyStaffNote,
  type ThreadMessage,
} from '@nextrium/contributions-core/thread'
import { postPortalContributorReply } from '@/app/actions/work'
import { C, F, tint } from '@/lib/theme'

const KIND_LABELS: Record<ThreadMessage['kind'], string> = {
  feedback: 'Core team feedback',
  reply: 'Your reply',
  decision_verified: 'Verified · Core team feedback',
  decision_changes: 'Changes requested',
  decision_rejected: 'Not accepted · Feedback',
}

function fmtWhen(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
  } catch {
    return ''
  }
}

export default function SubmissionThread({
  contributionId,
  attempts,
  messages,
  submissionCount,
  legacyStaffNote = null,
  threadClosed,
}: {
  contributionId: string
  attempts: AttemptSnapshot[]
  messages: ThreadMessage[]
  submissionCount?: number
  legacyStaffNote?: LegacyStaffNote | null
  threadClosed: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const entries = buildSubmissionTimeline({ attempts, reviews: [], messages, legacyStaffNote })
  const latestAttempt = attempts.reduce((max, a) => Math.max(max, a.submission_number), 0)
  const missingOlderSnapshots = typeof submissionCount === 'number' && submissionCount > attempts.length && attempts.length > 0
  const atLimit = messages.length >= MAX_MESSAGES_PER_THREAD

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) {
      setError('Write a message first.')
      setDone(null)
      return
    }
    setSending(true)
    setError(null)
    setDone(null)
    try {
      const res = await postPortalContributorReply(contributionId, body)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setBody('')
      setDone('Reply sent. The core team has been notified.')
      router.refresh()
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section
      aria-label="Conversation and timeline"
      style={{ background: C.depth, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light }}>
          Conversation &amp; attempt history
        </h2>
        <span
          style={{
            fontFamily: F.body,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 999,
            color: threadClosed ? C.gold : C.teal,
            background: tint(threadClosed ? '--gold' : '--teal', 12),
            border: `1px solid ${tint(threadClosed ? '--gold' : '--teal', 30)}`,
          }}
        >
          {threadClosed ? 'Closed' : 'Open'}
        </span>
      </div>

      {missingOlderSnapshots && (
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute, lineHeight: 1.6 }}>
          This submission had {submissionCount} attempts before attempt snapshots were enabled. Earlier submission text was not stored.
        </p>
      )}

      {entries.length === 0 ? (
        <p style={{ fontFamily: F.body, fontSize: 13, color: C.mute, lineHeight: 1.6 }}>
          No messages yet. If you have questions about your submission or review, leave a note for the core team below.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            if (entry.type === 'attempt') {
              const a = entry.attempt
              const isOlder = attempts.length > 1 && a.submission_number < latestAttempt
              return (
                <details
                  key={entry.id}
                  open={!isOlder && attempts.length > 1}
                  style={{
                    background: C.void,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                  }}
                >
                  <summary
                    className="flex items-center justify-between gap-2 flex-wrap cursor-pointer"
                    style={{ fontFamily: F.body, fontSize: 13, color: C.light, listStyle: 'none' }}
                  >
                    <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
                      <strong>Attempt {a.submission_number} submitted</strong>
                      {a.title ? ` · ${a.title}` : ''}
                    </span>
                    <span style={{ fontSize: 11, color: C.mute }}>
                      {fmtWhen(a.submitted_at)} · {isOlder ? 'Compare' : 'Details'}
                    </span>
                  </summary>
                  <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
                    <p style={{ fontFamily: F.body, fontSize: 13, color: C.mist, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {a.description}
                    </p>
                    {a.evidence_url && (
                      <a
                        href={a.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontFamily: F.body, fontSize: 13, color: C.accent, textDecoration: 'none', overflowWrap: 'anywhere' }}
                      >
                        {a.evidence_url} ↗
                      </a>
                    )}
                  </div>
                </details>
              )
            }

            if (entry.type !== 'message') return null
            const m = entry.message
            const isStaff = m.author_role === 'staff'
            const accentToken =
              m.kind === 'decision_verified' ? '--teal'
              : m.kind === 'decision_rejected' ? '--error'
              : isStaff ? '--orange' : '--mist'

            return (
              <div
                key={entry.id}
                style={{
                  background: isStaff ? tint(accentToken, 6) : C.void,
                  border: `1px solid ${isStaff ? tint(accentToken, 25) : C.border}`,
                  borderLeft: `3px solid var(${accentToken})`,
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 13, color: C.light }}>{m.author_name}</span>
                    <span
                      style={{
                        fontFamily: F.body,
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: isStaff ? `var(${accentToken})` : C.mute,
                      }}
                    >
                      {KIND_LABELS[m.kind] ?? m.kind}
                    </span>
                  </div>
                  <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute }}>
                    Attempt {m.submission_number} · {fmtWhen(m.created_at)}
                  </span>
                </div>
                <p style={{ fontFamily: F.body, fontSize: 13.5, color: C.light, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {m.body}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p role="alert" style={{ fontFamily: F.body, fontSize: 13, color: C.danger, lineHeight: 1.5 }}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" style={{ fontFamily: F.body, fontSize: 13, color: C.teal, lineHeight: 1.5 }}>
          {done}
        </p>
      )}

      {threadClosed ? (
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute, lineHeight: 1.6 }}>
          This conversation has been closed by the core team. No new replies can be added.
        </p>
      ) : atLimit ? (
        <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute, lineHeight: 1.6 }}>
          This conversation has reached its {MAX_MESSAGES_PER_THREAD}-message limit.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <label htmlFor={`portal-reply-${contributionId}`} className="field-label" style={{ marginBottom: 0 }}>
            Reply to the core team
          </label>
          <textarea
            id={`portal-reply-${contributionId}`}
            rows={4}
            maxLength={MESSAGE_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="portal-input"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: C.void,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.light,
              fontFamily: F.body,
              fontSize: 13,
              resize: 'vertical',
            }}
            placeholder="Respond to feedback, clarify trade-offs, or ask a question before your next step…"
          />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute }}>
              {body.length.toLocaleString()} / {MESSAGE_MAX.toLocaleString()}
            </span>
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="btn-primary w-full sm:w-auto justify-center"
              style={{ fontSize: 13, minHeight: 40, opacity: sending || !body.trim() ? 0.6 : 1, cursor: sending ? 'progress' : 'pointer' }}
            >
              {sending ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
