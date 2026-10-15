import Link from 'next/link'
import PublicShell from '@/components/PublicShell'
import { C, F } from '@/lib/theme'

export default function ContributorNotFound() {
  return (
    <PublicShell>
      <div className="bg-void pt-36 pb-28 flex flex-col items-center justify-center px-8 text-center">
        <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 24, color: C.light, marginBottom: 12 }}>Contributor not found</h1>
        <p style={{ fontFamily: F.body, fontSize: 14, color: C.mute, marginBottom: 28 }}>This profile does not exist or is not publicly available.</p>
        <Link href="/leaderboard" className="btn-primary" style={{ fontSize: 13 }}>View leaderboard</Link>
      </div>
    </PublicShell>
  )
}
