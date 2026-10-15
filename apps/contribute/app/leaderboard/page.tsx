import type { Metadata } from 'next'
import Link from 'next/link'
import { brand } from '@nextrium/brand'
import PublicShell from '@/components/PublicShell'
import PageHeader from '@/components/PageHeader'
import { getLeaderboard, isSignedIn } from '@/lib/publicData'
import { C, F } from '@/lib/theme'
import LeaderboardList from './LeaderboardList'

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: `A public record of every verified contribution to ${brand.name}.`,
}
export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const [{ contributors, contributions }, signedIn] = await Promise.all([getLeaderboard(), isSignedIn()])
  const totalPoints = contributors.reduce((sum, c) => sum + c.total_points, 0)
  const totalVerified = contributors.reduce((sum, c) => sum + c.verified_contributions, 0)

  const stats = [
    { label: 'Active contributors', value: contributors.length.toLocaleString('en-GB') },
    { label: 'Total points earned', value: totalPoints.toLocaleString('en-GB') },
    { label: 'Verified contributions', value: totalVerified.toLocaleString('en-GB') },
  ]

  return (
    <PublicShell signedIn={signedIn}>
      <div className="bg-void pt-20 pb-28">
        <div className="max-w-5xl mx-auto px-8 lg:px-14">
          <PageHeader
            crumb="Leaderboard"
            title="Contributor leaderboard"
            intro={`A public record of every verified contribution to ${brand.name}. Each contributor has a profile they can share as proof of their work.`}
          />

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse gap-2 p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
                <dt style={{ fontFamily: F.body, fontSize: 12, color: C.mute }}>{s.label}</dt>
                <dd style={{ fontFamily: F.display, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: C.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</dd>
              </div>
            ))}
          </dl>

          <LeaderboardList contributors={contributors} contributions={contributions} />

          <div className="mt-12 p-8 rounded-2xl border text-center" style={{ background: C.depth, borderColor: C.border }}>
            <p className="mb-2" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, color: C.light }}>Your name could be here</p>
            <p className="mb-6" style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute, lineHeight: 1.7 }}>
              Every verified contribution earns public points and adds to a profile you can share.
            </p>
            <Link href={signedIn ? '/tasks' : '/signin'} className="btn-primary" style={{ fontSize: 13 }}>
              Start contributing
            </Link>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
