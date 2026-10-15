import type { Metadata } from 'next'
import { getActiveContributor } from '@/lib/portal'
import { getLeaderboard } from '@/lib/publicData'
import { C, F } from '@/lib/theme'
import LeaderboardList from '@/app/leaderboard/LeaderboardList'

export const metadata: Metadata = { title: 'Leaderboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardLeaderboardPage() {
  const me = await getActiveContributor()
  if (!me) return null
  const { contributors, contributions } = await getLeaderboard()
  const mine = contributors.find((c) => c.id === me.id)

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-14 py-12 lg:py-16">
      <h1 className="mb-3" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(28px,4vw,48px)', letterSpacing: '-0.03em', lineHeight: 1.05, color: C.light }}>Leaderboard</h1>
      <p className="mb-10" style={{ fontFamily: F.body, fontWeight: 300, fontSize: 15, color: C.mute, lineHeight: 1.75 }}>
        {mine ? `You have ${mine.total_points.toLocaleString('en-GB')} points from ${mine.verified_contributions} verified contribution${mine.verified_contributions === 1 ? '' : 's'}.` : 'Every approved contributor, ranked by verified points.'}
      </p>
      <LeaderboardList contributors={contributors} contributions={contributions} />
    </div>
  )
}
