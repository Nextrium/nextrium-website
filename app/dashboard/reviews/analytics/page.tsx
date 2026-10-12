import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireStaff } from '@/lib/contributions/auth'
import {
  computeReviewAnalytics,
  formatHours,
  type AnalyticsContributionRow,
  type AnalyticsReviewRow,
} from '@/lib/contributions/analytics'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Review analytics' }

const PAGE_SIZE = 1000
const MAX_ROWS = 20_000

const DECISION_LABELS: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Changes requested',
  human_required: 'Sent to staff',
}

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Reviewing',
  review_failed: 'Review failed',
  changes_requested: 'Changes requested',
  needs_human: 'Needs staff',
  ai_approved: 'AI approved',
  verified: 'Verified',
  rejected: 'Rejected',
}

/** Reads every row in pages (the API caps one response), up to MAX_ROWS. */
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await query(from, Math.min(from + PAGE_SIZE, MAX_ROWS) - 1)
    if (error) return { rows, failed: true, capped: false }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return { rows, failed: false, capped: false }
  }
  return { rows, failed: false, capped: true }
}

function pct(part: number, whole: number): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : '—'
}

function Bars({ items }: { items: { label: string; count: number }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="ra-bars">
      {items.map((i) => (
        <div key={i.label} className="ra-bar-row">
          <span className="ra-bar-label">{i.label}</span>
          <span className="ra-bar-track"><span className="ra-bar-fill" style={{ width: `${(i.count / max) * 100}%` }} /></span>
          <span className="ra-bar-value">{i.count} <span className="ra-muted">{pct(i.count, total)}</span></span>
        </div>
      ))}
    </div>
  )
}

export default async function ReviewAnalyticsPage() {
  if ('error' in (await requireStaff())) notFound()

  const supabase = createServiceClient() as any
  const [contributions, reviews] = await Promise.all([
    readAll<AnalyticsContributionRow>((from, to) =>
      supabase.from('contributions')
        .select('id, status, submission_count, submitted_at, review_failure_count')
        .order('submitted_at', { ascending: false }).order('id').range(from, to)),
    readAll<AnalyticsReviewRow>((from, to) =>
      supabase.from('contribution_reviews')
        .select('contribution_id, submission_number, source, decision, overall_score, created_at')
        .order('created_at', { ascending: false }).order('id').range(from, to)),
  ])
  const a = computeReviewAnalytics(contributions.rows, reviews.rows)

  const stats = [
    { label: 'Contributions', value: String(a.contributions), hint: `${a.submissions} submissions` },
    { label: 'AI reviews', value: String(a.serviceReviews), hint: `${a.staffReviews} staff decisions` },
    { label: 'Average score', value: a.averageScore === null ? '—' : String(Math.round(a.averageScore)), hint: 'AI reviews with a score' },
    { label: 'Failure rate', value: a.failureRate === null ? '—' : `${Math.round(a.failureRate * 100)}%`, hint: `${a.failures} failed calls` },
    { label: 'Median turnaround', value: formatHours(a.turnaroundHours.median), hint: `p90 ${formatHours(a.turnaroundHours.p90)}` },
  ]

  return (
    <>
      <style>{`
        .ra-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .ra-card { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 18px 20px; }
        .ra-card-label { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .ra-card-value { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 700; font-size: 26px; color: var(--white); margin: 6px 0 2px; }
        .ra-muted { color: var(--grey-mid); font-size: 12px; }
        .ra-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
        .ra-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; }
        .ra-panel h2 { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); margin: 0 0 14px; font-weight: 400; }
        .ra-bars { display: flex; flex-direction: column; gap: 10px; }
        .ra-bar-row { display: grid; grid-template-columns: 130px 1fr 80px; align-items: center; gap: 12px; font-size: 13px; color: var(--off-white); }
        .ra-bar-track { height: 8px; background: rgba(255,255,255,0.05); }
        .ra-bar-fill { display: block; height: 100%; background: var(--orange); }
        .ra-bar-value { text-align: right; }
        .ra-note { font-size: 12px; color: var(--grey-mid); margin-top: 18px; line-height: 1.6; }
        .ra-warn { font-size: 12px; color: var(--orange); margin-bottom: 16px; }
        .ra-back { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-mid); text-decoration: none; }
        .ra-back:hover { color: var(--orange); }
      `}</style>
      <Header
        title="Review analytics"
        description="How automated reviews are going across all contributions"
        action={<Link href="/dashboard/reviews" className="ra-back">Review queue</Link>}
      />
      <div className="dash-content">
        {(contributions.failed || reviews.failed) && (
          <div className="ra-warn">Some data could not be loaded, so these numbers may be incomplete.</div>
        )}
        {(contributions.capped || reviews.capped) && (
          <div className="ra-warn">Showing the most recent {MAX_ROWS.toLocaleString()} rows only.</div>
        )}

        <div className="ra-grid">
          {stats.map((s) => (
            <div key={s.label} className="ra-card">
              <div className="ra-card-label">{s.label}</div>
              <div className="ra-card-value">{s.value}</div>
              <div className="ra-muted">{s.hint}</div>
            </div>
          ))}
        </div>

        <div className="ra-panels">
          <div className="ra-panel">
            <h2>AI decisions</h2>
            <Bars items={Object.entries(a.decisionMix).map(([k, count]) => ({ label: DECISION_LABELS[k] ?? k, count }))} />
          </div>
          <div className="ra-panel">
            <h2>AI score distribution</h2>
            <Bars items={a.scoreBuckets} />
          </div>
          <div className="ra-panel">
            <h2>Where contributions are now</h2>
            <Bars items={Object.entries(a.statusMix).map(([k, count]) => ({ label: STATUS_LABELS[k] ?? k, count }))} />
          </div>
        </div>

        <p className="ra-note">
          Failure rate is failed review calls out of all review calls, counting retries. Turnaround is the time from a
          submission to its AI result, for each contribution&apos;s latest submission ({a.turnaroundHours.samples} measured).
        </p>
      </div>
    </>
  )
}
