import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/Header'
import { CONTRIBUTOR_ROLES, requireMember, requireStaff } from '@/lib/contributions/auth'
import { leaderboardName, rankLeaderboard, type LeaderboardEntry } from '@/lib/contributions/leaderboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leaderboard' }

interface Props {
  searchParams: Promise<{ period?: string }>
}

export default async function LeaderboardPage({ searchParams }: Props) {
  // Active contributors (any role) and staff.
  const staff = await requireStaff()
  const member = 'error' in staff ? await requireMember() : null
  const caller = 'caller' in staff ? staff.caller : member && 'caller' in member ? member.caller : null
  if (!caller) notFound()

  const { period } = await searchParams
  const monthly = period === 'month'
  const supabase = createServiceClient() as any

  // Active people only: archived or not-yet-onboarded people are not listed.
  const { data: members } = await supabase.from('dashboard_users')
    .select('user_id').in('role', CONTRIBUTOR_ROLES).eq('archived', false).not('onboarding_completed_at', 'is', null)
  const ids: string[] = (members ?? []).map((m: any) => m.user_id)

  let entries: LeaderboardEntry[] = []
  if (ids.length) {
    // Names come from the contributor's own display name, never their email.
    const { data: profileRows } = await supabase.from('contributor_profiles')
      .select('user_id, display_name, total_points, verified_contributions').in('user_id', ids)
    const profiles = (profileRows ?? []) as { user_id: string; display_name: string | null; total_points: number; verified_contributions: number }[]
    const names = new Map(profiles.map((p) => [p.user_id, leaderboardName(p.display_name)]))
    if (monthly) {
      const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0)
      const { data: ledger } = await supabase.from('points_ledger')
        .select('contributor_id, final_points').in('contributor_id', ids).gte('created_at', start.toISOString())
      const sums = new Map<string, { points: number; verified: number }>()
      for (const l of (ledger ?? []) as { contributor_id: string; final_points: number }[]) {
        const s = sums.get(l.contributor_id) ?? { points: 0, verified: 0 }
        sums.set(l.contributor_id, { points: s.points + l.final_points, verified: s.verified + 1 })
      }
      entries = [...sums].map(([userId, s]) => ({ userId, name: names.get(userId) ?? leaderboardName(null), ...s }))
    } else {
      entries = profiles.map((p) => ({
        userId: p.user_id, name: names.get(p.user_id) ?? leaderboardName(null), points: p.total_points, verified: p.verified_contributions,
      }))
    }
  }
  const ranked = rankLeaderboard(entries)

  return (
    <>
      <style>{`
        .lb-tabs { display: flex; border: 1px solid rgba(255,255,255,0.08); width: fit-content; margin-bottom: 20px; }
        .lb-tab { padding: 9px 18px; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none; color: var(--grey-mid); }
        .lb-tab.active { background: rgba(219,103,39,0.1); color: var(--orange); }
        .lb-list { display: flex; flex-direction: column; gap: 6px; max-width: 720px; }
        .lb-row { display: grid; grid-template-columns: 48px 1fr auto auto; gap: 16px; align-items: center; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); padding: 14px 18px; }
        .lb-row.me { border-color: rgba(219,103,39,0.45); }
        .lb-rank { font-family: var(--font-exo2); font-weight: 700; font-size: 18px; color: var(--grey-mid); }
        .lb-row:nth-child(-n+3) .lb-rank { color: var(--orange); }
        .lb-name { color: var(--white); font-size: 14px; font-weight: 600; text-decoration: none; }
        .lb-name:hover { color: var(--orange); }
        .lb-points { color: var(--white); font-family: var(--font-exo2); font-size: 18px; font-weight: 700; }
        .lb-muted { color: var(--grey-mid); font-size: 12px; }
        .lb-empty { padding: 32px; background: var(--navy); border: 1px solid rgba(255,255,255,0.06); color: var(--grey-mid); max-width: 720px; }
      `}</style>
      <Header title="Leaderboard" description="Points from verified contributions — select a name to see what they delivered" />
      <div className="dash-content">
        <div className="lb-tabs">
          <Link href="/dashboard/leaderboard" className={`lb-tab ${!monthly ? 'active' : ''}`}>All time</Link>
          <Link href="/dashboard/leaderboard?period=month" className={`lb-tab ${monthly ? 'active' : ''}`}>This month</Link>
        </div>
        {ranked.length === 0 ? (
          <div className="lb-empty">No points yet{monthly ? ' this month' : ''}. Verified contributions appear here.</div>
        ) : (
          <div className="lb-list">
            {ranked.map((e) => (
              <div key={e.userId} className={`lb-row ${e.userId === caller.userId ? 'me' : ''}`}>
                <span className="lb-rank">{e.rank}</span>
                <Link href={`/dashboard/leaderboard/${e.userId}`} className="lb-name">{e.name}{e.userId === caller.userId ? ' (you)' : ''}</Link>
                <span className="lb-muted">{e.verified} verified</span>
                <span className="lb-points">{e.points}</span>
              </div>
            ))}
          </div>
        )}
        {!monthly && <p className="lb-muted" style={{ marginTop: 14 }}>All-time totals include the 1.2× consistency bonus from five verified contributions.</p>}
      </div>
    </>
  )
}
