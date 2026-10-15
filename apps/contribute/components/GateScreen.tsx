import Link from 'next/link'
import { brand } from '@nextrium/brand'
import { C, F } from '@/lib/theme'
import type { GateContributor } from '@/lib/portal'
import IconBadge from './IconBadge'
import SignOutButton from './SignOutButton'

// What a signed-in person sees in place of the contributor dashboard until
// their application is approved. Rendered on the server from their record.

const h2: React.CSSProperties = { fontFamily: F.display, fontWeight: 600, fontSize: 28, letterSpacing: '-0.02em', color: C.light, marginBottom: 12 }
const lead: React.CSSProperties = { fontFamily: F.body, fontWeight: 300, fontSize: 15, color: C.mute, lineHeight: 1.75 }
const small: React.CSSProperties = { fontFamily: F.body, fontWeight: 300, fontSize: 13, color: C.dim, lineHeight: 1.75 }
const noteLabel: React.CSSProperties = { fontFamily: F.body, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }
const noteText: React.CSSProperties = { fontFamily: F.body, fontSize: 14, color: C.light, lineHeight: 1.7, whiteSpace: 'pre-wrap' }

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-8 py-16">
      <div className="max-w-md w-full text-center">
        {children}
        <div className="flex justify-center mt-10">
          <SignOutButton className="link-quiet" style={{ background: 'none', border: 'none' }} />
        </div>
      </div>
    </div>
  )
}

function BrowseLinks() {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      <Link href="/tasks" className="btn-primary" style={{ fontSize: 13 }}>
        Browse tasks
      </Link>
      <Link href="/leaderboard" className="btn-outline" style={{ fontSize: 13 }}>
        View leaderboard
      </Link>
    </div>
  )
}

const stroke = { fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round' } as const

export function UnregisteredScreen() {
  return (
    <Frame>
      <div className="mb-8"><IconBadge token="--orange">
        <svg width="32" height="32" viewBox="0 0 32 32" stroke={C.accent} {...stroke}>
          <path d="M16 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM4 28c0-6.627 5.373-12 12-12s12 5.373 12 12" />
        </svg>
      </IconBadge></div>
      <h2 style={h2}>Complete your application</h2>
      <p style={{ ...lead, marginBottom: 32 }}>
        Your email has been verified. Complete your contributor application to get started. The core team will review your profile before activating your account.
      </p>
      <Link href="/register" className="btn-primary" style={{ fontSize: 14 }}>
        Complete your application
      </Link>
    </Frame>
  )
}

export function StatusScreen({ contributor }: { contributor: GateContributor }) {
  const name = contributor.name

  if (contributor.status === 'pending') {
    return (
      <Frame>
        <div className="mb-8"><IconBadge token="--gold">
          <svg width="32" height="32" viewBox="0 0 32 32" stroke={C.gold} {...stroke}>
            <circle cx="16" cy="16" r="12" />
            <path d="M16 10v6l4 4" />
          </svg>
        </IconBadge></div>
        <h2 style={h2}>Application under review</h2>
        <p style={{ ...lead, marginBottom: 12 }}>
          Hi {name}, your application has been received and is being reviewed by the core team. You will receive an email once your account is activated.
        </p>
        <p style={{ ...small, marginBottom: 32 }}>In the meantime you can browse open tasks and the public leaderboard.</p>
        <BrowseLinks />
      </Frame>
    )
  }

  if (contributor.status === 'revision_requested') {
    return (
      <Frame>
        <div className="mb-8"><IconBadge token="--slate-l">
          <svg width="32" height="32" viewBox="0 0 32 32" stroke={C.info} {...stroke}>
            <path d="M4 20l6-6 5 5 8-10" />
            <path d="M28 8h-6M28 8v6" />
          </svg>
        </IconBadge></div>
        <h2 style={h2}>Updates needed</h2>
        <p style={{ ...lead, marginBottom: 24 }}>
          Hi {name}, the core team has reviewed your application and needs some updates before they can proceed.
        </p>
        {contributor.revision_notes && (
          <div className="p-5 rounded-2xl border mb-7 text-left" style={{ background: C.depth, borderColor: C.border }}>
            <p style={{ ...noteLabel, color: C.info }}>Feedback from the core team</p>
            <p style={noteText}>{contributor.revision_notes}</p>
          </div>
        )}
        <p style={{ ...small, marginBottom: 28 }}>
          Update your application and it will be resubmitted for review automatically.
        </p>
        <Link href="/register" className="btn-primary" style={{ fontSize: 13 }}>
          Update your application
        </Link>
      </Frame>
    )
  }

  if (contributor.status === 'rejected') {
    return (
      <Frame>
        <div className="mb-8"><IconBadge token="--grey-mid">
          <svg width="32" height="32" viewBox="0 0 32 32" stroke={C.mute} {...stroke}>
            <circle cx="16" cy="16" r="12" />
            <path d="M12 12l8 8M20 12l-8 8" />
          </svg>
        </IconBadge></div>
        <h2 style={h2}>Application not approved</h2>
        <p style={{ ...lead, marginBottom: 24 }}>
          Hi {name}, thank you for your interest in contributing to {brand.name}. Unfortunately we are unable to approve your application at this time.
        </p>
        {contributor.rejection_reason && (
          <div className="p-5 rounded-2xl border mb-8 text-left" style={{ background: C.depth, borderColor: C.border }}>
            <p style={{ ...noteLabel, color: C.mute }}>Reason</p>
            <p style={noteText}>{contributor.rejection_reason}</p>
          </div>
        )}
        <p style={{ ...small, marginBottom: 28 }}>You are welcome to continue browsing the public task board and leaderboard.</p>
        <BrowseLinks />
      </Frame>
    )
  }

  // inactive, and any status this portal does not know: no access.
  return (
    <Frame>
      <div className="mb-8"><IconBadge token="--grey-mid">
        <svg width="32" height="32" viewBox="0 0 32 32" stroke={C.mute} {...stroke}>
          <rect x="3" y="11" width="26" height="18" rx="2" />
          <path d="M9 11V8a7 7 0 0 1 14 0v3" />
        </svg>
      </IconBadge></div>
      <h2 style={h2}>Account deactivated</h2>
      <p style={{ ...lead, marginBottom: 32 }}>
        Your contributor account has been deactivated. Contact the core team at {brand.emails.contributors} if you believe this is an error.
      </p>
      <Link href="/" className="btn-outline" style={{ fontSize: 13 }}>
        Back to contribute
      </Link>
    </Frame>
  )
}
