'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logActivityAction } from '@/app/actions/activityLog'
import { useDashboard } from './DashboardContext'

interface HeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export default function Header({ title, description, action }: HeaderProps) {
  const router = useRouter()
  const { toggleSidebar } = useDashboard()

  async function handleSignOut() {
    const supabase = createClient()
    // Log first: the server identifies the actor from the live session,
    // which no longer exists once signOut has run.
    await logActivityAction({ action: 'sign_out' }).catch(() => {})
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <style>{`
        .dash-header { height: 64px; flex-shrink: 0; background: var(--navy); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 32px; gap: 16px; }
        .dash-header-menu-btn { display: none; background: none; border: none; cursor: pointer; color: var(--grey-mid); font-size: 20px; padding: 4px 8px; flex-shrink: 0; transition: color 0.15s ease; line-height: 1; }
        .dash-header-menu-btn:hover { color: var(--white); }
        .dash-header-title { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 700; font-size: 18px; color: var(--white); letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .dash-header-desc { font-size: 12px; color: var(--grey-mid); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dash-header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .dash-signout-btn { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 8px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--grey-mid); background: none; cursor: pointer; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.08); transition: all 0.15s ease; white-space: nowrap; }
        .dash-signout-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
        @media (max-width: 768px) { .dash-header { padding: 0 16px; } .dash-header-menu-btn { display: flex; } .dash-header-desc { display: none; } }
      `}</style>

      <header className="dash-header">
        <button className="dash-header-menu-btn" onClick={toggleSidebar} aria-label="Toggle menu">☰</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="dash-header-title">{title}</div>
          {description && <div className="dash-header-desc">{description}</div>}
        </div>
        <div className="dash-header-right">
          {action}
          <button className="dash-signout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
    </>
  )
}