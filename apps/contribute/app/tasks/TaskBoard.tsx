'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, CATEGORY_LABELS, COMPLEXITIES, COMPLEXITY_LABELS } from '@nextrium/contributions-core/constants'
import type { TaskCard } from '@/lib/publicData'
import { CategoryBadge, ComplexityBadge } from '@/components/Badges'
import { C, F, categoryToken } from '@/lib/theme'

const SIZE_ORDER: Record<string, number> = { small: 1, medium: 2, large: 3 }

export default function TaskBoard({ tasks, basePath = '/tasks' }: { tasks: TaskCard[]; basePath?: string }) {
  const [category, setCategory] = useState('all')
  const [complexity, setComplexity] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks
      .filter((t) => (category === 'all' || t.category === category) && (complexity === 'all' || t.complexity === complexity))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.excerpt.toLowerCase().includes(q))
      .sort((a, b) => (SIZE_ORDER[b.complexity] ?? 0) - (SIZE_ORDER[a.complexity] ?? 0))
  }, [tasks, category, complexity, search])

  return (
    <>
      <div className="flex flex-col gap-4 mb-10">
        <label htmlFor="task-search" className="sr-only">Search tasks</label>
        <input
          id="task-search"
          type="search"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="portal-input"
          style={{ width: '100%', maxWidth: 400, padding: '11px 16px', background: C.depth, border: `1px solid ${C.border}`, borderRadius: 10, color: C.light, fontFamily: F.body, fontSize: 14 }}
        />

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          {(['all', ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              style={c === 'all' ? undefined : { ['--accent' as string]: `var(${categoryToken(c)})` }}
            >
              {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by size">
          {(['all', ...COMPLEXITIES] as const).map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={complexity === c} onClick={() => setComplexity(c)} style={{ fontSize: 11, padding: '5px 14px' }}>
              {c === 'all' ? 'All sizes' : COMPLEXITY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-6" aria-live="polite" style={{ fontFamily: F.body, fontSize: 13, color: C.mute }}>
        {filtered.length} task{filtered.length !== 1 ? 's' : ''} available
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 rounded-2xl border text-center" style={{ background: C.depth, borderColor: C.border }}>
          <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, color: C.light, marginBottom: 8 }}>
            {tasks.length === 0 ? 'No open tasks right now' : 'No tasks found'}
          </p>
          <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute }}>
            {tasks.length === 0 ? 'New tasks are posted regularly. Check back soon.' : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((task) => {
            const token = categoryToken(task.category)
            return (
              <article
                key={task.id}
                className="lift flex flex-col gap-4 p-6 rounded-2xl border"
                style={{ background: C.depth, borderColor: C.border, ['--accent' as string]: `var(${token})` }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryBadge category={task.category} />
                  <ComplexityBadge complexity={task.complexity} />
                </div>

                <h2 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light, lineHeight: 1.3, flex: 1 }}>
                  <Link href={`${basePath}/${task.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{task.title}</Link>
                </h2>

                <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12.5, color: C.mute, lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {task.excerpt}
                </p>

                <div className="flex items-center justify-between gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <div className="flex flex-col gap-0.5">
                    <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.mute }}>Points</span>
                    <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: `var(${token})`, fontVariantNumeric: 'tabular-nums' }}>
                      {task.point_range_min}–{task.point_range_max}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`${basePath}/${task.id}`} className="btn-outline" style={{ fontSize: 11, padding: '8px 16px', whiteSpace: 'nowrap' }} aria-label={`Read more about ${task.title}`}>
                      Read more
                    </Link>
                    <Link href={`${basePath}/${task.id}#claim`} className="btn-primary" style={{ fontSize: 11, padding: '8px 16px', whiteSpace: 'nowrap' }} aria-label={`Claim ${task.title}`}>
                      Claim
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
