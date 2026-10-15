import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isCategory, isComplexity } from '@nextrium/contributions-core/constants'
import Header from '@/components/dashboard/Header'
import { PORTAL_CSS } from '@/components/portal/portalStyles'
import { UUID, community, contributorName, requirePortalStaff } from '@/lib/portal/server'
import { assignableContributors } from '@/lib/portal/tasks'
import { EXTENSION_LABELS, PORTAL_TASK_STATUS_LABELS, deleteRule, extendedDeadline, extensionState, type PortalTaskStatus } from '@/lib/portal/taskRules'
import PortalTaskEditor from '../PortalTaskEditor'
import TaskManagePanel from './TaskManagePanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Portal task' }

export default async function PortalTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePortalStaff()
  if ('error' in auth) notFound()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const db = community()
  const { data: t, error } = await db.from('tasks').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Could not load the task')
  if (!t) notFound()

  const [{ data: holder }, { data: subs }, contributors] = await Promise.all([
    t.assigned_to ? db.from('contributors').select('id, name, email, contributor_type, team_name').eq('id', t.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
    db.from('contributions').select('id, status, submission_count, review_decision, contributor_id, created_at').eq('task_id', id).order('created_at', { ascending: false }),
    assignableContributors(),
  ])
  const status = (t.status ?? 'open') as PortalTaskStatus
  const ext = extensionState(t)
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
  const deadline = t.extension_granted && t.extended_deadline_at ? t.extended_deadline_at : t.deadline_at
  const del = deleteRule(t.status, subs ?? [])
  const waiting = (subs ?? []).some((s) => ['submitted', 'under_review', 'ai_approved'].includes(s.status ?? ''))
  const links = Array.isArray(t.links) ? (t.links as { label?: string; url?: string }[]).filter((l) => typeof l?.url === 'string').map((l) => ({ label: l.label ?? '', url: l.url! })) : []

  return (
    <>
      <style>{PORTAL_CSS}</style>
      <Header title={t.title} description={`${PORTAL_TASK_STATUS_LABELS[status] ?? t.status} · portal task`} action={<Link href={`/portal/tasks?status=${status}`} className="pt-btn ghost">Back to tasks</Link>} />
      <div className="dash-content">
        <div className="pt-layout">
          <div className="pt-main">
            {status === 'completed' && <div className="pt-alert info">This task is completed and can no longer be edited.</div>}
            <PortalTaskEditor
              initial={{
                id: t.id,
                status: t.status,
                title: t.title,
                description: t.description ?? '',
                category: isCategory(t.category) ? t.category : 'technical',
                complexity: isComplexity(t.complexity) ? t.complexity : 'small',
                links,
                tags: (t.primitives ?? []).join(', '),
              }}
              contributors={contributors}
            />
          </div>

          <div className="pt-side">
            <div className="pt-panel">
              <div className="pt-panel-title">Status</div>
              <span className={`pt-badge ${status === 'open' ? 'info' : status === 'assigned' ? 'warn' : 'good'}`}>{PORTAL_TASK_STATUS_LABELS[status] ?? t.status}</span>
              <dl className="pt-kv" style={{ gridTemplateColumns: '110px 1fr' }}>
                <dt>Points</dt><dd>{t.point_range_min}–{t.point_range_max}</dd>
                <dt>Window</dt><dd>{t.deadline_days ?? '—'} days</dd>
                {holder && <><dt>Contributor</dt><dd>{contributorName(holder)}</dd></>}
                {status === 'assigned' && <><dt>Claimed</dt><dd>{fmt(t.claimed_at)}</dd><dt>Deadline</dt><dd>{fmt(deadline)}</dd><dt>Extension</dt><dd>{EXTENSION_LABELS[ext]}</dd></>}
                <dt>Submissions</dt><dd>{(subs ?? []).length}</dd>
              </dl>
            </div>
            <TaskManagePanel
              taskId={t.id}
              status={status}
              extensionPending={status === 'assigned' && ext === 'requested'}
              extendedTo={status === 'assigned' && ext === 'requested' && t.deadline_at ? fmt(extendedDeadline(t.deadline_at, t.complexity)) : null}
              canUnassign={status === 'assigned' && !waiting}
              canDelete={auth.caller.role === 'admin' && del.ok}
              deleteRemoves={del.ok ? del.removeSubmissionIds.length : 0}
              deleteBlocked={auth.caller.role === 'admin' && status === 'open' && !del.ok ? del.error : null}
            />
          </div>
        </div>
      </div>
    </>
  )
}
