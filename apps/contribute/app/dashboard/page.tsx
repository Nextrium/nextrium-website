import { getActiveContributor } from '@/lib/portal'
import { C, F } from '@/lib/theme'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardHome() {
  const me = await getActiveContributor()
  if (!me) return null

  return (
    <div className="max-w-3xl mx-auto px-8 py-20">
      <p className="section-label mb-4">Contributor dashboard</p>
      <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(28px,4vw,44px)', letterSpacing: '-0.02em', color: C.light, marginBottom: 12 }}>
        Welcome back, {me.name}
      </h1>
      <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 15, color: C.mute, lineHeight: 1.75, marginBottom: 32 }}>
        You are signed in as {me.email}.
      </p>
      <SignOutButton />
    </div>
  )
}
