import Link from 'next/link'
import { brand } from '@nextrium/brand'
import { CATEGORY_LABELS, COMPLEXITIES, COMPLEXITY_LABELS, DEADLINE_DAYS, POINT_RANGES, type Category } from '@nextrium/contributions-core/constants'
import PublicShell from '@/components/PublicShell'
import { CLAIM_COOLDOWN_HOURS, DEFAULT_MAX_CLAIMS } from '@/lib/claims'
import { isSignedIn } from '@/lib/publicData'
import { CATEGORIES } from '@/lib/registration'
import { C, F, categoryToken, tint } from '@/lib/theme'

export const dynamic = 'force-dynamic'

const HOW_IT_WORKS = [
  { title: 'Register', desc: 'Submit your details and area of expertise. The core team reviews and activates your account.' },
  { title: 'Pick a task', desc: `Browse the open task board and claim a task that matches your skills. First come, first served, up to ${DEFAULT_MAX_CLAIMS} at a time.` },
  { title: 'Contribute', desc: 'Complete the work and submit your evidence. It is reviewed automatically, then verified by the core team.' },
  { title: 'Earn points', desc: 'Verified contributions earn points on the public leaderboard and your shareable contributor profile.' },
]

// The order the point table lists categories in.
const TABLE_ORDER: Category[] = ['technical', 'design', 'research', 'operations', 'community']

