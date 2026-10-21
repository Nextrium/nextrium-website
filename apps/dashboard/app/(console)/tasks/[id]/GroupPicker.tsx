'use client'

import { useMemo, useState } from 'react'
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@nextrium/contributions-core/constants'
import { GROUP_MAX } from '@/lib/contributions/groupRules'
import type { MemberSummary } from '@/lib/contributions/members'

interface Props {
  /** Active members only. */
  members: MemberSummary[]
  /** The task's category: its people are listed first. */
  category: Category
  selected: string[]
  onChange: (ids: string[]) => void
}

/** Choose several people for one task, narrowed by area, up to GROUP_MAX. */
export default function GroupPicker({ members, category, selected, onChange }: Props) {
  const [area, setArea] = useState<Category | 'all'>('all')
  const shown = useMemo(
    () => members
      .filter((m) => area === 'all' || m.categories.includes(area))
      .sort((a, b) => Number(b.categories.includes(category)) - Number(a.categories.includes(category)) || a.openTasks - b.openTasks || a.name.localeCompare(b.name)),
    [members, area, category],
  )
  const chosen = new Set(selected)
  const full = selected.length >= GROUP_MAX

  function toggle(id: string) {
    if (chosen.has(id)) onChange(selected.filter((x) => x !== id))
    else if (!full) onChange([...selected, id])
  }
  function selectShown() {
    const next = [...selected]
    for (const m of shown) if (!chosen.has(m.userId) && next.length < GROUP_MAX) next.push(m.userId)
    onChange(next)
  }

  return (
    <div className="task-field">
      <span className="task-label" id="group-areas-label">Show people in</span>
      <div className="group-areas" role="group" aria-labelledby="group-areas-label">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button key={c} type="button" className={`group-chip${area === c ? ' on' : ''}`} aria-pressed={area === c} onClick={() => setArea(c)}>
            {c === 'all' ? 'Everyone' : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="group-list" role="group" aria-label="People to assign">
        {shown.length === 0 && <span className="group-note">No active members in this area.</span>}
        {shown.map((m) => {
          const on = chosen.has(m.userId)
          return (
            <label key={m.userId} className={`group-person${on ? ' on' : ''}`}>
              <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(m.userId)} />
              <span className="group-name">{m.name}</span>
              <span className="group-meta">{m.openTasks} open{m.categories.includes(category) ? ` · ✓ ${CATEGORY_LABELS[category]}` : ''}</span>
            </label>
          )
        })}
      </div>

      <div className="group-foot">
        <span className="group-note" aria-live="polite">{selected.length} chosen · up to {GROUP_MAX}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {shown.some((m) => !chosen.has(m.userId)) && !full && (
            <button type="button" className="task-btn ghost" onClick={selectShown}>Select all shown</button>
          )}
          {selected.length > 0 && <button type="button" className="task-btn ghost" onClick={() => onChange([])}>Clear</button>}
        </span>
      </div>
    </div>
  )
}
