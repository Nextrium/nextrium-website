import { brand } from '@nextrium/brand'
import { signAlert, type AlertEvent } from '@nextrium/contributions-core/alertSignature'

// Tells the dashboard that something on a portal task needs staff (work ready
// to review, an extension request). The dashboard looks the event up itself
// and emails the task's creator; this request only says where to look. It is
// signed with PORTAL_ALERT_SECRET, which only the two servers hold.

export const ALERT_TIMESTAMP_HEADER = 'x-nextrium-timestamp'
export const ALERT_SIGNATURE_HEADER = 'x-nextrium-signature'

export interface StaffAlertEnv { secret?: string; dashboardUrl?: string }

/** Sends one signed alert. Never throws; returns whether the dashboard accepted it. */
export async function alertStaff(
  event: AlertEvent,
  id: string,
  env: StaffAlertEnv = { secret: process.env.PORTAL_ALERT_SECRET, dashboardUrl: process.env.DASHBOARD_URL },
  doFetch: typeof fetch = fetch,
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!env.secret) return false
  const base = (env.dashboardUrl || brand.urls.dashboard).replace(/\/+$/, '')
  const body = JSON.stringify({ event, id })
  const ts = now()
  try {
    const res = await doFetch(`${base}/api/alerts/portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ALERT_TIMESTAMP_HEADER]: String(ts), [ALERT_SIGNATURE_HEADER]: signAlert(body, ts, env.secret) },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error('[alerts] dashboard refused the alert:', res.status)
    return res.ok
  } catch (err) {
    console.error('[alerts] could not reach the dashboard:', err instanceof Error ? err.message : err)
    return false
  }
}
