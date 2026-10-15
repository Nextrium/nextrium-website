'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, CATEGORY_LABELS, COMPLEXITY_LABELS, type Complexity } from '@nextrium/contributions-core/constants'
import type { PublicContribution, PublicContributor } from '@/lib/publicData'
import { barPercent, publicName, rankContributors } from '@/lib/ranking'
import { CategoryBadge, NeutralBadge } from '@/components/Badges'
import { C, F, categoryToken, tint } from '@/lib/theme'

const MEDALS = ['🥇', '🥈', '🥉']

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''

export default function LeaderboardList({ contributors, contributions }: { contributors: PublicContributor[]; contributions: PublicContribution[] }) {
  const [category, setCategory] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const byContributor = useMemo(() => {
    const map = new Map<string, PublicContribution[]>()
    for (const c of contributions) map.set(c.contributor_id, [...(map.get(c.contributor_id) ?? []), c])
    return map
  }, [contributions])

  const ranked = useMemo(
    () => rankContributors(contributors.filter((c) => category === 'all' || c.categories.includes(category))),
    [contributors, category],
  )
  const leaderPoints = ranked[0]?.total_points ?? 0

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter by category">
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

      {ranked.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 rounded-2xl border text-center" style={{ background: C.depth, borderColor: C.border }}>
          <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, color: C.light, marginBottom: 8 }}>No contributors yet</p>
          <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute, marginBottom: 20 }}>Be the first to contribute in this category</p>
          <Link href="/tasks" className="btn-primary" style={{ fontSize: 13 }}>Browse tasks</Link>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {ranked.map((c) => {
            const token = categoryToken(c.categories[0])
            const top = c.rank <= 3 && c.total_points > 0
            const name = publicName(c)
            const open = expandedId === c.id
            const work = byContributor.get(c.id) ?? []
            const panelId = `contributions-${c.id}`

            return (
              <li
                key={c.id}
                className="flex flex-col rounded-2xl border overflow-hidden"
                style={{ background: top ? `linear-gradient(135deg, ${C.depth}, ${tint('--orange', 6)})` : C.depth, borderColor: top ? tint(token, 30) : C.border }}
              >
                <div className="relative flex items-center gap-4 sm:gap-5 p-4 sm:p-5 overflow-hidden">
                  <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barPercent(c.total_points, leaderPoints)}%`, background: `linear-gradient(90deg, ${tint(token, 8)}, transparent)`, pointerEvents: 'none' }} />

                  <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 32 }}>
                    {top
                      ? <span style={{ fontSize: 20 }} role="img" aria-label={`Rank ${c.rank}`}>{MEDALS[c.rank - 1]}</span>
                      : <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: C.dim }} aria-label={`Rank ${c.rank}`}>{c.rank}</span>}
                  </div>

                  <div className="relative hidden sm:flex flex-shrink-0 items-center justify-center rounded-full" aria-hidden="true" style={{ width: 44, height: 44, background: tint(token, 10), border: `1px solid ${tint(token, 22)}` }}>
                    <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: `var(${token})` }}>{name.charAt(0).toUpperCase()}</span>
                  </div>

                  <div className="relative flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link href={`/contributors/${c.id}`} style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light, textDecoration: 'none' }}>
                        {name}
                      </Link>
                      {c.contributor_type === 'team' && <NeutralBadge>Team</NeutralBadge>}
                      {c.categories.map((cat) => <CategoryBadge key={cat} category={cat} />)}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {c.location && <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute }}>{c.location}</span>}
                      <span style={{ fontFamily: F.body, fontSize: 11, color: C.mute }}>
                        {c.verified_contributions} contribution{c.verified_contributions !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="relative flex-shrink-0 flex items-center gap-3 sm:gap-4">
                    <div className="text-right">
                      <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 22, color: `var(${token})`, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {c.total_points.toLocaleString('en-GB')}
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 10, color: C.mute, marginTop: 2 }}>points</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : c.id)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      aria-label={open ? `Hide ${name}'s contributions` : `Show ${name}'s contributions`}
                      className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{ width: 28, height: 28, border: `1px solid ${C.border}`, background: open ? tint('--orange', 15) : 'transparent', color: open ? C.accent : C.dim, cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                        {open ? <path d="M2 8l4-4 4 4" /> : <path d="M2 4l4 4 4-4" />}
                      </svg>
                    </button>
                  </div>
                </div>

                {open && (
                  <div id={panelId} className="border-t px-4 sm:px-5 py-4 flex flex-col gap-3" style={{ borderColor: C.border, background: tint('--black', 20) }}>
                    {work.length === 0 ? (
                      <p style={{ fontFamily: F.body, fontSize: 12, color: C.dim }}>No verified contributions yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {work.map((w) => (
                          <li key={w.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.depth, border: `1px solid ${C.border}` }}>
                            <div className="flex-1 min-w-0">
                              <p style={{ fontFamily: F.body, fontSize: 12, fontWeight: 500, color: C.light, marginBottom: 3, overflowWrap: 'anywhere' }}>{w.title}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <CategoryBadge category={w.category} />
                                <span style={{ fontFamily: F.body, fontSize: 10, color: C.dim }}>{COMPLEXITY_LABELS[w.complexity as Complexity] ?? w.complexity}</span>
                                <span style={{ fontFamily: F.body, fontSize: 10, color: C.dim }}>{formatDate(w.verified_at)}</span>
                              </div>
                            </div>
                            <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: `var(${token})`, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{w.points} pts</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link href={`/contributors/${c.id}`} className="flex items-center gap-1 self-start mt-1" style={{ fontFamily: F.body, fontSize: 12, color: C.accent, textDecoration: 'none' }}>
                      View full profile
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M2 8l6-6M4 2h4v4" />
                      </svg>
                    </Link>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
