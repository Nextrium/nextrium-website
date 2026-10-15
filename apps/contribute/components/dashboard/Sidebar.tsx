'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import Wordmark from '@nextrium/brand/Wordmark'
import { signOut } from '@/app/actions/auth'
import { C, F, tint } from '@/lib/theme'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' } as const

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: <><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></> },
  { label: 'My tasks', href: '/dashboard?tab=tasks', icon: <><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 8l2 2 4-4" /></> },
  { label: 'Tasks', href: '/dashboard/tasks', icon: <><rect x="1" y="1" width="14" height="14" rx="2" /><path d="M4 5h8M4 8h6M4 11h4" /></> },
  { label: 'Submissions', href: '/dashboard?tab=submissions', icon: <path d="M8 1v14M1 8h14" /> },
  { label: 'Leaderboard', href: '/dashboard/leaderboard', icon: <path d="M1 12h3V6H1zM6 12h3V3H6zM11 12h3V8h-3z" /> },
  { label: 'Profile', href: '/dashboard?tab=profile', icon: <><circle cx="8" cy="5" r="3" /><path d="M1 14c0-3.314 3.134-6 7-6s7 2.686 7 6" /></> },
]

function isActive(href: string, pathname: string, tab: string | null): boolean {
  const [path, query] = href.split('?')
  const itemTab = new URLSearchParams(query ?? '').get('tab')
  if (itemTab) return pathname === path && tab === itemTab
  if (path === '/dashboard') return pathname === '/dashboard' && !tab
  return pathname === path || pathname.startsWith(`${path}/`)
}

function Pane({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname()
  const tab = useSearchParams().get('tab')

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b" style={{ borderColor: C.border }}>
        <Link href="/" onClick={onNavigate} style={{ textDecoration: 'none' }} aria-label="Contribute home">
          <Wordmark size="sm" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Dashboard">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname, tab)
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className="side-link flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: active ? tint('--orange', 12) : undefined,
                    color: active ? C.accent : C.mute,
                    border: `1px solid ${active ? tint('--orange', 22) : 'transparent'}`,
                    textDecoration: 'none',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke} aria-hidden="true" style={{ flexShrink: 0 }}>{item.icon}</svg>
                  <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: active ? 500 : 400 }}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-3 py-4 border-t" style={{ borderColor: C.border }}>
        <Link href="/" onClick={onNavigate} className="side-link flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ color: C.mute, textDecoration: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" {...stroke} aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
          <span style={{ fontFamily: F.body, fontSize: 13 }}>Back to site</span>
        </Link>
        <form action={signOut}>
          <button type="submit" className="side-link side-link-danger flex items-center gap-3 px-3 py-2.5 rounded-xl w-full" style={{ color: C.mute, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" {...stroke} aria-hidden="true"><path d="M6 2H2v12h4M11 5l3 3-3 3M14 8H6" /></svg>
            <span style={{ fontFamily: F.body, fontSize: 13 }}>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  )
}

function SidebarInner() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40" style={{ width: 240, background: C.depth, borderRight: `1px solid ${C.border}` }}>
        <Pane onNavigate={() => {}} />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 glass" style={{ height: 60, borderBottom: `1px solid ${C.border}` }}>
        <Link href="/" style={{ textDecoration: 'none' }} aria-label="Contribute home"><Wordmark size="sm" /></Link>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="dashboard-drawer" aria-label={open ? 'Close menu' : 'Open menu'} style={{ color: C.mute, background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" {...stroke} aria-hidden="true">{open ? <path d="M4 4l12 12M16 4L4 16" /> : <path d="M3 6h14M3 10h14M3 14h14" />}</svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50" style={{ background: tint('--navy-deep', 60), backdropFilter: 'blur(4px)' }} onClick={() => setOpen(false)}>
          <div id="dashboard-drawer" className="absolute left-0 top-0 bottom-0 flex flex-col" style={{ width: 260, background: C.depth, borderRight: `1px solid ${C.border}` }} onClick={(e) => e.stopPropagation()}>
            <Pane onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}

export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  )
}
