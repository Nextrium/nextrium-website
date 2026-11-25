'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/dashboard/Header'
import RichTextEditor from '@/components/editor/RichTextEditor'
import GroupPicker from '../[id]/GroupPicker'
import { setRecurringStatus, triggerNextRecurringCycle, updateRecurringTask } from './actions'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COMPLEXITIES,
  COMPLEXITY_LABELS,
  taskDefaults,
  type Category,
  type Complexity,
} from '@nextrium/contributions-core/constants'
import {
  CADENCES,
  CADENCE_LABELS,
  DAY_OF_WEEK_LABELS,
  DURATION_DAYS_MAX,
  DURATION_DAYS_MIN,
  MAX_OCCURRENCES_CAP,
  describeSchedule,
  type Cadence,
  type EndMode,
  type RecurringAssignmentMode,
} from '@nextrium/contributions-core/recurring'
import { TASK_STATUS_LABELS } from '@nextrium/contributions-core/taskView'
import type { MemberSummary } from '@/lib/contributions/members'
import type { RecurringTask, RecurringTaskRun, Task } from '@nextrium/supabase/database'

interface Props {
  schedule: RecurringTask
  members: MemberSummary[]
  spawnedTasks: Pick<Task, 'id' | 'title' | 'status' | 'assigned_to' | 'occurrence_date' | 'deadline_at' | 'grace_draft_at' | 'expires_at'>[]
  runs: RecurringTaskRun[]
  justSpawned?: number | null
}

