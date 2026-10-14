import { checkLabel, type MemberFeedback } from '@/lib/submissionView'
import { C, F, tint } from '@/lib/theme'

const sectionLabel: React.CSSProperties = { fontFamily: F.body, fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim }

export function ScoreBar({ score, width = 100 }: { score: number; width?: number | string }) {
  const token = score >= 80 ? '--teal-l' : score >= 50 ? '--gold-l' : '--orange-w'
  return (
    <div className="flex items-center gap-3">
      <div style={{ width, height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }} role="img" aria-label={`Review score ${score} out of 100`}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, score))}%`, background: `var(${token})`, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: `var(${token})`, fontVariantNumeric: 'tabular-nums' }}>{score}/100</span>
    </div>
  )
}

/** The automated review's feedback as the contributor may see it. */
export default function FeedbackPanel({ feedback, score, attempt }: { feedback: MemberFeedback | null; score: number | null; attempt: number | null }) {
  if (!feedback && score === null) return null
  return (
    <div className="flex flex-col gap-4">
      {attempt && attempt > 1 && <p style={{ fontFamily: F.body, fontSize: 12, color: C.dim }}>Submission {attempt} of 3</p>}

      <div className="flex flex-col gap-3 p-4 rounded-xl border" style={{ background: C.void, borderColor: C.border }}>
        <p style={sectionLabel}>Automated quality review</p>
        {score !== null && <ScoreBar score={score} />}
        {feedback?.summary && <p style={{ fontFamily: F.body, fontSize: 13, color: C.mist, lineHeight: 1.7 }}>{feedback.summary}</p>}
        {feedback && feedback.checks.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 p-3 rounded-xl" style={{ background: C.depth, border: `1px solid ${C.border}` }}>
            {feedback.checks.map((c) => (
              <li key={c.name} className="flex items-center gap-2">
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: c.passed ? C.teal : C.accent, flexShrink: 0 }} />
                <span style={{ fontFamily: F.body, fontSize: 11, color: c.passed ? C.teal : C.mute }}>
                  {checkLabel(c.name)}<span className="sr-only">{c.passed ? ': passed' : ': needs work'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {feedback && feedback.issues.length > 0 && (
        <div className="flex flex-col gap-2">
          <p style={sectionLabel}>What to improve</p>
          <ul className="flex flex-col gap-2">
            {feedback.issues.map((i) => (
              <li key={i.message} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: C.void, border: `1px solid ${tint('--orange', 18)}` }}>
                <span style={{ padding: '2px 8px', borderRadius: 20, flexShrink: 0, fontFamily: F.body, fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', background: tint('--orange', 12), color: C.accent }}>
                  {checkLabel(i.check)}
                </span>
                <p style={{ fontFamily: F.body, fontSize: 12, color: C.mist, lineHeight: 1.65 }}>{i.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback?.whatToDo && (
        <p className="p-3 rounded-lg" style={{ fontFamily: F.body, fontSize: 12, color: C.mist, lineHeight: 1.65, background: C.void, border: `1px solid ${C.border}` }}>
          <span style={{ color: C.accent, fontWeight: 500 }}>What to do: </span>
          {feedback.whatToDo}
        </p>
      )}

      {feedback?.resubmission && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border" style={{ background: C.void, borderColor: C.border }}>
          <p style={sectionLabel}>Compared with your last submission</p>
          {feedback.resubmission.summary && <p style={{ fontFamily: F.body, fontSize: 12, color: C.mist, lineHeight: 1.65 }}>{feedback.resubmission.summary}</p>}
          {(feedback.resubmission.previous_issues_resolved ?? []).map((p) => {
            const token = p.status === 'resolved' ? '--teal-l' : p.status === 'partially_resolved' ? '--gold-l' : '--grey-mid'
            return (
              <div key={p.check} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: C.depth, border: `1px solid ${C.border}` }}>
                <span style={{ padding: '2px 8px', borderRadius: 20, flexShrink: 0, fontFamily: F.body, fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', background: tint(token, 14), color: `var(${token})` }}>
                  {String(p.status ?? '').replace(/_/g, ' ')}
                </span>
                <div className="flex flex-col gap-1">
                  <p style={{ fontFamily: F.body, fontSize: 11, fontWeight: 500, color: C.light }}>{checkLabel(p.check)}</p>
                  <p style={{ fontFamily: F.body, fontSize: 11, color: C.mute, lineHeight: 1.6 }}>{p.explanation}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
