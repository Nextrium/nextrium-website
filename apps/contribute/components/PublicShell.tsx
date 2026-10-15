import Link from 'next/link'
import Wordmark from '@nextrium/brand/Wordmark'
import { brand } from '@nextrium/brand'
import { C, F } from '@/lib/theme'

const LINKS = [
  { label: 'Overview', href: '/' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Leaderboard', href: '/leaderboard' },
]

/**
 * Header and footer around the portal's public pages. Pass signedIn when the
 * page already knows there is a session, to offer the dashboard, not sign-in.
 */
export default function PublicShell({ children, signedIn = false }: { children: React.ReactNode; signedIn?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-void">
      <header
        className="glass sticky top-0 z-40 border-b"
        style={{ borderColor: C.border }}
      >
        <nav className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6">
          <Link href="/" aria-label={`${brand.name} Contribute home`} className="flex items-center gap-3" style={{ textDecoration: 'none' }}>
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-5">
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="nav-link">
                  {l.label}
                </Link>
              ))}
            </div>
            <Link href={signedIn ? '/dashboard' : '/signin'} className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>
              {signedIn ? 'Dashboard' : 'Sign in'}
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t" style={{ borderColor: C.border }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p style={{ fontFamily: F.body, fontSize: 12, color: C.mute }}>
            © {new Date().getFullYear()} {brand.styledLegalName}
          </p>
          <div className="flex items-center gap-5">
            {LINKS.slice(1).map((l) => (
              <Link key={l.href} href={l.href} className="nav-link" style={{ fontSize: 12 }}>
                {l.label}
              </Link>
            ))}
            <a href={brand.urls.website} className="nav-link" style={{ fontSize: 12 }}>
              {brand.urls.websiteDisplay}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
