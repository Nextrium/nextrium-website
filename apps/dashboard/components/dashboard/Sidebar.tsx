'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import NTMark from '@nextrium/brand/Mark'
import { useDashboard } from './DashboardContext'
import type { DashboardRole } from '@/lib/dashboard/getRole'
import { roleBadgeLabel } from '@/lib/dashboard/roleBadge'
import { brand } from '@nextrium/brand'

// Sub-navigation shown under a nav item while on that page — real links
// (a query param) rather than in-page tab state, so a specific view is
// bookmarkable and reachable straight from the sidebar without scrolling.
const APPLICATIONS_SUB_ITEMS = [
  { label: 'All',         value: 'all' },
  { label: 'Pending',     value: 'pending' },
  { label: 'Reviewed',    value: 'reviewed' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Accepted',    value: 'accepted' },
  { label: 'Rejected',       value: 'rejected' },
  { label: 'Rebuttals',      value: 'rebuttal' },
  { label: 'Human Reviewed', value: 'human-reviewed' },
  { label: 'Track Review',   value: 'track-review' },
  { label: 'Archived',       value: 'archived' },
]

const PEOPLE_SUB_ITEMS = [
  { label: 'Staff',                 value: 'staff' },
  { label: 'General Team Members',  value: 'members' },
]

// Contributor portal dropdown: unlike the filter sub-items above, each entry
// is its own page. The portal has its own database; see app/(console)/portal.
const PORTAL_SUB_PAGES = [
  { label: 'Overview',     href: '/portal',              roles: ['admin', 'moderator'] as DashboardRole[] },
  { label: 'Applicants',   href: '/portal/applicants',   roles: ['admin', 'moderator'] as DashboardRole[] },
  { label: 'Tasks',        href: '/portal/tasks',        roles: ['admin', 'moderator'] as DashboardRole[] },
  { label: 'Reviews',      href: '/portal/reviews',      roles: ['admin', 'moderator'] as DashboardRole[] },
  { label: 'Contributors', href: '/portal/contributors', roles: ['admin', 'moderator'] as DashboardRole[] },
  { label: 'Core team',    href: '/portal/team',         roles: ['admin', 'moderator'] as DashboardRole[] },
  { label: 'Audit log',    href: '/portal/audit',        roles: ['admin'] as DashboardRole[] },
]

/** The sub-page that matches the current path: the longest matching href, so /portal only matches its own page. */
function activeSubPage(pathname: string, pages: { href: string }[]): string | null {
  const hits = pages.filter((p) => pathname === p.href || pathname.startsWith(p.href + '/'))
  return hits.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
}

const ALL_NAV_GROUPS = [
  {
    label: 'Content',
    roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[],
    items: [
      { label: 'Overview',           href: '/',                    icon: '◈', roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[] },
      { label: 'Posts',              href: '/posts',              icon: '✦', roles: ['admin', 'content', 'moderator'] as DashboardRole[] },
      { label: 'Products',           href: '/products',           icon: '◈', roles: ['admin', 'content', 'moderator'] as DashboardRole[] },
      { label: 'Events',             href: '/events',             icon: '◉', roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[] },
      { label: 'Roles',              href: '/roles',              icon: '◎', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Community Projects', href: '/community-projects', icon: '◈', roles: ['admin', 'content', 'community', 'moderator'] as DashboardRole[] },
      // Public-facing bios CMS (nextrium.org/team) — distinct from the
      // internal staff/member directory below, which is a different nav
      // item on purpose so the two are never confused.
      { label: 'Team Bios',          href: '/team',               icon: '◈', roles: ['admin', 'moderator'] as DashboardRole[] },
    ],
  },
  {
    label: 'Team',
    roles: ['admin', 'moderator'] as DashboardRole[],
    items: [
      {
        label: 'Team', href: '/people', icon: '◈',
        roles: ['admin', 'moderator'] as DashboardRole[],
        subItems: PEOPLE_SUB_ITEMS, subQueryKey: 'view',
      },
      // Contributor program: staff create and assign tasks to members.
      { label: 'Tasks', href: '/tasks', icon: '◇', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Review queue', href: '/reviews', icon: '◆', roles: ['admin', 'moderator'] as DashboardRole[] },
    ],
  },
  {
    // Contributor program: anyone with dashboard access can be assigned tasks.
    label: 'Contributing',
    roles: ['admin', 'moderator', 'content', 'community', 'member'] as DashboardRole[],
    items: [
      { label: 'My tasks', href: '/my-tasks', icon: '◇', roles: ['admin', 'moderator', 'content', 'community', 'member'] as DashboardRole[] },
      { label: 'Leaderboard', href: '/leaderboard', icon: '▲', roles: ['admin', 'moderator', 'content', 'community', 'member'] as DashboardRole[] },
      // The public contributor portal (its own database): staff run applicants, tasks and reviews here.
      { label: 'Contributor portal', href: '/portal', icon: '◈', roles: ['admin', 'moderator'] as DashboardRole[], subPages: PORTAL_SUB_PAGES },
    ],
  },
  {
    label: 'Inbox',
    roles: ['admin', 'moderator'] as DashboardRole[],
    items: [
      { label: 'Applications', href: '/applications', icon: '◐', roles: ['admin', 'moderator'] as DashboardRole[], subItems: APPLICATIONS_SUB_ITEMS, subQueryKey: 'status' },
      { label: 'Contact',      href: '/contact',      icon: '◑', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Send Email',   href: '/email',        icon: '✉', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'AI Engine',    href: '/ai-engine',    icon: '⚡', roles: ['admin', 'moderator'] as DashboardRole[] },
      { label: 'Activity Logs', href: '/logs',        icon: '☰', roles: ['admin'] as DashboardRole[] },
    ],
  },
  {
    label: 'Settings',
    roles: ['admin'] as DashboardRole[],
    items: [
      { label: 'Team Access', href: '/settings/team', icon: '◈', roles: ['admin'] as DashboardRole[] },
      { label: 'Discord Rules', href: '/settings/automations', icon: '⚙', roles: ['admin'] as DashboardRole[] },
    ],
  },
]

export default function Sidebar({ role }: { role: DashboardRole }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { sidebarOpen, closeSidebar } = useDashboard()
  const badge = roleBadgeLabel(role)

  // Which sub-nav'd item (by href) is currently expanded — generalized from
  // a single Applications-only boolean so any item can carry sub-items.
  const activeSubNavHref = ALL_NAV_GROUPS
    .flatMap((g) => g.items)
    .find((item: any) => (item.subItems || item.subPages) && (pathname === item.href || pathname.startsWith(item.href + '/')))
    ?.href ?? null
  const [openSubNavHref, setOpenSubNavHref] = useState<string | null>(activeSubNavHref)

  // Auto-expand when navigating onto a sub-nav'd item; leave the user's
  // manual collapse of a different one alone otherwise.
  useEffect(() => {
    if (activeSubNavHref) setOpenSubNavHref(activeSubNavHref)
  }, [activeSubNavHref])

  const navGroups = ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      // Moderators see only team members, so the Staff/Members split is admin-only.
      items: group.items
        .filter((item) => item.roles.includes(role))
        .map((item: any) => (item.href === '/people' && role !== 'admin' ? { ...item, subItems: undefined } : item))
        .map((item: any) => (item.subPages ? { ...item, subPages: item.subPages.filter((p: { roles: DashboardRole[] }) => p.roles.includes(role)) } : item)),
    }))
    .filter((group) => group.roles.includes(role) && group.items.length > 0)

  useEffect(() => {
    closeSidebar()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        .sidebar-overlay { display: none; position: fixed; inset: 0; z-index: 39; background: color-mix(in srgb, var(--navy-deep) 70%, transparent); backdrop-filter: blur(2px); }
        .sidebar-overlay.open { display: block; }
        .sidebar { width: 240px; flex-shrink: 0; background: var(--navy); border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; height: 100vh; position: sticky; top: 0; z-index: 40; transition: transform 0.25s ease; }
        .sidebar-logo { flex-shrink: 0; padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .sidebar-wordmark { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 900; font-size: 18px; letter-spacing: -0.3px; color: var(--off-white); }
        .sidebar-wordmark span { color: var(--orange); }
        .sidebar-badge { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 7px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); background: color-mix(in srgb, var(--orange) 10%, transparent); border: 1px solid color-mix(in srgb, var(--orange) 20%, transparent); padding: 2px 6px; margin-left: auto; }
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
        .sidebar-item-row.active { background: color-mix(in srgb, var(--orange) 8%, transparent); border-left-color: var(--orange); }
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
        .sidebar-subitem.active { color: var(--orange); border-left-color: var(--orange); background: color-mix(in srgb, var(--orange) 6%, transparent); }
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
        <Link href="/" className="sidebar-logo">
          <NTMark size={28} />
          <span className="sidebar-wordmark">Nex<span>T</span>rium</span>
          {badge && <span className="sidebar-badge">{badge}</span>}
        </Link>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item: any) => {
                // An item whose path is the parent of another item in the group
                // (e.g. /portal and /portal/applicants) only lights up on its own page.
                const isParent = group.items.some((other: any) => other.href !== item.href && other.href.startsWith(item.href + '/'))
                const isActive = item.href === '/' || isParent
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/')
                const hasSubItems = !!item.subItems?.length
                const isOpen = openSubNavHref === item.href
                const activeSubValue = searchParams.get(item.subQueryKey ?? 'status') ?? item.subItems?.[0]?.value
                if (item.subPages?.length) {
                  // A dropdown of separate pages (Contributor portal): every entry is a plain link.
                  const current = activeSubPage(pathname, item.subPages)
                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        className={`sidebar-item-row toggle ${current ? 'active' : ''}`}
                        onClick={() => setOpenSubNavHref((v) => (v === item.href ? null : item.href))}
                        aria-label={isOpen ? `Collapse ${item.label} sub-navigation` : `Expand ${item.label} sub-navigation`}
                        aria-expanded={isOpen}
                      >
                        <span className="sidebar-item">
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </span>
                        <span className={`sidebar-subnav-toggle ${isOpen ? 'open' : ''}`}>▾</span>
                      </button>
                      {isOpen && (
                        <div className="sidebar-subnav">
                          {item.subPages.map((sub: { label: string; href: string }) => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              className={`sidebar-subitem ${current === sub.href ? 'active' : ''}`}
                              aria-current={current === sub.href ? 'page' : undefined}
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                return (
                  <div key={item.href}>
                    {hasSubItems ? (
                      <button
                        type="button"
                        className={`sidebar-item-row toggle ${isActive ? 'active' : ''}`}
                        onClick={() => setOpenSubNavHref((v) => (v === item.href ? null : item.href))}
                        aria-label={isOpen ? `Collapse ${item.label} sub-navigation` : `Expand ${item.label} sub-navigation`}
                        aria-expanded={isOpen}
                      >
                        <span className="sidebar-item">
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </span>
                        <span className={`sidebar-subnav-toggle ${isOpen ? 'open' : ''}`}>▾</span>
                      </button>
                    ) : (
                      <div className={`sidebar-item-row ${isActive ? 'active' : ''}`}>
                        <Link href={item.href} className="sidebar-item">
                          <span className="sidebar-icon">{item.icon}</span>
                          {item.label}
                        </Link>
                      </div>
                    )}
                    {hasSubItems && isOpen && (
                      <div className="sidebar-subnav">
                        {item.subItems.map((sub: { label: string; value: string }) => {
                          const subActive = activeSubValue === sub.value
                          const href = sub.value === item.subItems[0].value ? item.href : `${item.href}?${item.subQueryKey ?? 'status'}=${sub.value}`
                          return (
                            <Link
                              key={sub.value}
                              href={href}
                              className={`sidebar-subitem ${subActive ? 'active' : ''}`}
                              onClick={(e) => {
                                // Already on this page: the tabs filter data the page
                                // has loaded, so switch by updating the URL only. A
                                // normal link would re-run the whole page on the server
                                // for every tab click.
                                if (pathname !== item.href) return
                                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                                e.preventDefault()
                                window.history.pushState(null, '', href)
                              }}
                            >
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
          <Link href="/people/me" className="sidebar-footer-link">◉ My Profile</Link>
          <a href={brand.urls.website} className="sidebar-footer-link" target="_blank" rel="noopener noreferrer">↗ View site</a>
          {role === 'admin' && (
            <Link href="/settings/team" className="sidebar-footer-link">⚙ Settings</Link>
          )}
        </div>
      </aside>
    </>
  )
}