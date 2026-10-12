import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { CONTRIBUTOR_ROLES, requireMember, requireStaff } from '@/lib/contributions/auth'
import {
  leaderboardName, leaderboardStats, pointsBarPercent, rankLeaderboard, type LeaderboardEntry,
} from '@/lib/contributions/leaderboard'
import { CATEGORIES, CATEGORY_LABELS, COMPLEXITY_LABELS, isCategory, type Category, type Complexity } from '@/lib/contributions/constants'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leaderboard' }

// Soft per-area tints for avatars and tags, chosen to read on navy beside the orange accent.
const AREA_TINT: Record<string, string> = {
  technical: '#7CC4F2',
  design: '#C9A3F0',
  research: '#F0CB6E',
  operations: '#8ED9B8',
  community: '#F2A27A',
  default: '#DB6727',
}

interface Props {
  searchParams: Promise<{ period?: string; category?: string }>
}

interface Profile {
  user_id: string
  display_name: string | null
  total_points: number
  verified_contributions: number
  categories: string[] | null
}

interface Delivered {
  id: string
  contributor_id: string
  task_id: string
  final_points: number | null
  verified_at: string | null
}

export default async function LeaderboardPage({ searchParams }: Props) {
  // Active contributors (any role) and staff.
  const staff = await requireStaff()
  const member = 'error' in staff ? await requireMember() : null
  const caller = 'caller' in staff ? staff.caller : member && 'caller' in member ? member.caller : null
  if (!caller) notFound()

  const { period, category: rawCategory } = await searchParams
  const monthly = period === 'month'
  const category: Category | null = isCategory(rawCategory) ? rawCategory : null
  const supabase = createServiceClient() as any
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)

  // Active people only: archived or not-yet-onboarded people are not listed.
  const { data: members } = await supabase.from('dashboard_users')
    .select('user_id').in('role', CONTRIBUTOR_ROLES).eq('archived', false).not('onboarding_completed_at', 'is', null)
  const ids: string[] = (members ?? []).map((m: any) => m.user_id)

  let entries: LeaderboardEntry[] = []
  let profileMap = new Map<string, Profile>()
  if (ids.length) {
    // Names come from the contributor's own display name, never their email.
    const { data: profileRows } = await supabase.from('contributor_profiles')
      .select('user_id, display_name, total_points, verified_contributions, categories').in('user_id', ids)
    const profiles = (profileRows ?? []) as Profile[]
    profileMap = new Map(profiles.map((p) => [p.user_id, p]))
    const nameOf = (id: string) => leaderboardName(profileMap.get(id)?.display_name)
    if (monthly) {
      const { data: ledger } = await supabase.from('points_ledger')
        .select('contributor_id, final_points').in('contributor_id', ids).gte('created_at', monthStart.toISOString())
      const sums = new Map<string, { points: number; verified: number }>()
      for (const l of (ledger ?? []) as { contributor_id: string; final_points: number }[]) {
        const s = sums.get(l.contributor_id) ?? { points: 0, verified: 0 }
        sums.set(l.contributor_id, { points: s.points + l.final_points, verified: s.verified + 1 })
      }
      entries = [...sums].map(([userId, s]) => ({ userId, name: nameOf(userId), ...s }))
    } else {
      entries = profiles.map((p) => ({ userId: p.user_id, name: nameOf(p.user_id), points: p.total_points, verified: p.verified_contributions }))
    }
  }

  const ranked = rankLeaderboard(entries)
  const stats = leaderboardStats(ranked)
  const areasOf = (id: string) => (profileMap.get(id)?.categories ?? []).filter(isCategory)
  const shown = category ? ranked.filter((e) => areasOf(e.userId).includes(category)) : ranked
  const leaderPoints = ranked[0]?.points ?? 0

  // Verified work for everyone shown, for the expandable cards. Verified only;
  // staff notes, review feedback and security findings are never selected.
  const delivered = new Map<string, Delivered[]>()
  const taskInfo = new Map<string, { title: string; category: Category; complexity: Complexity }>()
  if (shown.length) {
    let q = supabase.from('contributions')
      .select('id, contributor_id, task_id, final_points, verified_at')
      .in('contributor_id', shown.map((e) => e.userId)).eq('status', 'verified')
      .order('verified_at', { ascending: false }).limit(1000)
    if (monthly) q = q.gte('verified_at', monthStart.toISOString())
    const { data: rows } = await q
    for (const r of (rows ?? []) as Delivered[]) {
      const list = delivered.get(r.contributor_id) ?? []
      list.push(r)
      delivered.set(r.contributor_id, list)
    }
    const taskIds = [...new Set(((rows ?? []) as Delivered[]).map((r) => r.task_id))]
    if (taskIds.length) {
      const { data: tasks } = await supabase.from('tasks').select('id, title, category, complexity').in('id', taskIds)
      for (const t of tasks ?? []) taskInfo.set(t.id, { title: t.title, category: t.category, complexity: t.complexity })
    }
  }

  const href = (next: { period?: string | null; category?: string | null }) => {
    const p = next.period !== undefined ? next.period : (monthly ? 'month' : null)
    const c = next.category !== undefined ? next.category : category
    const qs = new URLSearchParams()
    if (p) qs.set('period', p)
    if (c) qs.set('category', c)
    const s = qs.toString()
    return `/dashboard/leaderboard${s ? `?${s}` : ''}`
  }
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—')

  return (
    <>
      <style>{`
        .lb-wrap { max-width: 960px; }
        .lb-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .lb-tabs { display: inline-flex; padding: 3px; gap: 3px; background: var(--navy); border: 1px solid rgba(255,255,255,0.07); border-radius: 999px; }
        .lb-tab { padding: 7px 16px; border-radius: 999px; font-size: 12px; font-weight: 500; text-decoration: none; color: var(--grey-mid); transition: background .15s ease, color .15s ease; }
        .lb-tab:hover { color: var(--off-white); }
        .lb-tab.active { background: rgba(219,103,39,0.16); color: var(--orange); }

        .lb-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
        .lb-stat { background: linear-gradient(160deg, var(--navy), rgba(219,103,39,0.04)); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 22px 24px; display: flex; flex-direction: column; gap: 8px; }
        .lb-stat-value { font-family: var(--font-exo2); font-weight: 800; font-size: 30px; line-height: 1; color: var(--orange); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .lb-stat-label { font-size: 13px; color: var(--grey-mid); }

        .lb-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
        .lb-chip { padding: 7px 16px; border-radius: 999px; font-size: 13px; text-decoration: none; color: var(--grey-mid); border: 1px solid rgba(255,255,255,0.1); transition: border-color .15s ease, color .15s ease; }
        .lb-chip:hover { color: var(--off-white); border-color: rgba(255,255,255,0.22); }
        .lb-chip.active { color: var(--orange); border-color: rgba(219,103,39,0.6); background: rgba(219,103,39,0.1); }

        .lb-list { display: flex; flex-direction: column; gap: 12px; }
        .lb-card { position: relative; background: var(--navy); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; overflow: hidden; }
        .lb-card.top { background: linear-gradient(135deg, var(--navy) 55%, rgba(219,103,39,0.07)); border-color: rgba(219,103,39,0.22); }
        .lb-card.me { box-shadow: inset 0 0 0 1px rgba(219,103,39,0.55); }
        .lb-bar { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(219,103,39,0.08), transparent); pointer-events: none; }

        .lb-card > summary { list-style: none; cursor: pointer; }
        .lb-card > summary::-webkit-details-marker { display: none; }
        .lb-card > summary:focus-visible { outline: 2px solid var(--orange); outline-offset: -2px; border-radius: 18px; }
        .lb-main { position: relative; display: grid; grid-template-columns: 44px 48px 1fr auto 34px; gap: 18px; align-items: center; padding: 20px 22px; }

        .lb-rank { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-exo2); font-weight: 800; font-size: 14px; color: var(--grey-mid); font-variant-numeric: tabular-nums; }
        .lb-rank.medal { color: var(--navy-deep); box-shadow: 0 0 0 3px rgba(255,255,255,0.06); }
        .lb-rank.r1 { background: radial-gradient(circle at 35% 30%, #FFD9A8, #DB6727 70%); }
        .lb-rank.r2 { background: radial-gradient(circle at 35% 30%, #F2F4F7, #9AA6B5 70%); }
        .lb-rank.r3 { background: radial-gradient(circle at 35% 30%, #F1C9A3, #A86A3D 70%); }

        .lb-avatar { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-exo2); font-weight: 800; font-size: 18px; text-transform: uppercase; }
        .lb-who { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .lb-headline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
        .lb-name { color: var(--white); font-family: var(--font-exo2); font-size: 16px; font-weight: 700; text-decoration: none; letter-spacing: -0.01em; }
        .lb-name:hover { color: var(--orange); }
        .lb-tag { font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; border: 1px solid; white-space: nowrap; }
        .lb-sub { font-size: 12.5px; color: var(--grey-mid); }
        .lb-you { color: var(--orange); font-weight: 600; }

        .lb-score { text-align: right; }
        .lb-points { display: block; font-family: var(--font-exo2); font-size: 24px; font-weight: 800; color: var(--orange); line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .lb-points-label { font-size: 11px; color: var(--grey-mid); }
        .lb-chevron { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: var(--grey-mid); transition: transform .2s ease, border-color .15s ease, color .15s ease; }
        .lb-card > summary:hover .lb-chevron { border-color: rgba(219,103,39,0.5); color: var(--orange); }
        .lb-card[open] .lb-chevron { transform: rotate(180deg); }
        .lb-chevron.empty { visibility: hidden; }

        .lb-work { position: relative; list-style: none; margin: 0; padding: 0 22px 18px; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; }
        .lb-work li { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; }
        .lb-work-title { color: var(--off-white); font-size: 13.5px; }
        .lb-work-sub { display: block; font-size: 11.5px; color: var(--grey-mid); margin-top: 3px; }
        .lb-work-points { font-family: var(--font-exo2); font-weight: 700; color: var(--orange); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .lb-detail { position: relative; display: inline-block; margin: 0 22px 18px; font-size: 12.5px; color: var(--orange); text-decoration: none; }
        .lb-detail:hover { text-decoration: underline; }

        .lb-empty { padding: 48px 32px; text-align: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; color: var(--grey-mid); }
        .lb-note { color: var(--grey-mid); font-size: 12px; margin-top: 16px; }

        @media (prefers-reduced-motion: reduce) { .lb-chevron, .lb-tab, .lb-chip { transition: none; } }
        @media (max-width: 640px) {
          .lb-stats { grid-template-columns: 1fr; }
          .lb-main { grid-template-columns: 34px 1fr auto 30px; gap: 12px; padding: 16px; }
          .lb-avatar { display: none; }
          .lb-points { font-size: 19px; }
          .lb-work { padding-left: 16px; padding-right: 16px; }
          .lb-work li { grid-template-columns: 1fr; }
          .lb-detail { margin-left: 16px; }
        }
      `}</style>
      <Header title="Leaderboard" description="Points from verified work" />
      <div className="dash-content">
        <div className="lb-wrap">
          <div className="lb-controls">
            <div className="lb-tabs">
              <Link href={href({ period: null })} className={`lb-tab ${!monthly ? 'active' : ''}`}>All time</Link>
              <Link href={href({ period: 'month' })} className={`lb-tab ${monthly ? 'active' : ''}`}>This month</Link>
            </div>
          </div>

          <div className="lb-stats">
            <div className="lb-stat"><span className="lb-stat-value">{stats.contributors}</span><span className="lb-stat-label">Contributors</span></div>
            <div className="lb-stat"><span className="lb-stat-value">{stats.points.toLocaleString()}</span><span className="lb-stat-label">Points awarded</span></div>
            <div className="lb-stat"><span className="lb-stat-value">{stats.verified}</span><span className="lb-stat-label">Verified contributions</span></div>
          </div>

          <div className="lb-chips">
            <Link href={href({ category: null })} className={`lb-chip ${!category ? 'active' : ''}`}>All</Link>
            {CATEGORIES.map((c) => (
              <Link key={c} href={href({ category: c })} className={`lb-chip ${category === c ? 'active' : ''}`}>{CATEGORY_LABELS[c]}</Link>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="lb-empty">
              {ranked.length === 0
                ? `No points yet${monthly ? ' this month' : ''}.`
                : `No one in ${category ? CATEGORY_LABELS[category] : 'this area'} has points yet.`}
            </div>
          ) : (
            <div className="lb-list">
              {shown.map((e) => {
                const isMe = e.userId === caller.userId
                const work = delivered.get(e.userId) ?? []
                const areas = areasOf(e.userId)
                const tint = AREA_TINT[areas[0] ?? ''] ?? AREA_TINT.default
                const shownAreas = areas.slice(0, 2)
                return (
                  <details key={e.userId} className={`lb-card ${e.rank <= 3 ? 'top' : ''} ${isMe ? 'me' : ''}`}>
                    <summary>
                      <div className="lb-bar" style={{ width: `${pointsBarPercent(e.points, leaderPoints)}%` }} />
                      <div className="lb-main">
                        <span className={`lb-rank ${e.rank <= 3 ? `medal r${e.rank}` : ''}`} aria-label={`Rank ${e.rank}`}>{e.rank}</span>
                        <span className="lb-avatar" aria-hidden="true" style={{ background: `${tint}1f`, border: `1px solid ${tint}55`, color: tint }}>{e.name.charAt(0)}</span>
                        <div className="lb-who">
                          <div className="lb-headline">
                            <Link href={`/dashboard/leaderboard/${e.userId}`} className="lb-name">{e.name}</Link>
                            {shownAreas.map((c) => {
                              const t = AREA_TINT[c] ?? AREA_TINT.default
                              return <span key={c} className="lb-tag" style={{ color: t, borderColor: `${t}55`, background: `${t}14` }}>{CATEGORY_LABELS[c]}</span>
                            })}
                            {areas.length > shownAreas.length && <span className="lb-sub">+{areas.length - shownAreas.length}</span>}
                          </div>
                          <span className="lb-sub">
                            {isMe && <span className="lb-you">You · </span>}
                            {e.verified} contribution{e.verified === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="lb-score">
                          <span className="lb-points">{e.points.toLocaleString()}</span>
                          <span className="lb-points-label">points</span>
                        </div>
                        <span className={`lb-chevron ${work.length ? '' : 'empty'}`} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                      </div>
                    </summary>
                    {work.length > 0 && (
                      <>
                        <ul className="lb-work">
                          {work.map((w) => {
                            const t = taskInfo.get(w.task_id)
                            return (
                              <li key={w.id}>
                                <span>
                                  <span className="lb-work-title">{t?.title ?? 'Task'}</span>
                                  <span className="lb-work-sub">
                                    {t ? `${CATEGORY_LABELS[t.category]} · ${COMPLEXITY_LABELS[t.complexity]} · ` : ''}{fmtDate(w.verified_at)}
                                  </span>
                                </span>
                                <span className="lb-work-points">{w.final_points ?? 0} pts</span>
                              </li>
                            )
                          })}
                        </ul>
                        <Link href={`/dashboard/leaderboard/${e.userId}`} className="lb-detail">See full details →</Link>
                      </>
                    )}
                  </details>
                )
              })}
            </div>
          )}
          {!monthly && <p className="lb-note">All-time totals include a 1.2× bonus after five verified contributions.</p>}
        </div>
      </div>
    </>
  )
}
