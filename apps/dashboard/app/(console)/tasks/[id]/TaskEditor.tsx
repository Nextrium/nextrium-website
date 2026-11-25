'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { cancelTask, cancelTaskGroup, createAndAssignTask, createTask, createTaskForGroup, deleteTask, updateTask, updateTaskGroup } from '../actions'
import { createRecurringTask } from '../recurring/actions'
import { taskHasChanges, type TaskFormValues } from '@nextrium/contributions-core/taskInput'
import AssignmentPanel from './AssignmentPanel'
import GroupPicker from './GroupPicker'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COMPLEXITIES,
  COMPLEXITY_LABELS,
  taskDefaults,
  type Category,
  type Complexity,
} from '@nextrium/contributions-core/constants'
import { QUEUE_TABS, TASK_STATUS_LABELS } from '@nextrium/contributions-core/taskView'
import { isCategory } from '@nextrium/contributions-core/constants'
import { MAX_ATTEMPTS, type FollowUpPrefill } from '@nextrium/contributions-core/thread'
import {
  CADENCES,
  CADENCE_LABELS,
  DAY_OF_WEEK_LABELS,
  DURATION_DAYS_MAX,
  DURATION_DAYS_MIN,
  MAX_OCCURRENCES_CAP,
  dayOfWeekYmd,
  draftExpiryLabel,
  isRecurringGraceDraft,
  lagosToday,
  type Cadence,
  type EndMode,
} from '@nextrium/contributions-core/recurring'
import type { MemberSummary } from '@/lib/contributions/members'
import type { Task } from '@nextrium/supabase/database'

interface Props {
  task: Task | null
  members: MemberSummary[]
  hasSubmission: boolean
  submission?: { id: string; status: string; submissionCount: number } | null
  /** People holding a copy of this task when it is shared; 0 when it is not. */
  groupSize: number
  /** Set just after this task was created for several people. */
  sharedWith?: number | null
  /** For a shared task: progress across the copies and how many are still open. */
  group?: { label: string; open: number } | null
  /** Prefill values when spinning a follow-up task from a reviewed submission. */
  followUpPrefill?: FollowUpPrefill | null
  /** Linked source submission when editing a follow-up task. */
  sourceSubmission?: { contributionId: string; taskTitle: string; submissionTitle: string } | null
  defaultRecurring?: boolean
  isAdmin?: boolean
}

