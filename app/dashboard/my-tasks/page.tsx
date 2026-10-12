import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { requireMember } from '@/lib/contributions/auth'
import { CATEGORY_LABELS, COMPLEXITY_LABELS } from '@/lib/contributions/constants'
import { TASK_STATUS_LABELS, deadlineLabel, isOverdue } from '@/lib/contributions/taskView'
import type { Task } from '@/lib/types/database'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My tasks' }

const CURRENT = ['assigned', 'changes_requested', 'submitted']

export default async function MyTasksPage() {
  const auth = await requireMember()
  if ('error' in auth) notFound()

  const supabase = createServiceClient() as any
  const [{ data: taskRows }, { data: profile }] = await Promise.all([
    // Only tasks assigned to the caller, filtered on the server.
    supabase.from('tasks').select('*').eq('assigned_to', auth.caller.userId).neq('status', 'draft').order('deadline_at', { ascending: true }),
    supabase.from('contributor_profiles').select('total_points, verified_contributions').eq('user_id', auth.caller.userId).maybeSingle(),
  ])
  const tasks: Task[] = taskRows ?? []
  const current = tasks.filter((t) => CURRENT.includes(t.status))
  const past = tasks.filter((t) => !CURRENT.includes(t.status))
  const now = new Date()

  const Row = ({ t }: { t: Task }) => (
    <Link href={`/dashboard/my-tasks/${t.id}`} className="mytask-row">
      <div>
        <div className="mytask-title">{t.title}</div>
        <div className="mytask-meta">{CATEGORY_LABELS[t.category]} · {COMPLEXITY_LABELS[t.complexity]} · {t.point_range_min}–{t.point_range_max} points</div>
      </div>
      <div className="mytask-right">
        <span className={`mytask-badge ${t.status === 'changes_requested' ? 'warn' : t.status === 'completed' ? 'good' : ''}`}>{TASK_STATUS_LABELS[t.status]}</span>
        {CURRENT.includes(t.status) && t.status !== 'submitted' && (
          <span className={`mytask-due ${isOverdue(t, now) ? 'bad' : ''}`}>{deadlineLabel(t, now)}</span>
        )}
      </div>
    </Link>
  )

  return (
    <>
      <style>{`
        .mytask-stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .mytask-stat { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 16px 20px; min-width: 160px; }
        .mytask-stat b { display: block; font-family: var(--font-exo2); font-size: 26px; color: var(--white); }
        .mytask-stat span { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); }
        .mytask-section { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); margin: 24px 0 10px; }
        .mytask-list { display: flex; flex-direction: column; gap: 8px; }
        .mytask-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 16px 20px; text-decoration: none; }
        .mytask-row:hover { border-color: rgba(219,103,39,0.35); }
        .mytask-title { color: var(--white); font-weight: 600; font-size: 14px; }
        .mytask-meta { color: var(--grey-mid); font-size: 12px; margin-top: 4px; }
        .mytask-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .mytask-badge { font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 8px; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); }
        .mytask-badge.warn { color: var(--orange); border-color: rgba(219,103,39,0.35); }
        .mytask-badge.good { color: var(--success); border-color: rgba(34,193,122,0.3); }
        .mytask-due { font-size: 12px; color: var(--off-white); }
        .mytask-due.bad { color: var(--error); }
        .mytask-empty { padding: 32px; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); font-size: 13px; }
      `}</style>
      <Header title="My tasks" description="Tasks assigned to you, their deadlines and reviews" />
      <div className="dash-content">
        <div className="mytask-stats">
          <div className="mytask-stat"><b>{profile?.total_points ?? 0}</b><span>Points</span></div>
          <div className="mytask-stat"><b>{profile?.verified_contributions ?? 0}</b><span>Verified contributions</span></div>
          <div className="mytask-stat"><b>{current.length}</b><span>Open tasks</span></div>
        </div>

        <div className="mytask-section">Current</div>
        {current.length === 0
          ? <div className="mytask-empty">Nothing assigned right now. The team will assign tasks that match the areas in your profile.</div>
          : <div className="mytask-list">{current.map((t) => <Row key={t.id} t={t} />)}</div>}

        {past.length > 0 && (
          <>
            <div className="mytask-section">Past</div>
            <div className="mytask-list">{past.map((t) => <Row key={t.id} t={t} />)}</div>
          </>
        )}
      </div>
    </>
  )
}
