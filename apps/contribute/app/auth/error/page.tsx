import type { Metadata } from 'next'
import Link from 'next/link'
import { C, F } from '@/lib/theme'
import IconBadge from '@/components/IconBadge'

export const metadata: Metadata = { title: 'Sign in link expired' }

// Fixed wording per reason: nothing from the URL is shown on the page.
const MESSAGES = {
  expired: {
    title: 'Sign in link expired',
    body: 'Sign in link is invalid or has expired.',
    hint: 'Sign in links expire after 60 minutes and can only be used once. Request a new one to sign in.',
  },
  browser: {
    title: 'Open the link in the same browser',
    body: 'This sign in link has to be opened in the browser you requested it from.',
    hint: 'Request a new link from this browser, or open the email on the device where you asked for it.',
  },
  invalid: {
    title: 'Sign in link not recognised',
    body: 'This address is not a complete sign in link.',
    hint: 'Use the button in the most recent email we sent you, or request a new link.',
  },
} as const

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  const m = MESSAGES[reason === 'browser' || reason === 'invalid' ? reason : 'expired']

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-void">
      <div
        className="flex flex-col items-center gap-6 max-w-md w-full text-center p-10 rounded-2xl border"
        style={{ background: C.depth, borderColor: C.border }}
      >
        <IconBadge token="--orange" size={56}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeWidth="2" />
          </svg>
        </IconBadge>
        <div className="flex flex-col gap-2">
          <h1 style={{ fontFamily: F.display, fontWeight: 600, fontSize: 22, color: C.light, letterSpacing: '-0.02em' }}>
            {m.title}
          </h1>
          <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 14, color: C.mute, lineHeight: 1.7 }}>{m.body}</p>
        </div>
        <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.mute, lineHeight: 1.65 }}>{m.hint}</p>
        <div className="flex flex-col gap-3 w-full">
          <Link href="/signin" className="btn-primary justify-center" style={{ fontSize: 13 }}>
            Request a new sign in link
          </Link>
          <Link href="/" className="btn-outline justify-center" style={{ fontSize: 13 }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
