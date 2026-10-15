import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { brand } from '@nextrium/brand'
import { COMPLEXITY_LABELS, type Complexity } from '@nextrium/contributions-core/constants'
import PublicShell from '@/components/PublicShell'
import { BackLink } from '@/components/PageHeader'
import { CategoryBadge, NeutralBadge } from '@/components/Badges'
import { getPublicProfile, isSignedIn } from '@/lib/publicData'
import { publicName } from '@/lib/ranking'
import { C, F, categoryToken, tint } from '@/lib/theme'
import CopyLinkButton from './CopyLinkButton'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const profile = await getPublicProfile(id)
  if (!profile) return { title: 'Contributor not found', robots: { index: false } }
  const name = publicName(profile.contributor)
  const { total_points, verified_contributions } = profile.contributor
  const description = `${name} has ${verified_contributions} verified contribution${verified_contributions === 1 ? '' : 's'} and ${total_points.toLocaleString('en-GB')} points as a ${brand.name} contributor.`
  return {
    title: name,
    description,
    alternates: { canonical: `/contributors/${id}` },
    openGraph: { title: `${name} | ${brand.styledName} Contribute`, description, url: `/contributors/${id}`, type: 'profile' },
  }
}

export default async function ContributorProfilePage({ params }: Props) {
  const { id } = await params
  const [profile, signedIn] = await Promise.all([getPublicProfile(id), isSignedIn()])

  if (!profile) notFound()

  const { contributor, contributions } = profile
  const name = publicName(contributor)
  const token = categoryToken(contributor.categories[0])

  return (
    <PublicShell signedIn={signedIn}>
      <div className="bg-void pt-20 pb-28">
        <div className="max-w-3xl mx-auto px-8 lg:px-14">
          <BackLink href="/leaderboard" label="Leaderboard" current={name} />

          <div className="flex items-start gap-5 sm:gap-6 mb-10">
            <div className="flex-shrink-0 flex items-center justify-center rounded-full" aria-hidden="true" style={{ width: 72, height: 72, background: tint(token, 10), border: `2px solid ${tint(token, 22)}` }}>
              <span style={{ fontFamily: F.display, fontWeight: 600, fontSize: 28, color: `var(${token})` }}>{name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(22px,3vw,32px)', letterSpacing: '-0.02em', color: C.light, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{name}</h1>
                {contributor.contributor_type === 'team' && <NeutralBadge size="md">Team</NeutralBadge>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {contributor.categories.map((cat) => <CategoryBadge key={cat} category={cat} size="md" />)}
                {contributor.location && <span style={{ fontFamily: F.body, fontSize: 12, color: C.mute }}>{contributor.location}</span>}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 mb-10">
            <div className="flex flex-col-reverse gap-2 p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
              <dt style={{ fontFamily: F.body, fontSize: 12, color: C.mute }}>Total points</dt>
              <dd style={{ fontFamily: F.display, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: `var(${token})`, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {contributor.total_points.toLocaleString('en-GB')}
              </dd>
            </div>
            <div className="flex flex-col-reverse gap-2 p-6 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
              <dt style={{ fontFamily: F.body, fontSize: 12, color: C.mute }}>Verified contributions</dt>
              <dd style={{ fontFamily: F.display, fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', color: C.accent, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {contributor.verified_contributions}
              </dd>
            </div>
          </dl>

          <section>
            <h2 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em', color: C.light, marginBottom: 16 }}>Verified contributions</h2>
            {contributions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
                <p style={{ fontFamily: F.body, fontSize: 14, color: C.mute }}>No verified contributions yet.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {contributions.map((w) => {
                  const wToken = categoryToken(w.category)
                  return (
                    <li key={w.id} className="flex items-center gap-4 p-5 rounded-2xl border" style={{ background: C.depth, borderColor: C.border }}>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: F.display, fontWeight: 600, fontSize: 14, color: C.light, marginBottom: 6, overflowWrap: 'anywhere' }}>{w.title}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <CategoryBadge category={w.category} />
                          <span style={{ fontFamily: F.body, fontSize: 11, color: C.dim }}>{COMPLEXITY_LABELS[w.complexity as Complexity] ?? w.complexity}</span>
                          {w.verified_at && (
                            <span style={{ fontFamily: F.body, fontSize: 11, color: C.dim }}>
                              {new Date(w.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                            </span>
                          )}
                          {w.evidence_url && (
                            <a href={w.evidence_url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1" style={{ textDecoration: 'none' }}>
                              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                                <path d="M3.5 1.5H1.5v8h8V7.5M6.5 1.5h3v3M5 6l4.5-4.5" />
                              </svg>
                              <span style={{ fontFamily: F.body, fontSize: 11, color: C.accent }}>View evidence</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div style={{ fontFamily: F.display, fontWeight: 600, fontSize: 18, color: `var(${wToken})`, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{w.points}</div>
                        <div style={{ fontFamily: F.body, fontSize: 10, color: C.mute, marginTop: 2 }}>pts</div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="mt-10 p-6 rounded-2xl border text-center" style={{ background: C.depth, borderColor: C.border }}>
            <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute, lineHeight: 1.7, marginBottom: 12 }}>
              This is a verifiable public record of contributions to {brand.name}. Share this page as proof of work.
            </p>
            <CopyLinkButton path={`/contributors/${contributor.id}`} />
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
