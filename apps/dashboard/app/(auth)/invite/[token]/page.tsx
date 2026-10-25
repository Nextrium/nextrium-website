import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceClient } from '@nextrium/supabase/server'
import { brand } from '@nextrium/brand'
import { INVITE_STATE_MESSAGES, findInvite } from '@/lib/dashboard/invites'
import AcceptButton from './AcceptButton'

export const dynamic = 'force-dynamic'
// The token is in the address: never send it on to another site, never index the page.
export const metadata: Metadata = { title: 'Accept invitation', referrer: 'no-referrer', robots: { index: false, follow: false } }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Only looks the link up: opening the page (or an email scanner fetching it) doesn't use it.
  const { state } = await findInvite(createServiceClient(), token)

  return (
    <>
      <style>{`
        .invite-page { min-height: 100vh; background: var(--navy-deep); display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
        .invite-card { width: 100%; max-width: 420px; background: var(--navy); border: 1px solid rgba(255,255,255,0.08); padding: 32px; display: flex; flex-direction: column; gap: 16px; }
        .invite-title { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 800; font-size: 20px; color: var(--white); }
        .invite-text { font-size: 14px; line-height: 1.7; color: var(--grey-light); }
        .invite-btn { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 12px 20px; background: var(--orange); border: 1px solid var(--orange); color: var(--white); cursor: pointer; width: 100%; }
        .invite-btn:disabled { opacity: 0.6; cursor: default; }
        .invite-btn:focus-visible, .invite-link:focus-visible { outline: 2px solid var(--orange-w); outline-offset: 2px; }
        .invite-link { color: var(--orange-w); font-size: 13px; }
        .invite-alert { padding: 10px 14px; font-size: 12px; line-height: 1.5; color: var(--error); border: 1px solid color-mix(in srgb, var(--error) 30%, transparent); background: color-mix(in srgb, var(--error) 8%, transparent); }
      `}</style>
      <main className="invite-page">
        <div className="invite-card">
          <div className="invite-title">{state === 'valid' ? `Join the ${brand.name} dashboard` : 'Invitation unavailable'}</div>
          {state === 'valid' ? (
            <>
              <p className="invite-text">Accept to sign in. Next you&apos;ll choose a password, then complete your profile.</p>
              <AcceptButton token={token} />
            </>
          ) : (
            <>
              <p className="invite-text">{INVITE_STATE_MESSAGES[state]}</p>
              <Link href="/login" className="invite-link">Go to sign in</Link>
            </>
          )}
        </div>
      </main>
    </>
  )
}
