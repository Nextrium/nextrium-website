'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import NTMark from '@/components/shared/NTMark'
import { useDashboard } from './DashboardContext'
import type { DashboardRole } from '@/lib/dashboard/getRole'

// Sub-navigation shown under "Applications" while on that page — real
// links (?status=...) rather than in-page tab state, so a status view is
// bookmarkable and reachable straight from the sidebar without scrolling.
const APPLICATIONS_SUB_ITEMS = [
  { label: 'All',         status: 'all' },
  { label: 'Pending',     status: 'pending' },
  { label: 'Reviewed',    status: 'reviewed' },
  { label: 'Shortlisted', status: 'shortlisted' },
  { label: 'Accepted',    status: 'accepted' },
  { label: 'Rejected',       status: 'rejected' },
  { label: 'Rebuttals',      status: 'rebuttal' },
  { label: 'Human Reviewed', status: 'human-reviewed' },
  { label: 'Track Review',   status: 'track-review' },
]

const ALL_NAV_GROUPS = [
  {
    label: 'Content',
    roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[],
    items: [
      { label: 'Overview',           href: '/dashboard',                    icon: '◈', roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[] },
      { label: 'Posts',              href: '/dashboard/posts',              icon: '✦', roles: ['admin', 'content', 'moderator'] as DashboardRole[] },
      { label: 'Products',           href: '/dashboard/products',           icon: '◈', roles: ['admin', 'content', 'moderator'] as DashboardRole[] },
      { label: 'Events',             href: '/dashboard/events',             icon: '◉', roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[] },
      { label: 'Roles',              href: '/dashboard/roles',              icon: '◎', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Community Projects', href: '/dashboard/community-projects', icon: '◈', roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[] },
      { label: 'Team',               href: '/dashboard/team',               icon: '◈', roles: ['admin', 'moderator'] as DashboardRole[] },
    ],
  },
  {
    label: 'Inbox',
    roles: ['admin', 'moderator'] as DashboardRole[],
    items: [
      { label: 'Applications', href: '/dashboard/applications', icon: '◐', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Contact',      href: '/dashboard/contact',      icon: '◑', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Send Email',   href: '/dashboard/email',        icon: '✉', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'AI Engine',    href: '/dashboard/ai-engine',    icon: '⚡', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Activity Logs', href: '/dashboard/logs',        icon: '☰', roles: ['admin'] as DashboardRole[] },
    ],
  },
  {
    label: 'Settings',
    roles: ['admin'] as DashboardRole[],
    items: [
      { label: 'Team Access', href: '/dashboard/settings/team', icon: '◈', roles: ['admin'] as DashboardRole[] },
    ],
  },
]

export default function Sidebar({ role }: { role: DashboardRole }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { sidebarOpen, closeSidebar } = useDashboard()
  const activeStatus = searchParams.get('status') ?? 'all'
  const isApplicationsActive = pathname === '/dashboard/applications' || pathname.startsWith('/dashboard/applications/')
  const [subNavOpen, setSubNavOpen] = useState(isApplicationsActive)

  // Auto-expand when navigating onto Applications; leave the user's manual
  // collapse alone otherwise.
  useEffect(() => {
    if (isApplicationsActive) setSubNavOpen(true)
  }, [isApplicationsActive])

  const navGroups = ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.roles.includes(role) && group.items.length > 0)

  useEffect(() => {
    closeSidebar()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        .sidebar-overlay { display: none; position: fixed; inset: 0; z-index: 39; background: rgba(7,22,40,0.7); backdrop-filter: blur(2px); }
        .sidebar-overlay.open { display: block; }
        .sidebar { width: 240px; flex-shrink: 0; background: var(--navy); border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; height: 100vh; position: sticky; top: 0; z-index: 40; transition: transform 0.25s ease; }
        .sidebar-logo { flex-shrink: 0; padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .sidebar-wordmark { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 900; font-size: 18px; letter-spacing: -0.3px; color: var(--off-white); }
        .sidebar-wordmark span { color: var(--orange); }
        .sidebar-badge { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); background: rgba(219,103,39,0.1); border: 1px solid rgba(219,103,39,0.2); padding: 2px 6px; margin-left: auto; }
        /* Nav scrolls on its own; logo and footer stay pinned in place
           regardless of how long the nav (with sub-navs open) gets. */
        .sidebar-nav { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 0; }
        .sidebar-group { margin-bottom: 8px; }
        .sidebar-group-label { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--grey-dark); padding: 8px 20px 4px; }
        .sidebar-item-row {
          display: flex; align-items: center; justify-content: space-between;
          border-left: 2px solid transparent; margin: 1px 0;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .sidebar-item-row.toggle { width: 100%; background: none; border: none; border-left: 2px solid transparent; cursor: pointer; font: inherit; text-align: left; }
        .sidebar-item-row:hover { background: rgba(255,255,255,0.04); }
        .sidebar-item-row.active { background: rgba(219,103,39,0.08); border-left-color: var(--orange); }
        .sidebar-item { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 9px 20px; text-decoration: none; font-size: 13px; color: var(--grey-mid); transition: color 0.15s ease; }
        .sidebar-item-row:hover .sidebar-item, .sidebar-item-row.active .sidebar-item { color: var(--white); }
        .sidebar-icon { font-size: 10px; color: inherit; opacity: 0.6; flex-shrink: 0; }
        .sidebar-item-row.active .sidebar-icon { opacity: 1; color: var(--orange); }
        .sidebar-subnav-toggle {
          font-size: 15px; line-height: 1; color: var(--grey-mid); flex-shrink: 0;
          padding: 9px 18px 9px 6px; transition: transform 0.2s ease, color 0.15s ease;
        }
        .sidebar-item-row:hover .sidebar-subnav-toggle { color: var(--white); }
        .sidebar-subnav-toggle.open { transform: rotate(180deg); }
        .sidebar-item-row.active .sidebar-subnav-toggle { color: var(--orange); }
        .sidebar-subnav { display: flex; flex-direction: column; padding: 2px 0 6px; }
        .sidebar-subitem {
          padding: 6px 20px 6px 42px; text-decoration: none; font-size: 12px;
          color: var(--grey-mid); transition: all 0.15s ease; border-left: 2px solid transparent;
        }
        .sidebar-subitem:hover { color: var(--white); background: rgba(255,255,255,0.03); }
        .sidebar-subitem.active { color: var(--orange); border-left-color: var(--orange); background: rgba(219,103,39,0.06); }
        .sidebar-footer { flex-shrink: 0; padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .sidebar-footer-link { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--grey-mid); text-decoration: none; padding: 8px 0; transition: color 0.15s ease; }
        .sidebar-footer-link:hover { color: var(--white); }
        .sidebar-footer-link + .sidebar-footer-link { border-top: 1px solid rgba(255,255,255,0.04); }
        @media (max-width: 768px) {
          .sidebar { position: fixed; top: 0; left: 0; bottom: 0; height: 100dvh; transform: translateX(-100%); }
          .sidebar.mobile-open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.4); }
        }
      `}</style>

      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />

      <aside className={`sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
        <Link href="/dashboard" className="sidebar-logo">
          <NTMark size={28} />
          <span className="sidebar-wordmark">Nex<span>T</span>rium</span>
          <span className="sidebar-badge">Admin</span>
        </Link>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => {
                const isActive = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                const isApplications = item.href === '/dashboard/applications'
                return (
                  <div key={item.href}>
                    {isApplications ? (
                      <button
                        type="button"
                        className={`sidebar-item-row toggle ${isActive ? 'active' : ''}`}
                        onClick={() => setSubNavOpen((v) => !v)}
                        aria-label={subNavOpen ? 'Collapse Applications sub-navigation' : 'Expand Applications sub-navigation'}
                        aria-expanded={subNavOpen}
                      >
                        <span className="sidebar-item">
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </span>
                        <span className={`sidebar-subnav-toggle ${subNavOpen ? 'open' : ''}`}>▾</span>
                      </button>
                    ) : (
                      <div className={`sidebar-item-row ${isActive ? 'active' : ''}`}>
                        <Link href={item.href} className="sidebar-item">
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </Link>
                      </div>
                    )}
                    {isApplications && subNavOpen && (
                      <div className="sidebar-subnav">
                        {APPLICATIONS_SUB_ITEMS.map((sub) => {
                          const subActive = activeStatus === sub.status
                          const href = sub.status === 'all' ? item.href : `${item.href}?status=${sub.status}`
                          return (
                            <Link key={sub.status} href={href} className={`sidebar-subitem ${subActive ? 'active' : ''}`}>
                              {sub.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link href="/" className="sidebar-footer-link" target="_blank">↗ View site</Link>
          <Link href="/dashboard/settings" className="sidebar-footer-link">⚙ Settings</Link>
        </div>
      </aside>
    </>
  )
}