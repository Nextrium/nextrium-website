import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireStaff } from '@/lib/contributions/auth'
import { getMemberDirectory } from '@/lib/contributions/members'
import { CATEGORY_LABELS, COMPLEXITY_LABELS } from '@nextrium/contributions-core/constants'
import { describeSchedule } from '@nextrium/contributions-core/recurring'
import type { RecurringTask } from '@nextrium/supabase/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Recurring tasks' }

export default async function RecurringTasksPage() {
  if ('error' in (await requireStaff())) notFound()

  const supabase = createServiceClient() as any
  const [{ data: rows }, members] = await Promise.all([
    supabase.from('recurring_tasks').select('*').order('created_at', { ascending: false }).limit(200),
    getMemberDirectory(),
  ])
  const schedules: RecurringTask[] = rows ?? []
  const nameOf = new Map(members.map((m) => [m.userId, m.name]))

  return (
    <>
      <style>{`
        .rec-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .rec-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 10px 18px; background: var(--orange); color: var(--white); border: 1px solid var(--orange); text-decoration: none; display: inline-flex; align-items: center; min-height: 38px; }
        .rec-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .rec-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
        .rec-table { width: 100%; border-collapse: collapse; }
        .rec-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
        .rec-table td { padding: 14px 16px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .rec-table tr:last-child td { border-bottom: none; }
        .rec-table a.title { color: var(--white); text-decoration: none; font-weight: 600; }
        .rec-table a.title:hover { color: var(--orange); }
        .rec-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .rec-badge.active { color: var(--success); border-color: color-mix(in srgb, var(--success) 35%, transparent); }
        .rec-badge.paused { color: var(--orange); border-color: color-mix(in srgb, var(--orange) 35%, transparent); }
        .rec-muted { color: var(--grey-mid); font-size: 12px; }
        .rec-empty { padding: 48px 24px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); font-size: 13px; }
      `}</style>
      <Header
        title="Recurring schedules"
        description="Automated recurring tasks with date ranges, direct review, and 3-day draft cleanup"
        action={
          <div className="rec-actions">
            <Link href="/tasks" className="rec-btn ghost">Back to tasks</Link>
            <Link href="/tasks/new?recurring=1" className="rec-btn">+ New recurring task</Link>
          </div>
        }
      />
      <div className="dash-content">
        {schedules.length === 0 ? (
          <div className="rec-empty">
            No recurring schedules yet. Click “+ New recurring task” (or choose Recurring inside New task) to set up weekly calls, coordination, or operational routines.
          </div>
        ) : (
          <div className="rec-wrap">
            <table className="rec-table">
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Cadence &amp; range</th>
                  <th>Assigned to</th>
                  <th>Review</th>
                  <th>Status</th>
                  <th>Next run</th>
                  <th>Cycles</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const who =
                    s.assignment_mode === 'draft' ? 'Unassigned draft'
                    : s.assignment_mode === 'one' ? (nameOf.get(s.assignee_ids[0] ?? '') ?? '1 member')
                    : `${s.assignee_ids.length} people`
                  return (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/tasks/recurring/${s.id}`} className="title">{s.title}</Link>
                        <div className="rec-muted">{CATEGORY_LABELS[s.category]} · {COMPLEXITY_LABELS[s.complexity]} · {s.duration_days}d window</div>
                      </td>
                      <td className="rec-muted">{describeSchedule(s)}</td>
                      <td className="rec-muted">{who}</td>
                      <td>
                        <span className="rec-badge">{s.skip_automated_review ? 'Direct review' : 'Automated review'}</span>
                      </td>
                      <td>
                        <span className={`rec-badge ${s.status === 'active' ? 'active' : s.status === 'paused' ? 'paused' : ''}`}>{s.status}</span>
                      </td>
                      <td className="rec-muted">{s.next_run_on ?? '—'}</td>
                      <td className="rec-muted">
                        {s.occurrences_created}{s.max_occurrences ? ` / ${s.max_occurrences}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