export default function RecurringScheduleEditor({ schedule, members, spawnedTasks, runs, justSpawned = null }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(schedule.title)
  const [description, setDescription] = useState(schedule.description)
  const [category, setCategory] = useState<Category>(schedule.category)
  const [complexity, setComplexity] = useState<Complexity>(schedule.complexity)
  const [links, setLinks] = useState<{ label: string; url: string }[]>(schedule.links ?? [])
  const [skipAutomatedReview, setSkipAutomatedReview] = useState<boolean>(schedule.skip_automated_review)

  const [cadence, setCadence] = useState<Cadence>(schedule.cadence)
  const [dayOfWeek, setDayOfWeek] = useState<number>(schedule.day_of_week ?? 1)
  const [dayOfMonth, setDayOfMonth] = useState<number>(schedule.day_of_month ?? 1)
  const [startsOn, setStartsOn] = useState<string>(schedule.starts_on)
  const [endMode, setEndMode] = useState<EndMode>(
    schedule.ends_on ? 'date' : schedule.max_occurrences !== null ? 'count' : 'never',
  )
  const [endsOn, setEndsOn] = useState<string>(schedule.ends_on ?? '')
  const [maxOccurrences, setMaxOccurrences] = useState<string>(String(schedule.max_occurrences ?? 8))
  const [durationDays, setDurationDays] = useState<string>(String(schedule.duration_days))

  const [assignmentMode, setAssignmentMode] = useState<RecurringAssignmentMode>(schedule.assignment_mode)
  const [assignee, setAssignee] = useState<string>(schedule.assignment_mode === 'one' ? (schedule.assignee_ids[0] ?? '') : '')
  const [groupIds, setGroupIds] = useState<string[]>(schedule.assignment_mode === 'group' ? schedule.assignee_ids : [])

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(
    justSpawned ? `Recurring schedule created and Cycle 1 (${justSpawned} task${justSpawned === 1 ? '' : 's'}) launched immediately.` : null,
  )

  const activeMembers = useMemo(
    () => members.filter((m) => m.active).sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  )
  const nameOf = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members])
  const defaults = taskDefaults(category, complexity)

  async function handleSave() {
    setBusy('save'); setError(null); setSuccess(null)
    const assigneeIds = assignmentMode === 'one' ? (assignee ? [assignee] : []) : assignmentMode === 'group' ? groupIds : []
    const res = await updateRecurringTask(
      schedule.id,
      { title, description, category, complexity, links },
      {
        cadence,
        dayOfWeek,
        dayOfMonth,
        startsOn,
        endMode,
        endsOn: endMode === 'date' ? endsOn : null,
        maxOccurrences: endMode === 'count' ? Number(maxOccurrences) : null,
        durationDays: Number(durationDays),
        assignmentMode,
        assigneeIds,
        skipAutomatedReview,
      },
    )
    setBusy(null)
    if (!res.ok) { setError(res.error); return }
    setSuccess('Schedule updated for future cycles.')
    router.refresh()
  }

  async function handleStatus(next: 'active' | 'paused' | 'completed') {
    setBusy(next); setError(null); setSuccess(null)
    const res = await setRecurringStatus(schedule.id, next)
    setBusy(null)
    if (!res.ok) { setError(res.error); return }
    setSuccess(next === 'paused' ? 'Schedule paused.' : next === 'active' ? 'Schedule resumed.' : 'Schedule ended.')
    router.refresh()
  }

  async function handleSpawnNow() {
    setBusy('spawn'); setError(null); setSuccess(null)
    const res = await triggerNextRecurringCycle(schedule.id)
    setBusy(null)
    if (!res.ok) { setError(res.error); return }
    setSuccess(`Created ${res.count} task${res.count === 1 ? '' : 's'} for the next cycle.`)
    router.refresh()
  }

  return (
    <>
      <style>{`
        .rs-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
        .rs-main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
        .rs-side { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; min-width: 0; }
        .rs-panel { background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .rs-title { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--grey-mid); padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .rs-field { display: flex; flex-direction: column; gap: 6px; }
        .rs-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--grey-mid); }
        .rs-hint { font-size: 12px; color: var(--grey-mid); line-height: 1.5; }
        .rs-input, .rs-select { background: var(--navy-mid, #0b1a2e); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-family: var(--font-dm); font-size: 13px; padding: 10px 12px; outline: none; width: 100%; }
        .rs-input:focus, .rs-select:focus { border-color: var(--orange); }
        .rs-btn { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 9px 16px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; min-height: 38px; }
        .rs-btn:disabled { opacity: 0.6; cursor: default; }
        .rs-btn.ghost { background: none; border-color: rgba(255,255,255,0.12); color: var(--grey-mid); }
        .rs-btn.danger { background: none; border-color: color-mix(in srgb, var(--error) 35%, transparent); color: var(--error); }
        .rs-kv { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 13px; color: var(--off-white); }
        .rs-kv span:first-child { color: var(--grey-mid); }
        .rs-alert { padding: 10px 14px; font-size: 12px; border: 1px solid; margin-bottom: 12px; }
        .rs-alert.error { background: color-mix(in srgb, var(--error) 8%, transparent); border-color: color-mix(in srgb, var(--error) 30%, transparent); color: var(--error); }
        .rs-alert.success { background: color-mix(in srgb, var(--success) 8%, transparent); border-color: color-mix(in srgb, var(--success) 30%, transparent); color: var(--success); }
        .rs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .rs-chip { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 6px 10px; min-height: 36px; background: none; border: 1px solid rgba(255,255,255,0.12); color: var(--grey-mid); cursor: pointer; }
        .rs-chip.on { border-color: var(--orange); color: var(--orange); }
        .rs-link { color: var(--orange); text-decoration: none; }
        .rs-link:hover { text-decoration: underline; }
        .rs-table-wrap { overflow-x: auto; }
        .rs-table { width: 100%; border-collapse: collapse; }
        .rs-table th { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); padding: 8px 10px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .rs-table td { padding: 10px; font-size: 13px; color: var(--off-white); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .rs-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        @media (max-width: 1100px) { .rs-layout { grid-template-columns: 1fr; } .rs-side { position: static; } }
      `}</style>

      <Header
        title={schedule.title}
        description={`${schedule.status.toUpperCase()} · ${describeSchedule(schedule)}`}
        action={
          <div className="rs-actions">
            <a href="/tasks/recurring" className="rs-btn ghost">All schedules</a>
            <button type="button" className="rs-btn" disabled={!!busy} onClick={handleSave}>
              {busy === 'save' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      />

      <div className="dash-content">
        {error && <div className="rs-alert error" role="alert">{error}</div>}
        {success && <div className="rs-alert success" role="status">{success}</div>}

        <div className="rs-layout">
          <div className="rs-main">
            <div className="rs-panel">
              <div className="rs-title">Template for future cycles</div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-title">Base title</label>
                <input id="rs-title" className="rs-input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
                <span className="rs-hint">Each cycle appends its date automatically (e.g. “{title || 'Weekly Ops'} — 25 Nov 2026”).</span>
              </div>
              <div className="rs-field">
                <span className="rs-label">Brief</span>
                <RichTextEditor content={description} onChange={setDescription} imageFolder="tasks" />
              </div>
              <div className="rs-field">
                <span className="rs-label">Links</span>
                {links.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input className="rs-input" style={{ flex: 1, minWidth: 140 }} placeholder="Label" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <input className="rs-input" style={{ flex: 2, minWidth: 200 }} placeholder="https://" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    <button type="button" className="rs-btn ghost" onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                ))}
                {links.length < 10 && (
                  <button type="button" className="rs-btn ghost" style={{ width: 'fit-content' }} onClick={() => setLinks([...links, { label: '', url: '' }])}>+ Add link</button>
                )}
              </div>
            </div>

            <div className="rs-panel">
              <div className="rs-title">Spawned cycles ({spawnedTasks.length} active/historical tasks · {runs.length} runs)</div>
              {spawnedTasks.length === 0 && runs.length === 0 ? (
                <span className="rs-hint">No cycles spawned yet. The first cycle will run on {schedule.next_run_on ?? 'the next scheduled date'}.</span>
              ) : (
                <div className="rs-table-wrap">
                  <table className="rs-table">
                    <thead>
                      <tr><th>Task</th><th>Cycle date</th><th>Assignee</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {spawnedTasks.map((t) => (
                        <tr key={t.id}>
                          <td><a href={`/tasks/${t.id}`} className="rs-link">{t.title}</a></td>
                          <td className="rs-hint">{t.occurrence_date ?? '—'}</td>
                          <td className="rs-hint">{t.assigned_to ? nameOf.get(t.assigned_to) ?? 'Unknown' : 'Draft'}</td>
                          <td>
                            {t.grace_draft_at && t.status === 'assigned'
                              ? <span style={{ color: 'var(--orange)', fontSize: 12 }}>Draft (3-day window)</span>
                              : TASK_STATUS_LABELS[t.status]}
                          </td>
                        </tr>
                      ))}
                      {runs.filter((r) => r.outcome === 'expired_deleted').map((r) => (
                        <tr key={`run-${r.id}`}>
                          <td className="rs-hint">Cycle {r.occurrence_date} (auto-deleted after 3-day draft window)</td>
                          <td className="rs-hint">{r.occurrence_date}</td>
                          <td className="rs-hint">—</td>
                          <td className="rs-hint">Expired &amp; removed</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rs-side">
            <div className="rs-panel">
              <div className="rs-title">Controls</div>
              <div className="rs-kv"><span>Status</span><strong style={{ color: 'var(--white)', textTransform: 'capitalize' }}>{schedule.status}</strong></div>
              <div className="rs-kv"><span>Next run</span><span>{schedule.next_run_on ?? 'None'}</span></div>
              <div className="rs-kv"><span>Cycles created</span><span>{schedule.occurrences_created}{schedule.max_occurrences ? ` / ${schedule.max_occurrences}` : ''}</span></div>
              <div className="rs-actions">
                {schedule.status === 'active' && schedule.next_run_on && (
                  <button type="button" className="rs-btn" disabled={!!busy} onClick={handleSpawnNow}>
                    {busy === 'spawn' ? 'Creating…' : 'Create next cycle now'}
                  </button>
                )}
                {schedule.status === 'active' && (
                  <button type="button" className="rs-btn ghost" disabled={!!busy} onClick={() => handleStatus('paused')}>Pause</button>
                )}
                {schedule.status === 'paused' && (
                  <button type="button" className="rs-btn" disabled={!!busy} onClick={() => handleStatus('active')}>Resume</button>
                )}
                {schedule.status !== 'completed' && (
                  <button type="button" className="rs-btn danger" disabled={!!busy} onClick={() => handleStatus('completed')}>End schedule</button>
                )}
              </div>
            </div>

            <div className="rs-panel">
              <div className="rs-title">Scope &amp; review mode</div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-cat">Category</label>
                <select id="rs-cat" className="rs-select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-comp">Complexity</label>
                <select id="rs-comp" className="rs-select" value={complexity} onChange={(e) => setComplexity(e.target.value as Complexity)}>
                  {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="rs-kv"><span>Points range</span><span>{defaults.pointRangeMin}–{defaults.pointRangeMax}</span></div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={skipAutomatedReview} onChange={(e) => setSkipAutomatedReview(e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--orange)' }} />
                <span className="rs-hint" style={{ color: 'var(--off-white)' }}>Direct team review (skip automated AI check)</span>
              </label>
            </div>

            <div className="rs-panel">
              <div className="rs-title">Cadence &amp; range</div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-cadence">Repeats</label>
                <select id="rs-cadence" className="rs-select" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
                  {CADENCES.map((c) => <option key={c} value={c}>{CADENCE_LABELS[c]}</option>)}
                </select>
              </div>
              {(cadence === 'weekly' || cadence === 'biweekly') && (
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-dow">Day of week</label>
                  <select id="rs-dow" className="rs-select" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                    {DAY_OF_WEEK_LABELS.map((l, idx) => <option key={l} value={idx}>{l}</option>)}
                  </select>
                </div>
              )}
              {cadence === 'monthly' && (
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-dom">Day of month (1–28)</label>
                  <input id="rs-dom" type="number" min={1} max={28} className="rs-input" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
                </div>
              )}
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-start">Start date</label>
                <input id="rs-start" type="date" className="rs-input" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-end">End rule</label>
                <select id="rs-end" className="rs-select" value={endMode} onChange={(e) => setEndMode(e.target.value as EndMode)}>
                  <option value="date">Until end date</option>
                  <option value="count">After N cycles</option>
                  <option value="never">Ongoing</option>
                </select>
              </div>
              {endMode === 'date' && (
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-end-date">End date</label>
                  <input id="rs-end-date" type="date" min={startsOn} className="rs-input" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                </div>
              )}
              {endMode === 'count' && (
                <div className="rs-field">
                  <label className="rs-label" htmlFor="rs-max">Max cycles (1–{MAX_OCCURRENCES_CAP})</label>
                  <input id="rs-max" type="number" min={1} max={MAX_OCCURRENCES_CAP} className="rs-input" value={maxOccurrences} onChange={(e) => setMaxOccurrences(e.target.value)} />
                </div>
              )}
              <div className="rs-field">
                <label className="rs-label" htmlFor="rs-dur">Deadline window per cycle (days)</label>
                <input id="rs-dur" type="number" min={DURATION_DAYS_MIN} max={DURATION_DAYS_MAX} className="rs-input" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
              </div>
            </div>

            <div className="rs-panel">
              <div className="rs-title">Assignment</div>
              <div className="rs-chips">
                <button type="button" className={`rs-chip${assignmentMode === 'one' ? ' on' : ''}`} onClick={() => setAssignmentMode('one')}>One person</button>
                <button type="button" className={`rs-chip${assignmentMode === 'group' ? ' on' : ''}`} onClick={() => setAssignmentMode('group')}>Several people</button>
                <button type="button" className={`rs-chip${assignmentMode === 'draft' ? ' on' : ''}`} onClick={() => setAssignmentMode('draft')}>Draft</button>
              </div>
              {assignmentMode === 'one' && (
                <select className="rs-select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Choose a member…</option>
                  {activeMembers.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                </select>
              )}
              {assignmentMode === 'group' && (
                <GroupPicker members={activeMembers} category={category} selected={groupIds} onChange={setGroupIds} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
