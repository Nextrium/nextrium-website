import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireStaff } from '@/lib/contributions/auth'
import { getMemberDirectory } from '@/lib/contributions/members'
import { CATEGORIES, CATEGORY_LABELS, COMPLEXITY_LABELS, TASK_STATUSES, isCategory } from '@/lib/contributions/constants'
import { TASK_STATUS_LABELS, deadlineLabel, isOverdue } from '@/lib/contributions/taskView'
import type { Task } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tasks' }

interface Props {
  searchParams: Promise<{ status?: string; category?: string; assignee?: string; overdue?: string }>
}

export default async function TasksPage({ searchParams }: Props) {
  // Staff only. Checked here as well as by the page gate, since this data is
  // read with the service role.
  if ('error' in (await requireStaff())) notFound()

  const filters = await searchParams
  const supabase = createServiceClient() as any
  let query = supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(500)
  if (filters.status && (TASK_STATUSES as readonly string[]).includes(filters.status)) query = query.eq('status', filters.status)
  if (isCategory(filters.category)) query = query.eq('category', filters.category)
  if (filters.assignee && /^[0-9a-f-]{36}$/i.test(filters.assignee)) query = query.eq('assigned_to', filters.assignee)
  const { data } = await query
  let tasks: Task[] = data ?? []
  const now = new Date()
  if (filters.overdue === '1') tasks = tasks.filter((t) => isOverdue(t, now))

  const members = await getMemberDirectory()
  const emailOf = new Map(members.map((m) => [m.userId, m.email]))

  return (
    <>
      <style>{`
        .tasks-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-bottom: 20px; }
        .tasks-filters label { display: flex; flex-direction: column; gap: 6px; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .tasks-filters select { background: var(--navy); color: var(--off-white); border: 1px solid rgba(255,255,255,0.1); padding: 8px 10px; font-size: 12px; min-width: 150px; }
        .tasks-filters .check { flex-direction: row; align-items: center; padding-bottom: 8px; }
        .tasks-btn { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 10px 18px; background: var(--orange); color: var(--white); border: none; text-decoration: none; cursor: pointer; display: inline-flex; }
        .tasks-btn.ghost { background: none; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .tasks-table-wrap { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); overflow-x: auto; }
        .tasks-table { width: 100%; border-collapse: collapse; }
        .tasks-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding: 10px 16px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
        .tasks-table td { padding: 14px 16px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        .tasks-table tr:last-child td { border-bottom: none; }
        .tasks-table a.title { color: var(--white); text-decoration: none; font-weight: 600; }
        .tasks-table a.title:hover { color: var(--orange); }
        .tasks-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; display: inline-block; white-space: nowrap; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .tasks-badge.warn { color: var(--orange); border-color: rgba(219,103,39,0.35); }
        .tasks-badge.bad { color: var(--error); border-color: rgba(232,69,69,0.35); }
        .tasks-badge.good { color: var(--success); border-color: rgba(34,193,122,0.3); }
        .tasks-muted { color: var(--grey-mid); font-size: 12px; }
        .tasks-empty { padding: 56px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); }
      `}</style>

      <Header
        title="Tasks"
        description="Create and assign contributor tasks"
        action={<Link href="/dashboard/tasks/new" className="tasks-btn">+ New task</Link>}
      />

      <div className="dash-content">
        <form className="tasks-filters" method="get">
          <label>Status
            <select name="status" defaultValue={filters.status ?? ''}>
              <option value="">All</option>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label>Category
            <select name="category" defaultValue={filters.category ?? ''}>
              <option value="">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label>Assignee
            <select name="assignee" defaultValue={filters.assignee ?? ''}>
              <option value="">Anyone</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.email}</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue === '1'} /> Overdue only
          </label>
          <button type="submit" className="tasks-btn">Filter</button>
          <Link href="/dashboard/tasks" className="tasks-btn ghost">Clear</Link>
        </form>

        {tasks.length === 0 ? (
          <div className="tasks-empty">No tasks match. Create one with “New task”.</div>
        ) : (
          <div className="tasks-table-wrap">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Assignee</th>
                  <th>Deadline</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const overdue = isOverdue(t, now)
                  return (
                    <tr key={t.id}>
                      <td><Link className="title" href={`/dashboard/tasks/${t.id}`}>{t.title}</Link></td>
                      <td>{CATEGORY_LABELS[t.category]} <span className="tasks-muted">· {COMPLEXITY_LABELS[t.complexity]}</span></td>
                      <td>
                        <span className={`tasks-badge ${t.status === 'completed' ? 'good' : t.status === 'cancelled' ? '' : 'warn'}`}>{TASK_STATUS_LABELS[t.status]}</span>
                        {t.extension_status === 'requested' && <> <span className="tasks-badge warn">Extension requested</span></>}
                      </td>
                      <td className={t.assigned_to ? '' : 'tasks-muted'}>{t.assigned_to ? emailOf.get(t.assigned_to) ?? 'Unknown' : 'Unassigned'}</td>
                      <td>{overdue ? <span className="tasks-badge bad">{deadlineLabel(t, now)}</span> : <span className="tasks-muted">{deadlineLabel(t, now)}</span>}</td>
                      <td className="tasks-muted">{t.point_range_min}–{t.point_range_max}</td>
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
