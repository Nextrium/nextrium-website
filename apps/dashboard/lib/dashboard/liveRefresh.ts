// When the dashboard re-fetches the current page's data in place (a soft
// refresh: typed input, open panels and scroll position are kept).

export const INTERVAL_MS = 60_000
export const MIN_GAP_MS = 15_000

// Pages that only refresh when you come back to the tab, never on the timer:
// they call outside services on every load (Discord, the agents engine), page
// their data, or run their own progress polling.
export const NO_TIMER_PREFIXES = [
  '/settings/automations',
  '/ai-engine',
  '/applications',
  '/logs',
]

export type RefreshTrigger = 'timer' | 'return'

export interface RefreshState {
  trigger: RefreshTrigger
  pathname: string
  visible: boolean
  editing: boolean
  msSinceLast: number
}

export function shouldRefresh(s: RefreshState): boolean {
  if (!s.visible || s.editing) return false
  if (s.msSinceLast < MIN_GAP_MS) return false
  if (s.trigger === 'timer' && NO_TIMER_PREFIXES.some((p) => s.pathname === p || s.pathname.startsWith(p + '/'))) return false
  return true
}