export default function TaskEditor({ task, members, hasSubmission, submission = null, groupSize, sharedWith = null, group = null, followUpPrefill = null, sourceSubmission = null, defaultRecurring = false, isAdmin = false }: Props) {
  const router = useRouter()
  const isNew = !task
  const isDraft = isNew || task.status === 'draft'
  const isClosed = task?.status === 'completed' || task?.status === 'cancelled'
  const sourceContributionId = isNew ? (followUpPrefill?.sourceContributionId ?? null) : (task.source_contribution_id ?? null)

  const initialCategory: Category = task?.category
    ?? (followUpPrefill && isCategory(followUpPrefill.category) ? followUpPrefill.category : 'technical')
  const [title, setTitle] = useState(task?.title ?? followUpPrefill?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? followUpPrefill?.description ?? '')
  const [category, setCategory] = useState<Category>(initialCategory)
  const [complexity, setComplexity] = useState<Complexity>(task?.complexity ?? 'small')
  const [links, setLinks] = useState<{ label: string; url: string }[]>(task?.links ?? [])
  const [skipAutomatedReview, setSkipAutomatedReview] = useState<boolean>(task?.skip_automated_review ?? defaultRecurring)

  // Recurring schedule options (inside the normal New Task flow).
  const today = useMemo(() => lagosToday(), [])
  const [isRecurring, setIsRecurring] = useState<boolean>(isNew && defaultRecurring)
  const [cadence, setCadence] = useState<Cadence>('weekly')
  const [startsOn, setStartsOn] = useState<string>(today)
  const [dayOfWeek, setDayOfWeek] = useState<number>(() => dayOfWeekYmd(today))
  const [dayOfMonth, setDayOfMonth] = useState<number>(() => Math.min(28, Number(today.slice(8, 10))))
  const [endMode, setEndMode] = useState<EndMode>('date')
  const [endsOn, setEndsOn] = useState<string>('')
  const [maxOccurrences, setMaxOccurrences] = useState<string>('8')
  const [durationDays, setDurationDays] = useState<string>('')

  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(sharedWith ? `Shared with ${sharedWith} people. Each has their own copy.` : null)

  // New tasks are assigned in the same pass as they are created.
  const suggestedActive = followUpPrefill?.suggestedAssigneeId
    && members.some((m) => m.active && m.userId === followUpPrefill.suggestedAssigneeId)
    ? followUpPrefill.suggestedAssigneeId
    : ''
  const [assignee, setAssignee] = useState(suggestedActive)
  const [deadline, setDeadline] = useState('')
  const [strandedDraftId, setStrandedDraftId] = useState<string | null>(null)
  // …or to several people, each getting their own copy (or unassigned drafts for recurring).
  const [mode, setMode] = useState<'one' | 'group' | 'draft'>('one')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [confirmGroup, setConfirmGroup] = useState(false)
  // Shared-task and clean-up actions, each behind its own confirmation.
  const [confirmAction, setConfirmAction] = useState<'save-all' | 'cancel-group' | 'delete' | null>(null)
  const [acting, setActing] = useState(false)
  const activeMembers = useMemo(
    () => members.filter((m) => m.active)
      .sort((a, b) => Number(b.categories.includes(category)) - Number(a.categories.includes(category)) || a.openTasks - b.openTasks),
    [members, category],
  )
  const picked = activeMembers.find((m) => m.userId === assignee) ?? null

  const current: TaskFormValues = { title, description, category, complexity, links }
  const [saved, setSaved] = useState<TaskFormValues>(current)
  const dirty = taskHasChanges(saved, current) || (!isNew && isDraft && skipAutomatedReview !== (task.skip_automated_review === true))
  const canSubmitNew = !!title.trim() && !saving && !strandedDraftId

  const defaults = taskDefaults(category, complexity)

  async function handleSave() {
    setError(null); setSuccess(null); setSaving(true)
    const input = { title, description, category, complexity, links, skipAutomatedReview }
    const res = isNew ? await createTask(input, sourceContributionId) : await updateTask(task.id, input)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    setSuccess(isNew ? 'Task created as a draft.' : 'Task saved.')
    setSaved(current)
    if (isNew && 'id' in res) router.push(`/tasks/${res.id}`)
    router.refresh()
  }

  async function handleCreateAndAssign() {
    setError(null); setSuccess(null); setSaving(true)
    const res = await createAndAssignTask({ ...current, skipAutomatedReview }, assignee, deadline ? new Date(deadline).toISOString() : null, sourceContributionId)
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

  async function handleCreateForGroup() {
    setError(null); setSuccess(null); setSaving(true)
    const res = await createTaskForGroup({ ...current, skipAutomatedReview }, groupIds, deadline ? new Date(deadline).toISOString() : null, sourceContributionId)
    setSaving(false); setConfirmGroup(false)
    if (!res.ok) {
      setError(res.error)
      // Copies may exist as drafts now; stop a second click from making more.
      setStrandedDraftId('list')
      return
    }
    if (res.assigned < res.total) {
      // Some copies stayed drafts: show who, and keep the form from making more.
      setSuccess(res.message)
      setStrandedDraftId('list')
      return
    }
    router.push(`/tasks/${res.firstId}?shared=${res.total}`)
    router.refresh()
  }

  async function handleCreateRecurring() {
    setError(null); setSuccess(null); setSaving(true)
    const assigneeIds = mode === 'one' ? (assignee ? [assignee] : []) : mode === 'group' ? groupIds : []
    const res = await createRecurringTask(current, {
      cadence,
      dayOfWeek,
      dayOfMonth,
      startsOn,
      endMode,
      endsOn: endMode === 'date' ? endsOn : null,
      maxOccurrences: endMode === 'count' ? Number(maxOccurrences) : null,
      durationDays: durationDays.trim() ? Number(durationDays) : defaults.deadlineDays,
      assignmentMode: mode,
      assigneeIds,
      skipAutomatedReview,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    router.push(`/tasks/recurring/${res.id}${res.spawnedNow > 0 ? `?spawned=${res.spawnedNow}` : ''}`)
    router.refresh()
  }

  async function handleSaveAll() {
    if (!task) return
    setError(null); setSuccess(null); setActing(true)
    const res = await updateTaskGroup(task.id, { title, description, category, complexity, links })
    setActing(false); setConfirmAction(null)
    if (!res.ok) { setError(res.error); return }
    setSuccess(res.message)
    setSaved(current)
    router.refresh()
  }

  async function handleCancelGroup() {
    if (!task) return
    setError(null); setSuccess(null); setActing(true)
    const res = await cancelTaskGroup(task.id)
    setActing(false); setConfirmAction(null)
    if (!res.ok) { setError(res.error); return }
    setSuccess(res.message)
    router.refresh()
  }

  async function handleDelete() {
    if (!task) return
    setError(null); setSuccess(null); setActing(true)
    const res = await deleteTask(task.id)
    setActing(false); setConfirmAction(null)
    if (!res.ok) { setError(res.error); return }
    router.push('/tasks')
    router.refresh()
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
  const canDelete = !isNew && isAdmin && task.status === 'cancelled' && !hasSubmission
  const canSaveAll = !isNew && !isClosed && !!group && group.open > 0

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
        isRecurring ? (
          <button
            type="button"
            className="task-btn"
            onClick={handleCreateRecurring}
            disabled={!canSubmitNew || (mode === 'one' && !assignee) || (mode === 'group' && groupIds.length < 2)}
          >
            {saving ? 'Creating…' : 'Create recurring schedule'}
          </button>
        ) : (
        <>
          <button type="button" className="task-btn ghost" onClick={handleSave} disabled={!canSubmitNew}>
            {saving ? 'Saving…' : 'Save as draft'}
          </button>
          {mode === 'one' ? (
            <button type="button" className="task-btn" onClick={handleCreateAndAssign} disabled={!canSubmitNew || !assignee}>
              {saving ? 'Creating…' : 'Create & assign'}
            </button>
          ) : (
            <button type="button" className="task-btn" onClick={() => setConfirmGroup(true)} disabled={!canSubmitNew || groupIds.length < 2 || confirmGroup}>
              {groupIds.length < 2 ? 'Choose 2 or more people' : `Create for ${groupIds.length} people`}
            </button>
          )}
        </>
        )
      ) : !isClosed && (
        <button type="button" className="task-btn" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : groupSize > 0 ? 'Save this copy' : 'Save changes'}
        </button>
      )}
      {canSaveAll && confirmAction !== 'save-all' && (
        <button type="button" className="task-btn" onClick={() => setConfirmAction('save-all')} disabled={saving || acting || !dirty}>Save to all copies</button>
      )}
      {canSaveAll && confirmAction === 'save-all' && (
        <>
          <span className="task-hint-strong">Save this brief to {group!.open} cop{group!.open === 1 ? 'y' : 'ies'} not yet submitted?</span>
          <button type="button" className="task-btn" onClick={handleSaveAll} disabled={acting}>{acting ? 'Saving…' : 'Yes, save all'}</button>
          <button type="button" className="task-btn ghost" onClick={() => setConfirmAction(null)} disabled={acting}>Back</button>
        </>
      )}
      {canDelete && confirmAction !== 'delete' && (
        <button type="button" className="task-btn danger" onClick={() => setConfirmAction('delete')}>Delete task</button>
      )}
      {canDelete && confirmAction === 'delete' && (
        <>
          <span className="task-hint-strong">Delete this cancelled task for good?</span>
          <button type="button" className="task-btn danger" onClick={handleDelete} disabled={acting}>{acting ? 'Deleting…' : 'Yes, delete'}</button>
          <button type="button" className="task-btn ghost" onClick={() => setConfirmAction(null)} disabled={acting}>Keep</button>
        </>
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
        .group-mode, .group-areas { display: flex; flex-wrap: wrap; gap: 6px; }
        .group-chip { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 6px 10px; background: none; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); cursor: pointer; }
        .group-chip.on { border-color: var(--orange); color: var(--orange-w); }
        .group-chip:focus-visible, .group-person:focus-within { outline: 1px solid var(--orange); outline-offset: 1px; }
        .group-list { display: flex; flex-direction: column; max-height: 280px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.08); }
        .group-person { display: grid; grid-template-columns: auto 1fr; column-gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .group-person:last-child { border-bottom: none; }
        .group-person.on { background: color-mix(in srgb, var(--orange) 8%, transparent); }
        .group-person input { grid-row: span 2; accent-color: var(--orange); }
        .group-name { font-size: 13px; color: var(--off-white); }
        .group-meta { font-size: 11px; color: var(--grey-mid); }
        .group-note { font-size: 11px; color: var(--grey-mid); }
        .group-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .group-confirm { display: flex; flex-direction: column; gap: 10px; padding: 12px; font-size: 12px; color: var(--off-white); border: 1px solid color-mix(in srgb, var(--orange) 40%, transparent); background: color-mix(in srgb, var(--orange) 6%, transparent); }
        .task-hint-strong { font-size: 12px; color: var(--off-white); }
        .task-alert.info { background: color-mix(in srgb, var(--orange) 6%, transparent); border-color: color-mix(in srgb, var(--orange) 30%, transparent); color: var(--off-white); }
        @media (max-width: 1100px) { .task-layout { grid-template-columns: 1fr; } .task-side { position: static; } }
      `}</style>

      <Header
        title={isNew ? 'New task' : 'Edit task'}
        description={isNew ? 'Create a contributor task' : TASK_STATUS_LABELS[task.status]}
        action={ActionButtons}
      />

      <div className="dash-content">
        {error && <div className="task-alert error">{error}</div>}
        {success && <div className="task-alert success" role="status">{success}</div>}
        {!isNew && groupSize > 0 && (
          <div className="task-alert info">
            Shared task: this is one of {groupSize} copies, one per person.{!isClosed && ' “Save this copy” changes only this one; “Save to all copies” updates every copy not yet submitted.'}{' '}
            <a href={`/tasks?group=${task.group_id}`} style={{ color: 'var(--orange-w)' }}>See all copies</a>
          </div>
        )}
        {isNew && followUpPrefill && (
          <div className="task-alert info">
            Follow-up task linked to <strong>{followUpPrefill.sourceTaskTitle}</strong> ({followUpPrefill.sourceSubmissionTitle}). You can edit any field before saving.{' '}
            <a href={`/reviews/${followUpPrefill.sourceContributionId}`} style={{ color: 'var(--orange-w)' }}>View original submission</a>
          </div>
        )}
        {!isNew && sourceSubmission && (
          <div className="task-alert info">
            Originated from <strong>{sourceSubmission.taskTitle}</strong> ({sourceSubmission.submissionTitle}).{' '}
            <a href={`/reviews/${sourceSubmission.contributionId}`} style={{ color: 'var(--orange-w)' }}>View original submission</a>
          </div>
        )}
        {!isNew && task.recurring_task_id && (
          <div className="task-alert info">
            Spawned from a recurring schedule{task.occurrence_date ? ` (${task.occurrence_date})` : ''}. Does not count against the member&apos;s open-task limit.{' '}
            <a href={`/tasks/recurring/${task.recurring_task_id}`} style={{ color: 'var(--orange-w)' }}>View schedule</a>
          </div>
        )}
        {!isNew && isRecurringGraceDraft(task) && !hasSubmission && (
          <div className="task-alert error">
            Saved as draft (3-day window) · {draftExpiryLabel(task.expires_at)}. This unsubmitted recurring cycle will be automatically deleted unless submitted before the window closes.
          </div>
        )}

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
              <div className="task-kv"><span>Deadline</span><span>{isRecurring && durationDays.trim() ? `${durationDays} day(s) per cycle` : `${defaults.deadlineDays} days after assignment`}</span></div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: isDraft ? 'pointer' : 'default', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={skipAutomatedReview}
                  disabled={!isDraft}
                  onChange={(e) => setSkipAutomatedReview(e.target.checked)}
                  style={{ marginTop: 3, accentColor: 'var(--orange)' }}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--off-white)', fontWeight: 500 }}>Direct team review (skip AI check)</span>
                  <span style={{ fontSize: 11.5, color: 'var(--grey-mid)', lineHeight: 1.45 }}>
                    Skips automated review to save tokens and sends submissions straight to human review. Link becomes optional and minimum note is 10 words.
                  </span>
                </span>
              </label>
            </div>

            {isNew && (
              <div className="task-panel">
                <div className="task-panel-title">Schedule</div>
                <div className="group-mode" role="group" aria-label="Task schedule type">
                  <button
                    type="button"
                    className={`group-chip${!isRecurring ? ' on' : ''}`}
                    aria-pressed={!isRecurring}
                    onClick={() => {
                      setIsRecurring(false)
                      if (mode === 'draft') setMode('one')
                    }}
                  >
                    One-time task
                  </button>
                  <button
                    type="button"
                    className={`group-chip${isRecurring ? ' on' : ''}`}
                    aria-pressed={isRecurring}
                    onClick={() => {
                      setIsRecurring(true)
                      setSkipAutomatedReview(true)
                    }}
                  >
                    Recurring task
                  </button>
                </div>

                {isRecurring && (
                  <>
                    <div className="task-field">
                      <label className="task-label" htmlFor="rec-cadence">Repeats</label>
                      <select id="rec-cadence" className="task-select" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
                        {CADENCES.map((c) => <option key={c} value={c}>{CADENCE_LABELS[c]}</option>)}
                      </select>
                    </div>

                    {(cadence === 'weekly' || cadence === 'biweekly') && (
                      <div className="task-field">
                        <label className="task-label" htmlFor="rec-dow">Day of week</label>
                        <select id="rec-dow" className="task-select" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                          {DAY_OF_WEEK_LABELS.map((label, idx) => <option key={label} value={idx}>{label}</option>)}
                        </select>
                      </div>
                    )}

                    {cadence === 'monthly' && (
                      <div className="task-field">
                        <label className="task-label" htmlFor="rec-dom">Day of month (1–28)</label>
                        <input id="rec-dom" type="number" min={1} max={28} className="task-input" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
                      </div>
                    )}

                    <div className="task-field">
                      <label className="task-label" htmlFor="rec-start">Start date</label>
                      <input id="rec-start" type="date" className="task-input" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
                      <span style={{ fontSize: 11.5, color: 'var(--grey-mid)' }}>If today ({today}), Cycle 1 is created immediately on save.</span>
                    </div>

                    <div className="task-field">
                      <label className="task-label" htmlFor="rec-end-mode">Duration / end</label>
                      <select id="rec-end-mode" className="task-select" value={endMode} onChange={(e) => setEndMode(e.target.value as EndMode)}>
                        <option value="date">Until end date</option>
                        <option value="count">After a set number of cycles</option>
                        <option value="never">Ongoing until paused</option>
                      </select>
                    </div>

                    {endMode === 'date' && (
                      <div className="task-field">
                        <label className="task-label" htmlFor="rec-end-date">End date</label>
                        <input id="rec-end-date" type="date" min={startsOn} className="task-input" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                      </div>
                    )}

                    {endMode === 'count' && (
                      <div className="task-field">
                        <label className="task-label" htmlFor="rec-max">Total cycles (1–{MAX_OCCURRENCES_CAP})</label>
                        <input id="rec-max" type="number" min={1} max={MAX_OCCURRENCES_CAP} className="task-input" value={maxOccurrences} onChange={(e) => setMaxOccurrences(e.target.value)} />
                      </div>
                    )}

                    <div className="task-field">
                      <label className="task-label" htmlFor="rec-duration">Deadline window per cycle (days)</label>
                      <input
                        id="rec-duration"
                        type="number"
                        min={DURATION_DAYS_MIN}
                        max={DURATION_DAYS_MAX}
                        className="task-input"
                        placeholder={String(defaults.deadlineDays)}
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                      />
                      <span style={{ fontSize: 11.5, color: 'var(--grey-mid)', lineHeight: 1.45 }}>
                        e.g. 1 day for a weekly call, 5 days for weekly coordination. Leave blank for {defaults.deadlineDays} days.
                      </span>
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--grey-mid)', lineHeight: 1.5, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      Recurring tasks do not count against a member&apos;s max task load. Unsubmitted cycles get a 24h reminder, move to a 3-day draft for both sides, and auto-delete if still unsubmitted. Points always require manual review.
                    </div>
                  </>
                )}
              </div>
            )}

            {isNew && (
              <div className="task-panel">
                <div className="task-panel-title">Assignment</div>
                <div className="group-mode" role="group" aria-label="Who is this task for">
                  <button type="button" className={`group-chip${mode === 'one' ? ' on' : ''}`} aria-pressed={mode === 'one'} onClick={() => { setMode('one'); setConfirmGroup(false) }}>One person</button>
                  <button type="button" className={`group-chip${mode === 'group' ? ' on' : ''}`} aria-pressed={mode === 'group'} onClick={() => setMode('group')}>Several people</button>
                  {isRecurring && (
                    <button type="button" className={`group-chip${mode === 'draft' ? ' on' : ''}`} aria-pressed={mode === 'draft'} onClick={() => { setMode('draft'); setConfirmGroup(false) }}>Unassigned draft</button>
                  )}
                </div>
                {mode === 'draft' ? (
                  <span style={{ fontSize: 12, color: 'var(--grey-mid)', lineHeight: 1.5 }}>
                    Each cycle will be created as a draft so staff can assign it manually when ready.
                  </span>
                ) : mode === 'group' ? (
                  <>
                    <GroupPicker members={activeMembers} category={category} selected={groupIds} onChange={(ids) => { setGroupIds(ids); setConfirmGroup(false) }} />
                    <span className="group-note">Each person gets their own copy and submits on their own. Everyone has the same deadline.</span>
                  </>
                ) : (
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
                )}
                {!isRecurring && (
                  <div className="task-field">
                    <label className="task-label" htmlFor="new-task-deadline">Custom deadline (optional)</label>
                    <input id="new-task-deadline" type="datetime-local" className="task-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                    <span className="task-hint">Leave empty for {defaults.deadlineDays} days from assignment.</span>
                  </div>
                )}
                {!isRecurring && mode === 'group' && confirmGroup && (
                  <div className="group-confirm" role="alertdialog" aria-label="Confirm">
                    <span>Create {groupIds.length} copies of this task and email {groupIds.length} people?</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="task-btn" onClick={handleCreateForGroup} disabled={saving}>{saving ? 'Creating…' : 'Yes, create'}</button>
                      <button type="button" className="task-btn ghost" onClick={() => setConfirmGroup(false)} disabled={saving}>Back</button>
                    </span>
                  </div>
                )}
                {strandedDraftId && (
                  <a className="task-btn ghost" href={strandedDraftId === 'list' ? '/tasks?status=draft' : `/tasks/${strandedDraftId}`} style={{ textDecoration: 'none', width: 'fit-content' }}>
                    {strandedDraftId === 'list' ? 'Open the drafts' : 'Open the draft to assign it'}
                  </a>
                )}
              </div>
            )}
            {!isNew && group && (
              <div className="task-panel">
                <div className="task-panel-title">Shared task</div>
                <div className="task-kv"><span>Progress</span><span>{group.label}</span></div>
                <a href={`/tasks?group=${task.group_id}`} className="task-btn ghost" style={{ textDecoration: 'none', width: 'fit-content' }}>See all copies</a>
                {group.open > 0 && (confirmAction === 'cancel-group' ? (
                  <div className="group-confirm" role="alertdialog" aria-label="Confirm">
                    <span>Cancel the {group.open} cop{group.open === 1 ? 'y' : 'ies'} nobody has submitted yet? Copies with a submission carry on through review.</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="task-btn danger" onClick={handleCancelGroup} disabled={acting}>{acting ? 'Cancelling…' : 'Yes, cancel them'}</button>
                      <button type="button" className="task-btn ghost" onClick={() => setConfirmAction(null)} disabled={acting}>Keep</button>
                    </span>
                  </div>
                ) : (
                  <button type="button" className="task-btn danger" style={{ width: 'fit-content' }} onClick={() => setConfirmAction('cancel-group')}>Cancel whole group</button>
                ))}
              </div>
            )}
            {!isNew && submission && (
              <div className="task-panel">
                <div className="task-panel-title">Submission &amp; conversation</div>
                <div className="task-kv">
                  <span>Status</span>
                  <span>{QUEUE_TABS.find((t) => t.key === submission.status)?.label ?? submission.status}</span>
                </div>
                <div className="task-kv">
                  <span>Attempt</span>
                  <span>{submission.submissionCount} of {MAX_ATTEMPTS}</span>
                </div>
                <a href={`/reviews/${submission.id}`} className="task-btn" style={{ textDecoration: 'none', width: 'fit-content' }}>
                  Open review &amp; thread →
                </a>
              </div>
            )}
            {!isNew && !isClosed && <AssignmentPanel task={task} members={members} hasSubmission={hasSubmission} groupSize={groupSize} />}
            {!isNew && members.length === 0 && (
              <div className="task-panel"><span className="task-hint">No members yet. Invite people from Applications → Invite to Team.</span></div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
