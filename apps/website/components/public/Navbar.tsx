'use client'

import Link from 'next/link'
import { useState } from 'react'
import Wordmark from '@nextrium/brand/Wordmark'

const NAV_LINKS = [
  { label: 'Products', href: '/products' },
  { label: 'Services', href: '/services' },
  { label: 'Events',   href: '/events'   },
  { label: 'Hub',      href: '/hub'      },
  { label: 'Blog',     href: '/blog'     },
  { label: 'About',    href: '/about'    },
  { label: 'Careers',  href: '/careers'  },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <style>{`
        .navbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: var(--nav-height);
          background: rgba(7,22,40,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .navbar-inner {
          display: flex; align-items: center; justify-content: space-between;
          height: 100%;
          max-width: var(--max-width);
          margin-inline: auto;
          padding-inline: var(--container-px);
        }
        .navbar-links {
          display: flex; align-items: center; gap: 32px; list-style: none;
        }
        .navbar-links a {
          font-size: 14px; color: var(--grey-mid); text-decoration: none;
          transition: color var(--transition-base); white-space: nowrap;
        }
        .navbar-links a:hover { color: var(--white); }
        .navbar-contact {
          font-size: 13px; font-weight: 500; color: var(--white);
          text-decoration: none; padding: 8px 20px;
          border: 1px solid rgba(255,255,255,0.25);
          transition: border-color var(--transition-base); white-space: nowrap;
        }
        .navbar-contact:hover { border-color: var(--orange); }
        .navbar-ham {
          display: none; flex-direction: column; gap: 5px;
          cursor: pointer; background: none; border: none;
          padding: 4px; margin-left: 16px;
        }
        .navbar-ham span {
          display: block; width: 22px; height: 2px; background: var(--white);
          transition: transform var(--transition-base), opacity var(--transition-base);
        }
        .mobile-menu {
          display: none; position: fixed;
          top: var(--nav-height); left: 0; right: 0;
          background: var(--navy-deep);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 24px var(--container-px) 32px; z-index: 99;
        }
        .mobile-menu.open { display: flex; flex-direction: column; gap: 0; }
        .mobile-menu a {
          font-size: 18px; color: var(--grey-mid); text-decoration: none;
          padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
          transition: color var(--transition-base);
        }
        .mobile-menu a:hover { color: var(--white); }
        .mobile-menu-contact {
          margin-top: 24px; font-size: 14px; font-weight: 500;
          color: var(--white); text-decoration: none;
          padding: 14px 24px; border: 1px solid rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: space-between;
        }
        @media (max-width: 768px) {
          .navbar-links { display: none; }
          .navbar-ham   { display: flex; }
        }
      `}</style>

      <header className="navbar" role="banner">
        <div className="navbar-inner">
          <Link href="/" aria-label="NexTrium home">
            <Wordmark size="md" variant="dark" />
          </Link>
          <nav aria-label="Main navigation">
            <ul className="navbar-links">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Link href="/contact" className="navbar-contact">Contact →</Link>
            <button
              className="navbar-ham"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen}>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href="/contact" className="mobile-menu-contact" onClick={() => setMenuOpen(false)}>
          <span>Contact</span>
          <span>→</span>
        </Link>
      </div>
    </>
  )
}