const h2: React.CSSProperties = { fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(28px,3.5vw,48px)', letterSpacing: '-0.025em', color: C.light, lineHeight: 1.1, textWrap: 'balance' }
const lead: React.CSSProperties = { fontFamily: F.body, fontWeight: 300, fontSize: 15, color: C.mute, maxWidth: 480, lineHeight: 1.75 }

export default async function ContributePage() {
  const signedIn = await isSignedIn()

  return (
    <PublicShell signedIn={signedIn}>
      {/* Hero */}
      <section className="relative pt-28 pb-28 overflow-hidden bg-page-gradient">
        <div className="orb orb-a" style={{ position: 'absolute' }} aria-hidden="true" />
        <div className="orb orb-b" style={{ position: 'absolute' }} aria-hidden="true" />

        <div className="relative z-10 max-w-4xl mx-auto px-8 lg:px-14 text-center">
          <span className="section-label block mb-6">Build with {brand.name}</span>
          <h1 className="mb-7" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(40px,6vw,80px)', letterSpacing: '-0.03em', lineHeight: 1.02, color: C.light, textWrap: 'balance' }}>
            Do real work.<br />
            <span className="text-gradient">Build a public record of it.</span>
          </h1>
          <p className="mb-12 mx-auto" style={{ fontFamily: F.body, fontWeight: 300, fontSize: 17, color: C.mute, maxWidth: 560, lineHeight: 1.78 }}>
            {brand.name} builds in the open with a community of contributors. Claim a task, ship it, and every verified contribution earns points on a public leaderboard and a profile you can share.
          </p>

          <div className="flex flex-wrap gap-4 justify-center mb-16">
            <Link href="/tasks" className="btn-primary">Browse open tasks</Link>
            <Link href="/leaderboard" className="btn-outline">View leaderboard</Link>
          </div>

          <p style={{ fontFamily: F.body, fontSize: 13, color: C.dim, marginTop: 8 }}>
            {signedIn ? (
              <Link href="/dashboard" style={{ color: C.accent, textDecoration: 'none' }}>Go to your dashboard</Link>
            ) : (
              <>
                Already a contributor?{' '}
                <Link href="/signin" style={{ color: C.accent, textDecoration: 'none' }}>Sign in to your dashboard</Link>
              </>
            )}
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-28 bg-void">
        <div className="max-w-6xl mx-auto px-8 lg:px-14">
          <span className="section-label block mb-6 text-center">How it works</span>
          <h2 className="mb-16 text-center" style={h2}>Four steps from sign-up to verified work</h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((h, i) => (
              <li key={h.title} className="flex flex-col gap-4 p-7 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
                <span aria-hidden="true" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 36, color: C.dim, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 16, color: C.light }}>{h.title}</p>
                <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute, lineHeight: 1.65 }}>{h.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Contribution categories */}
      <section className="py-28" style={{ background: `linear-gradient(180deg, ${C.void}, ${C.depth})` }}>
        <div className="max-w-6xl mx-auto px-8 lg:px-14">
          <span className="section-label block mb-6 text-center">Contribution categories</span>
          <h2 className="mb-6 text-center" style={h2}>Five ways to contribute</h2>
          <p className="mb-16 text-center mx-auto" style={lead}>
            Every category has published point ranges. The core team confirms the final score within that range based on quality and impact.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CATEGORIES.map((c) => {
              const token = categoryToken(c.id)
              return (
                <div key={c.id} className="lift flex flex-col gap-4 p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border, ['--accent' as string]: `var(${token})` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: tint(token, 10), border: `1px solid ${tint(token, 22)}` }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: `var(${token})` }} />
                  </div>
                  <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 15, color: C.light }}>{c.label}</p>
                  <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 12, color: C.mute, lineHeight: 1.6 }}>{c.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Point ranges */}
      <section className="py-28 bg-void">
        <div className="max-w-4xl mx-auto px-8 lg:px-14">
          <span className="section-label block mb-6 text-center">Point system</span>
          <h2 className="mb-6 text-center" style={h2}>Transparent by design</h2>
          <p className="mb-16 text-center mx-auto" style={lead}>Every point range is public before you start. No surprises after delivery.</p>

          <div className="flex flex-col gap-3">
            {TABLE_ORDER.map((cat) => {
              const token = categoryToken(cat)
              return (
                <div key={cat} className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border items-center" style={{ background: C.depth, borderColor: C.border }}>
                  <div className="col-span-2 sm:col-span-1 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: `var(${token})` }} />
                    <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 13, color: C.light }}>{CATEGORY_LABELS[cat]}</span>
                  </div>
                  {COMPLEXITIES.map((size) => (
                    <div key={size} className="flex flex-col gap-1">
                      <span style={{ fontFamily: F.body, fontSize: 9, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.mute }}>{COMPLEXITY_LABELS[size]}</span>
                      <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: `var(${token})`, fontVariantNumeric: 'tabular-nums' }}>
                        {POINT_RANGES[cat][size].min}-{POINT_RANGES[cat][size].max} pts
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div className="p-6 rounded-xl border" style={{ background: C.depth, borderColor: C.border }}>
              <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: C.accent, marginBottom: 6 }}>
                Deadlines by size
              </p>
              <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute, lineHeight: 1.65 }}>
                Small tasks are due {DEADLINE_DAYS.small} days after you claim them, medium {DEADLINE_DAYS.medium} days and large {DEADLINE_DAYS.large} days. You can ask once for a deadline extension.
              </p>
            </div>
            <div className="p-6 rounded-xl border" style={{ background: C.depth, borderColor: C.border }}>
              <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: C.accent, marginBottom: 6 }}>
                Fair claiming
              </p>
              <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute, lineHeight: 1.65 }}>
                Each task goes to the first contributor to claim it. You can hold up to {DEFAULT_MAX_CLAIMS} tasks at once, and a task you unclaim can be claimed again by you after {CLAIM_COOLDOWN_HOURS} hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 text-center relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${C.void}, ${C.depth})` }}>
        <div className="absolute pointer-events-none" aria-hidden="true" style={{ width: 600, height: 400, maxWidth: '100%', background: `radial-gradient(ellipse, ${tint('--orange', 12)} 0%, transparent 70%)`, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <div className="relative z-10 max-w-xl mx-auto px-8 lg:px-14">
          <h2 className="mb-5" style={{ ...h2, fontSize: 'clamp(28px,4vw,52px)' }}>Ready to build?</h2>
          <p className="mb-10" style={{ fontFamily: F.body, fontWeight: 300, fontSize: 16, color: C.mute, lineHeight: 1.78 }}>
            Browse the open task board to see what needs building right now.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/tasks" className="btn-primary">Browse tasks</Link>
            <Link href="/leaderboard" className="btn-outline">View leaderboard</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
