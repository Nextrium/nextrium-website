'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { cancelTask, createAndAssignTask, createTask, updateTask } from '../actions'
import { taskHasChanges, type TaskFormValues } from '@nextrium/contributions-core/taskInput'
import AssignmentPanel from './AssignmentPanel'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COMPLEXITIES,
  COMPLEXITY_LABELS,
  taskDefaults,
  type Category,
  type Complexity,
} from '@nextrium/contributions-core/constants'
import { TASK_STATUS_LABELS } from '@nextrium/contributions-core/taskView'
import type { MemberSummary } from '@/lib/contributions/members'
import type { Task } from '@nextrium/supabase/database'

interface Props {
  task: Task | null
  members: MemberSummary[]
  hasSubmission: boolean
}

export default function TaskEditor({ task, members, hasSubmission }: Props) {
  const router = useRouter()
  const isNew = !task
  const isDraft = isNew || task.status === 'draft'
  const isClosed = task?.status === 'completed' || task?.status === 'cancelled'

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [category, setCategory] = useState<Category>(task?.category ?? 'technical')
  const [complexity, setComplexity] = useState<Complexity>(task?.complexity ?? 'small')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(task?.links ?? [])

  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // New tasks are assigned in the same pass as they are created.
  const [assignee, setAssignee] = useState('')
  const [deadline, setDeadline] = useState('')
  const [strandedDraftId, setStrandedDraftId] = useState<string | null>(null)
  const activeMembers = useMemo(
    () => members.filter((m) => m.active)
      .sort((a, b) => Number(b.categories.includes(category)) - Number(a.categories.includes(category)) || a.openTasks - b.openTasks),
    [members, category],
  )
  const picked = activeMembers.find((m) => m.userId === assignee) ?? null

  const current: TaskFormValues = { title, description, category, complexity, links }
  const [saved, setSaved] = useState<TaskFormValues>(current)
  const dirty = taskHasChanges(saved, current)
  const canSubmitNew = !!title.trim() && !saving && !strandedDraftId

  const defaults = taskDefaults(category, complexity)

  async function handleSave() {
    setError(null); setSuccess(null); setSaving(true)
    const input = { title, description, category, complexity, links }
    const res = isNew ? await createTask(input) : await updateTask(task.id, input)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    setSuccess(isNew ? 'Task created as a draft.' : 'Task saved.')
    setSaved(current)
    if (isNew && 'id' in res) router.push(`/tasks/${res.id}`)
    router.refresh()
  }

  async function handleCreateAndAssign() {
    setError(null); setSuccess(null); setSaving(true)
    const res = await createAndAssignTask(current, assignee, deadline ? new Date(deadline).toISOString() : null)
    setSaving(false)
    if (res.ok) {
      router.push(`/tasks/${res.id}`)
      router.refresh()
      return
    }
    setError(res.error)
    // The task now exists as a draft; stop a second click from creating another.
    if ('draftId' in res) setStrandedDraftId(res.draftId)
  }

  async function handleCancel() {
    if (!task) return
    setError(null); setCancelling(true)
    const res = await cancelTask(task.id)
    setCancelling(false); setConfirmCancel(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  const canCancel = !isNew && !hasSubmission && (task.status === 'draft' || task.status === 'assigned')

  const ActionButtons = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {canCancel && !confirmCancel && (
        <button type="button" className="task-btn danger" onClick={() => setConfirmCancel(true)}>Cancel task</button>
      )}
      {confirmCancel && (
        <>
          <span className="task-hint">Cancel this task?</span>
          <button type="button" className="task-btn danger" onClick={handleCancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Yes, cancel'}</button>
          <button type="button" className="task-btn ghost" onClick={() => setConfirmCancel(false)}>Keep</button>
        </>
      )}
      {isNew ? (
        <>
          <button type="button" className="task-btn ghost" onClick={handleSave} disabled={!canSubmitNew}>
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
          <button type="button" className="task-btn" onClick={handleCreateAndAssign} disabled={!canSubmitNew || !assignee}>
            {saving ? 'Creating…' : 'Create & assign'}
          </button>
        </>
      ) : !isClosed && (
        <button type="button" className="task-btn" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        .task-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
        .task-main { display: flex; flex-direction: column; gap: 20px; }
        .task-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
        .task-field { display: flex; flex-direction: column; gap: 8px; }
        .task-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); }
        .task-hint { font-size: 11px; color: var(--grey-dark); }
        .task-input, .task-select { background: var(--navy); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 14px; padding: 10px 14px; outline: none; width: 100%; }
        .task-input:focus, .task-select:focus { border-color: var(--orange); }
        .task-select:disabled { opacity: 0.6; cursor: not-allowed; }
        .task-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
        .task-panel-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .task-kv { display: flex; justify-content: space-between; font-size: 13px; color: var(--off-white); }
        .task-kv span:first-child { color: var(--grey-mid); }
        .task-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 8px 18px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; }
        .task-btn:disabled { opacity: 0.6; cursor: default; }
        .task-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .task-btn.danger { background: none; border-color: color-mix(in srgb, var(--error) 35%, transparent); color: var(--error); }
        .task-link-row { display: grid; grid-template-columns: 1fr 2fr auto; gap: 8px; }
        .task-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 8px; }
        .task-alert.error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
        .task-alert.success { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
        @media (max-width: 1100px) { .task-layout { grid-template-columns: 1fr; } .task-side { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New task' : 'Edit task'}
        description={isNew ? 'Create a contributor task' : TASK_STATUS_LABELS[task.status]}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error && <div className="task-alert error">{error}</div>}
        {success && <div className="task-alert success">{success}</div>}

        <div className="task-layout">
          <div className="task-main">
            <div className="task-field">
              <label className="task-label" htmlFor="task-title">Title</label>
              <input id="task-title" className="task-input" value={title} maxLength={200} disabled={isClosed}
                onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Build the events calendar page"
                style={{ fontSize: '20px', fontFamily: 'var(--font-exo2)', fontWeight: 700 }} />
            </div>

            <div className="task-field">
              <span className="task-label">Brief</span>
              <span className="task-hint">What the member should deliver and what good looks like. Shown to the assignee and used by the review.</span>
              <RichTextEditor content={description} onChange={setDescription} imageFolder="tasks" />
            </div>

            <div className="task-field">
              <span className="task-label">Links</span>
              {links.map((l, i) => (
                <div className="task-link-row" key={i}>
                  <input className="task-input" placeholder="Label" value={l.label} disabled={isClosed}
                    onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input className="task-input" placeholder="https://" value={l.url} disabled={isClosed}
                    onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                  {!isClosed && <button type="button" className="task-btn ghost" onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</button>}
                </div>
              ))}
              {!isClosed && links.length < 10 && (
                <button type="button" className="task-btn ghost" style={{ width: 'fit-content' }}
                  onClick={() => setLinks([...links, { label: '', url: '' }])}>+ Add link</button>
              )}
            </div>
          </div>

          <div className="task-side">
            <div className="task-panel">
              <div className="task-panel-title">Scope</div>
              <div className="task-field">
                <label className="task-label" htmlFor="task-category">Category</label>
                <select id="task-category" className="task-select" value={category} disabled={!isDraft}
                  onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="task-field">
                <label className="task-label" htmlFor="task-complexity">Complexity</label>
                <select id="task-complexity" className="task-select" value={complexity} disabled={!isDraft}
                  onChange={(e) => setComplexity(e.target.value as Complexity)}>
                  {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
                </select>
              </div>
              {!isDraft && !isClosed && <span className="task-hint">Category and complexity set the points, so they are fixed once a task is assigned. Unassign it to return it to draft and change them.</span>}
              <div className="task-kv"><span>Points</span><span>{defaults.pointRangeMin}–{defaults.pointRangeMax}</span></div>
              <div className="task-kv"><span>Deadline</span><span>{defaults.deadlineDays} days after assignment</span></div>
            </div>

            {isNew && (
              <div className="task-panel">
                <div className="task-panel-title">Assignment</div>
                <div className="task-field">
                  <label className="task-label" htmlFor="new-task-assignee">Assign to</label>
                  <select id="new-task-assignee" className="task-select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Choose a member…</option>
                    {activeMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} · {m.openTasks} open{m.categories.includes(category) ? ' · ✓ ' + CATEGORY_LABELS[category] : ''}
                      </option>
                    ))}
                  </select>
                  {activeMembers.length === 0 && <span className="task-hint">No active members yet. Members appear once they finish onboarding.</span>}
                  {picked && (picked.skills.length > 0 || picked.categories.length > 0) && (
                    <span className="task-hint">
                      {picked.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}{picked.skills.length ? ` · ${picked.skills.join(', ')}` : ''}
                    </span>
                  )}
                </div>
                <div className="task-field">
                  <label className="task-label" htmlFor="new-task-deadline">Custom deadline (optional)</label>
                  <input id="new-task-deadline" type="datetime-local" className="task-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  <span className="task-hint">Leave empty for {defaults.deadlineDays} days from assignment.</span>
                </div>
                {strandedDraftId && (
                  <a className="task-btn ghost" href={`/tasks/${strandedDraftId}`} style={{ textDecoration: 'none', width: 'fit-content' }}>Open the draft to assign it</a>
                )}
              </div>
            )}
            {!isNew && !isClosed && <AssignmentPanel task={task} members={members} hasSubmission={hasSubmission} />}
            {!isNew && members.length === 0 && (
              <div className="task-panel"><span className="task-hint">No members yet. Invite people from Applications → Invite to Team.</span></div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
