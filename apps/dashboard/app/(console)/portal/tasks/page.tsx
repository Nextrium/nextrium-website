import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATEGORIES, CATEGORY_LABELS, COMPLEXITY_LABELS, isCategory, type Complexity } from '@nextrium/contributions-core/constants'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { community, contributorName, requirePortalStaff } from '@/lib/portal/server'
import { EXTENSION_LABELS, PORTAL_TASK_STATUSES, PORTAL_TASK_STATUS_LABELS, extensionState, type PortalTaskStatus } from '@/lib/portal/taskRules'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal tasks' }

type Tab = PortalTaskStatus | 'extensions'

interface Props {
  searchParams: Promise<{ status?: string; category?: string }>
}

export default async function PortalTasksPage({ searchParams }: Props) {
  if ('error' in (await requirePortalStaff())) notFound()
  const params = await searchParams
  const tab: Tab = params.status === 'extensions' ? 'extensions' : (PORTAL_TASK_STATUSES as readonly string[]).includes(params.status ?? '') ? (params.status as PortalTaskStatus) : 'open'
  const category = isCategory(params.category) ? params.category : null

  const db = community()
  const [{ data: all, error: e1 }, { data: people, error: e2 }] = await Promise.all([
    db.from('tasks').select('id, title, category, complexity, point_range_min, point_range_max, status, assigned_to, deadline_at, extended_deadline_at, extension_granted, extension_requested_at, created_at').order('created_at', { ascending: false }).limit(1000),
    db.from('contributors').select('id, name, contributor_type, team_name'),
  ])
  if (e1 || e2) throw new Error('Could not load tasks')

  const nameOf = new Map((people ?? []).map((p) => [p.id, contributorName(p)]))
  const tasks = all ?? []
  const pendingExt = (t: (typeof tasks)[number]) => t.status === 'assigned' && extensionState(t) === 'requested'
  const counts: Record<Tab, number> = {
    open: tasks.filter((t) => t.status === 'open').length,
    assigned: tasks.filter((t) => t.status === 'assigned').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    extensions: tasks.filter(pendingExt).length,
  }
  const list = tasks
    .filter((t) => (tab === 'extensions' ? pendingExt(t) : t.status === tab))
    .filter((t) => !category || t.category === category)
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
  const now = Date.now()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'open', label: PORTAL_TASK_STATUS_LABELS.open },
    { key: 'assigned', label: PORTAL_TASK_STATUS_LABELS.assigned },
    { key: 'extensions', label: 'Extension requests' },
    { key: 'completed', label: PORTAL_TASK_STATUS_LABELS.completed },
  ]

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title="Portal tasks" description="Post tasks for the contributor portal and manage the ones in progress" action={<Link href="/portal/tasks/new" className="pt-btn">+ New task</Link>} />
      <div className="dash-content">
        <nav className="pt-tabs" aria-label="Task status">
          {tabs.map((t) => (
            <Link key={t.key} href={`/portal/tasks?status=${t.key}${category ? `&category=${category}` : ''}`} className="pt-tab" aria-current={t.key === tab ? 'page' : undefined}>
              {t.label}<span className="n">{counts[t.key]}</span>
            </Link>
          ))}
        </nav>
        <form className="pt-search" method="get">
          <input type="hidden" name="status" value={tab} />
          <select name="category" defaultValue={category ?? ''} className="pt-input" aria-label="Category" style={{ minWidth: 180 }}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <button type="submit" className="pt-btn ghost">Filter</button>
        </form>

        {list.length === 0 ? (
          <div className="pt-empty">No tasks here.</div>
        ) : (
          <div className="pt-table-wrap">
            <table className="pt-table">
              <thead>
                <tr><th>Task</th><th>Category</th><th>Points</th><th>{tab === 'open' || tab === 'completed' ? 'Posted' : 'Contributor'}</th><th>{tab === 'open' ? '' : 'Deadline'}</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const deadline = t.extension_granted && t.extended_deadline_at ? t.extended_deadline_at : t.deadline_at
                  const overdue = t.status === 'assigned' && deadline && new Date(deadline).getTime() < now
                  const ext = extensionState(t)
                  return (
                    <tr key={t.id}>
                      <td><Link href={`/portal/tasks/${t.id}`} className="title">{t.title}</Link></td>
                      <td className="pt-muted">{CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS] ?? t.category} · {COMPLEXITY_LABELS[t.complexity as Complexity] ?? t.complexity}</td>
                      <td className="pt-muted">{t.point_range_min}–{t.point_range_max}</td>
                      <td className="pt-muted">{tab === 'open' || tab === 'completed' ? fmt(t.created_at) : (t.assigned_to ? nameOf.get(t.assigned_to) ?? '—' : '—')}</td>
                      <td className="pt-muted">{t.status === 'assigned' ? fmt(deadline) : ''}</td>
                      <td style={{ textAlign: 'right' }}>
                        {overdue && <span className="pt-badge bad">Overdue</span>}{' '}
                        {t.status === 'assigned' && ext !== 'none' && <span className={`pt-badge ${ext === 'requested' ? 'warn' : ext === 'granted' ? 'good' : ''}`}>{EXTENSION_LABELS[ext]}</span>}
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
