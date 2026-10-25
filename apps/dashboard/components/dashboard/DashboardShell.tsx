'use client'

import Sidebar from './Sidebar'
import CopilotDrawer from './CopilotDrawer'
import DiscordAccessSync from './DiscordAccessSync'
import LiveRefresh from './LiveRefresh'
import { DashboardProvider } from './DashboardContext'
import type { DashboardRole } from '@/lib/dashboard/getRole'

function ShellInner({ children, role }: { children: React.ReactNode; role: DashboardRole }) {
  return (
    <>
      <style>{`
        .dash-shell { display: flex; min-height: 100vh; background: var(--navy-deep); }
        /* clip, not hidden: hidden turns this box into a scroll container, which stops every
           position: sticky element inside (editor toolbars, side panels) from staying in view
           while the page scrolls. Browsers without clip keep hidden. */
        .dash-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow-x: hidden; overflow-x: clip; overflow-y: visible; }
        .dash-content { flex: 1; padding: 32px; }
        @media (max-width: 768px) { .dash-content { padding: 16px; } }

        /* Branded, thin scrollbars for every scroll container on the
           dashboard (sidebar, candidate lists, sticky detail panels,
           drawers, tables) plus the page/window scrollbar itself. Scoped
           to this component's mount, so it only applies while a dashboard
           route is active. */
        html, body { scrollbar-width: thin; scrollbar-color: var(--orange-f) var(--navy-deep); }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 6px; height: 6px; }
        html::-webkit-scrollbar-track, body::-webkit-scrollbar-track { background: var(--navy-deep); }
        html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb { background: var(--orange-f); border-radius: 3px; }
        html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover { background: var(--orange); }

        .dash-shell { scrollbar-width: thin; scrollbar-color: var(--orange-f) var(--navy-deep); }
        .dash-shell *::-webkit-scrollbar { width: 6px; height: 6px; }
        .dash-shell *::-webkit-scrollbar-track { background: transparent; }
        .dash-shell *::-webkit-scrollbar-thumb { background: var(--orange-f); border-radius: 3px; }
        .dash-shell *::-webkit-scrollbar-thumb:hover { background: var(--orange); }
        .dash-shell *::-webkit-scrollbar-corner { background: transparent; }
      `}</style>
      <div className="dash-shell">
        <Sidebar role={role} />
        <div className="dash-main">{children}</div>
        <CopilotDrawer />
        <DiscordAccessSync />
        <LiveRefresh />
      </div>
    </>
  )
}

export default function DashboardShell({ children, role }: { children: React.ReactNode; role: DashboardRole }) {
  return (
    <DashboardProvider>
      <ShellInner role={role}>{children}</ShellInner>
    </DashboardProvider>
  )
}