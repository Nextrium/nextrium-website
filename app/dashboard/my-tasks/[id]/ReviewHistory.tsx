import type { ContributionReview } from '@/lib/types/database'

// Review feedback comes from the review service (or staff), so every value is
// rendered as text by React — never as HTML.

const CHECK_LABELS: Record<string, string> = {
  evidence_url_present: 'Evidence link provided',
  evidence_url_reachable: 'Evidence link opens',
  title_descriptive: 'Title is specific',
  description_substance: 'Description explains the work',
  description_protocol_connection: 'Connects to Nextrium',
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

interface Feedback {
  summary?: string
  issues?: { check: string; message: string }[]
  what_to_do?: string
  resubmission_assessment?: {
    summary?: string
    previous_issues_resolved?: { check: string; status: string; explanation: string }[]
  }
}

export default function ReviewHistory({ reviews }: { reviews: ContributionReview[] }) {
  if (reviews.length === 0) return null
  return (
    <div className="mt-panel">
      <div className="mt-panel-title">Review history</div>
      {reviews.map((r) => {
        const f = (r.feedback ?? {}) as Feedback
        const checks = (r.checks ?? {}) as Record<string, boolean>
        return (
          <div key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="mt-kv">
              <span>Submission #{r.submission_number} · {r.source === 'staff' ? 'Team' : 'Automated review'}</span>
              <span>{DECISION_LABELS[r.decision] ?? r.decision}{r.overall_score !== null ? ` · ${Math.round(Number(r.overall_score))}/100` : ''}</span>
            </div>
            {f.summary && <div className="mt-brief" style={{ fontSize: 13 }}>{f.summary}</div>}
            {Object.keys(checks).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                {Object.entries(checks).map(([k, v]) => (
                  <span key={k} className="mt-hint" style={{ color: v ? 'var(--success)' : 'var(--error)' }}>{v ? '✓' : '✕'} {CHECK_LABELS[k] ?? k}</span>
                ))}
              </div>
            )}
            {f.issues && f.issues.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {f.issues.map((i, n) => <li key={n} className="mt-hint" style={{ color: 'var(--off-white)' }}>{i.message}</li>)}
              </ul>
            )}
            {f.what_to_do && <div className="mt-hint" style={{ whiteSpace: 'pre-wrap', color: 'var(--off-white)' }}><strong>What to do: </strong>{f.what_to_do}</div>}
            {f.resubmission_assessment?.summary && (
              <div className="mt-hint">
                <strong>Compared with your last submission: </strong>{f.resubmission_assessment.summary}
                {(f.resubmission_assessment.previous_issues_resolved ?? []).map((p, n) => (
                  <div key={n}>{p.status === 'resolved' ? '✓' : p.status === 'partially_resolved' ? '◐' : '✕'} {CHECK_LABELS[p.check] ?? p.check} — {p.explanation}</div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
