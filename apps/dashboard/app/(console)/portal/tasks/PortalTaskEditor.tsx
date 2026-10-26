'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RichTextEditor from '@/components/editor/RichTextEditor'
import { CATEGORIES, CATEGORY_LABELS, COMPLEXITIES, COMPLEXITY_LABELS, taskDefaults, type Category, type Complexity } from '@nextrium/contributions-core/constants'
import { createPortalTask, updatePortalTask } from './actions'
import { SHARED_WINDOW_DEFAULT_HOURS, SHARED_WINDOW_MAX_HOURS } from '@/lib/portal/sharedRules'

export interface PortalTaskValues {
  id?: string
  status?: string | null
  title: string
  description: string
  category: Category
  complexity: Complexity
  links: { label: string; url: string }[]
  tags: string
}

export interface AssignableContributor {
  id: string
  name: string
  categories: string[]
  running: number
  maxClaims: number
}

/** Create or edit a portal task. New tasks can be left open or assigned straight to a contributor. */
export default function PortalTaskEditor({ initial, contributors }: { initial: PortalTaskValues; contributors: AssignableContributor[] }) {
  const router = useRouter()
  const isNew = !initial.id
  const sizingLocked = !isNew && initial.status !== 'open'
  const [v, setV] = useState(initial)
  const [mode, setMode] = useState<'open' | 'shared' | 'assign'>('open')
  const [windowHours, setWindowHours] = useState(String(SHARED_WINDOW_DEFAULT_HOURS))
  const [maxClaimers, setMaxClaimers] = useState('')
  const [assignee, setAssignee] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const set = <K extends keyof PortalTaskValues>(k: K, val: PortalTaskValues[K]) => setV((p) => ({ ...p, [k]: val }))

  const d = taskDefaults(v.category, v.complexity)
  const ranked = useMemo(
    () => [...contributors].sort((a, b) => Number(b.categories.includes(v.category)) - Number(a.categories.includes(v.category)) || a.running - b.running || a.name.localeCompare(b.name)),
    [contributors, v.category],
  )

  async function save() {
    setBusy(true)
    setResult(null)
    const input = { title: v.title, description: v.description, category: v.category, complexity: v.complexity, links: v.links.filter((l) => l.url.trim()), tags: v.tags }
    const res = isNew
      ? await createPortalTask({
          ...input,
          ...(mode === 'assign' ? { assigneeId: assignee, deadlineAt: deadline ? new Date(deadline).toISOString() : null } : {}),
          ...(mode === 'shared' ? { shared: { windowHours, maxClaimers } } : {}),
        })
      : await updatePortalTask(initial.id!, input)
    setBusy(false)
    if (!res.ok) { setResult({ ok: false, text: res.error }); return }
    setResult({ ok: true, text: res.message })
    if (isNew && 'id' in res) router.push(`/portal/tasks/${res.id}`)
    else router.refresh()
  }

  return (
    <div className="pt-panel">
      <div className="pt-panel-title">{isNew ? 'New task' : 'Task details'}</div>
      {result && <div className={`pt-alert ${result.ok ? 'success' : 'error'}`} role={result.ok ? 'status' : 'alert'}>{result.text}</div>}

      <label className="pt-hint" htmlFor="pt-title">Title</label>
      <input id="pt-title" className="pt-input" maxLength={200} value={v.title} onChange={(e) => set('title', e.target.value)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pt-hint" htmlFor="pt-category">Category</label>
          <select id="pt-category" className="pt-input" value={v.category} disabled={sizingLocked} onChange={(e) => set('category', e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label className="pt-hint" htmlFor="pt-complexity">Size</label>
          <select id="pt-complexity" className="pt-input" value={v.complexity} disabled={sizingLocked} onChange={(e) => set('complexity', e.target.value as Complexity)}>
            {COMPLEXITIES.map((c) => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
          </select>
        </div>
      </div>
      <p className="pt-hint">
        {d.pointRangeMin}–{d.pointRangeMax} points · {d.deadlineDays}-day deadline
        {sizingLocked && ' · category and size are fixed once someone is working on the task'}
      </p>

      <span className="pt-hint">Brief</span>
      <RichTextEditor content={v.description} onChange={(html) => set('description', html)} placeholder="What needs doing, what done looks like, and what to submit." />

      <label className="pt-hint" htmlFor="pt-tags">Tags (comma separated, optional)</label>
      <input id="pt-tags" className="pt-input" value={v.tags} onChange={(e) => set('tags', e.target.value)} placeholder="trust, identity" />

      <span className="pt-hint">Links and repositories</span>
      {v.links.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="pt-input" aria-label={`Link ${i + 1} label`} placeholder="Label" value={l.label} onChange={(e) => set('links', v.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ minWidth: 140, flex: 1 }} />
          <input className="pt-input" aria-label={`Link ${i + 1} URL`} placeholder="https://" value={l.url} onChange={(e) => set('links', v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} style={{ minWidth: 220, flex: 2 }} />
          <button type="button" className="pt-btn ghost" onClick={() => set('links', v.links.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      {v.links.length < 10 && <button type="button" className="pt-btn ghost" onClick={() => set('links', [...v.links, { label: '', url: '' }])}>+ Add link</button>}

      {isNew && (
        <fieldset style={{ border: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <legend className="pt-hint" style={{ marginBottom: 6 }}>Who takes it?</legend>
          <label className="pt-hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="pt-mode" checked={mode === 'open'} onChange={() => setMode('open')} /> Open for claiming (first come, first served)
          </label>
          <label className="pt-hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="pt-mode" checked={mode === 'shared'} onChange={() => setMode('shared')} /> Open to several contributors (each claims their own copy)
          </label>
          {mode === 'shared' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="pt-hint" htmlFor="pt-window">Claim window (hours)</label>
                <input id="pt-window" className="pt-input" inputMode="numeric" value={windowHours} onChange={(e) => setWindowHours(e.target.value)} />
                <span className="pt-hint">Default {SHARED_WINDOW_DEFAULT_HOURS}; up to {SHARED_WINDOW_MAX_HOURS / 24} days. After it closes nobody new can claim.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="pt-hint" htmlFor="pt-cap">Places (optional)</label>
                <input id="pt-cap" className="pt-input" inputMode="numeric" value={maxClaimers} placeholder="No limit" onChange={(e) => setMaxClaimers(e.target.value)} />
                <span className="pt-hint">Each claimer gets their own copy, their own {d.deadlineDays}-day deadline from claiming, and earns points individually.</span>
              </div>
            </div>
          )}
          <label className="pt-hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="radio" name="pt-mode" checked={mode === 'assign'} onChange={() => setMode('assign')} /> Assign to a contributor
          </label>
          {mode === 'assign' && (
            <>
              <select className="pt-input" aria-label="Contributor" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Choose an approved contributor</option>
                {ranked.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.running >= c.maxClaims}>
                    {c.name} · {c.running}/{c.maxClaims} running{c.categories.includes(v.category) ? ` · ${CATEGORY_LABELS[v.category]}` : ''}
                  </option>
                ))}
              </select>
              <label className="pt-hint" htmlFor="pt-deadline">Deadline (optional; default {d.deadlineDays} days from now)</label>
              <input id="pt-deadline" type="datetime-local" className="pt-input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </>
          )}
        </fieldset>
      )}

      <button type="button" className="pt-btn" disabled={busy || !v.title.trim() || (isNew && mode === 'assign' && !assignee)} onClick={save}>
        {busy ? 'Saving…' : isNew ? (mode === 'assign' ? 'Create and assign' : mode === 'shared' ? 'Create shared task' : 'Create task') : 'Save changes'}
      </button>
    </div>
  )
}
