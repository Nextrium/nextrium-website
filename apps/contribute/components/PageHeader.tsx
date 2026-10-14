import Link from 'next/link'
import { C, F } from '@/lib/theme'

/** Breadcrumb, title and intro at the top of the public list pages. */
export default function PageHeader({ crumb, title, intro }: { crumb: string; title: string; intro: string }) {
  return (
    <div className="mb-16">
      <nav aria-label="Breadcrumb" className="flex items-center gap-3 mb-3">
        <Link href="/" className="nav-link">Contribute</Link>
        <span aria-hidden="true" style={{ color: C.dim }}>/</span>
        <span style={{ fontFamily: F.body, fontSize: 13, color: C.mute }}>{crumb}</span>
      </nav>
      <h1 className="mb-4" style={{ fontFamily: F.display, fontWeight: 600, fontSize: 'clamp(32px,5vw,64px)', letterSpacing: '-0.03em', lineHeight: 1.02, color: C.light, textWrap: 'balance' }}>
        {title}
      </h1>
      <p style={{ fontFamily: F.body, fontWeight: 300, fontSize: 16, color: C.mute, maxWidth: 520, lineHeight: 1.75 }}>{intro}</p>
    </div>
  )
}

/** A back link with an arrow, for detail pages. */
export function BackLink({ href, label, current }: { href: string; label: string; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-3 mb-10 min-w-0">
      <Link href={href} className="nav-link flex items-center gap-1.5 flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M9 2L4 7l5 5" />
        </svg>
        {label}
      </Link>
      <span aria-hidden="true" style={{ color: C.dim }}>/</span>
      <span className="truncate" style={{ fontFamily: F.body, fontSize: 13, color: C.dim }}>{current}</span>
    </nav>
  )
}
