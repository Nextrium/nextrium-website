'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignDraftToGroup, assignTask, decideExtension, unassignTask } from '../actions'
import GroupPicker from './GroupPicker'
import { CATEGORY_LABELS, EXTENSION_DAYS } from '@nextrium/contributions-core/constants'
import { deadlineLabel, effectiveDeadline } from '@nextrium/contributions-core/taskView'
import type { MemberSummary } from '@/lib/contributions/members'
import type { Task } from '@nextrium/supabase/database'

interface Props {
  task: Task
  members: MemberSummary[]
  hasSubmission: boolean
  /** People holding a copy of this task when it is shared; 0 when it is not. */
  groupSize: number
}

function fmt(date: Date | null): string {
  return date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

export default function AssignmentPanel({ task, members, hasSubmission, groupSize }: Props) {
  const router = useRouter()
  const active = useMemo(
    () => members.filter((m) => m.active)
      // members whose categories include this task's category first, then least busy
      .sort((a, b) => Number(b.categories.includes(task.category)) - Number(a.categories.includes(task.category)) || a.openTasks - b.openTasks),
    [members, task.category],
  )
  const assignee = members.find((m) => m.userId === task.assigned_to) ?? null

  const [pick, setPick] = useState(task.assigned_to ?? '')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // A draft that isn't shared yet can go to several people instead.
  const [mode, setMode] = useState<'one' | 'group'>('one')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [confirmGroup, setConfirmGroup] = useState(false)
  const canShare = !hasSubmission && task.status === 'draft' && !task.group_id

  const canAssign = !hasSubmission && (task.status === 'draft' || task.status === 'assigned')
  const picked = active.find((m) => m.userId === pick) ?? null

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null); setNotice(null); setBusy(label)
    const res = await fn()
    setBusy(null)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    router.refresh()
  }

  async function share() {
    setError(null); setNotice(null); setBusy('share')
    const res = await assignDraftToGroup(task.id, groupIds, deadline ? new Date(deadline).toISOString() : null)
    setBusy(null); setConfirmGroup(false)
    if (!res.ok) { setError(res.error); router.refresh(); return }
    setNotice(res.message)
    setMode('one'); setGroupIds([])
    router.refresh()
  }

  return (
    <div className="task-panel">
      <div className="task-panel-title">Assignment</div>
      {error && <div className="task-alert error" style={{ marginBottom: 0 }}>{error}</div>}
      {notice && <div className="task-alert success" role="status" style={{ marginBottom: 0 }}>{notice}</div>}
      {groupSize > 0 && <span className="group-note">One of {groupSize} copies of a shared task.</span>}

      {assignee && (
        <>
          <div className="task-kv"><span>Assignee</span><span>{assignee.name}</span></div>
          <div className="task-kv"><span>Deadline</span><span>{fmt(effectiveDeadline(task))}</span></div>
          <div className="task-kv"><span>Time left</span><span>{deadlineLabel(task)}</span></div>
        </>
      )}

      {task.extension_status === 'requested' && (
        <div className="task-field">
          <span className="task-label">Extension requested</span>
          <span className="task-hint">“{task.extension_reason || 'No reason given'}” · adds {EXTENSION_DAYS[task.complexity]} day(s)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="task-btn" disabled={!!busy}
              onClick={() => run('grant', () => decideExtension(task.id, true))}>{busy === 'grant' ? 'Granting…' : 'Grant'}</button>
            <button type="button" className="task-btn danger" disabled={!!busy}
              onClick={() => run('deny', () => decideExtension(task.id, false))}>{busy === 'deny' ? 'Denying…' : 'Deny'}</button>
          </div>
        </div>
      )}
      {task.extension_status === 'granted' && <span className="task-hint">Extension granted.</span>}
      {task.extension_status === 'denied' && <span className="task-hint">Extension denied.</span>}

      {canShare && (
        <div className="group-mode" role="group" aria-label="Who is this task for">
          <button type="button" className={`group-chip${mode === 'one' ? ' on' : ''}`} aria-pressed={mode === 'one'} onClick={() => { setMode('one'); setConfirmGroup(false) }}>One person</button>
          <button type="button" className={`group-chip${mode === 'group' ? ' on' : ''}`} aria-pressed={mode === 'group'} onClick={() => setMode('group')}>Several people</button>
        </div>
      )}

      {canShare && mode === 'group' && (
        <>
          <GroupPicker members={active} category={task.category} selected={groupIds} onChange={(ids) => { setGroupIds(ids); setConfirmGroup(false) }} />
          <div className="task-field">
            <label className="task-label" htmlFor="group-deadline">Deadline for everyone (optional)</label>
            <input id="group-deadline" type="datetime-local" className="task-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <span className="group-note">Leave empty for {task.deadline_days} days from now. Each person gets their own copy and submits on their own.</span>
          </div>
          {confirmGroup ? (
            <div className="group-confirm" role="alertdialog" aria-label="Confirm">
              <span>Give this task to {groupIds.length} people? That makes {groupIds.length} copies and emails {groupIds.length} people.</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="task-btn" disabled={!!busy} onClick={share}>{busy === 'share' ? 'Assigning…' : 'Yes, assign'}</button>
                <button type="button" className="task-btn ghost" disabled={!!busy} onClick={() => setConfirmGroup(false)}>Back</button>
              </span>
            </div>
          ) : (
            <button type="button" className="task-btn" style={{ width: 'fit-content' }} disabled={groupIds.length < 2 || !!busy} onClick={() => setConfirmGroup(true)}>
              {groupIds.length < 2 ? 'Choose 2 or more people' : `Assign to ${groupIds.length} people`}
            </button>
          )}
        </>
      )}

      {canAssign && !(canShare && mode === 'group') && (
        <>
          <div className="task-field">
            <label className="task-label" htmlFor="task-assignee">{assignee ? 'Reassign to' : 'Assign to'}</label>
            <select id="task-assignee" className="task-select" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose a member…</option>
              {active.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} · {m.openTasks} open{m.categories.includes(task.category) ? ' · ✓ ' + CATEGORY_LABELS[task.category] : ''}
                </option>
              ))}
            </select>
            {active.length === 0 && <span className="task-hint">No active members. Members appear once they finish onboarding.</span>}
            {picked && (picked.skills.length > 0 || picked.categories.length > 0) && (
              <span className="task-hint">
                {picked.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}{picked.skills.length ? ` · ${picked.skills.join(', ')}` : ''}
              </span>
            )}
          </div>
          <div className="task-field">
            <label className="task-label" htmlFor="task-deadline">Custom deadline (optional)</label>
            <input id="task-deadline" type="datetime-local" className="task-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            <span className="task-hint">Leave empty for {task.deadline_days} days from assignment.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="task-btn" disabled={!pick || !!busy || pick === task.assigned_to}
              onClick={() => run('assign', () => assignTask(task.id, pick, deadline ? new Date(deadline).toISOString() : null))}>
              {busy === 'assign' ? 'Assigning…' : assignee ? 'Reassign' : 'Assign'}
            </button>
            {task.status === 'assigned' && (
              <button type="button" className="task-btn ghost" disabled={!!busy}
                onClick={() => run('unassign', () => unassignTask(task.id))}>{busy === 'unassign' ? 'Unassigning…' : 'Unassign'}</button>
            )}
          </div>
        </>
      )}
      {hasSubmission && <span className="task-hint">This task has a submission, so the assignee can no longer change.</span>}
    </div>
  )
}
