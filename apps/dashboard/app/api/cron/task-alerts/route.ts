import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { liveAlertDeps } from '@/lib/alerts/live'
import { alertOverdue } from '@/lib/alerts/server'
import { liveRecurringDeps, processRecurringTaskLifecycle, runDueRecurringSchedules } from '@/lib/contributions/recurringServer'

// Daily, 08:00 Lagos (Vercel cron, see vercel.json):
//   1. Tells task creators about normal tasks whose deadline passed with nothing submitted.
//   2. Spawns due recurring task cycles.
//   3. Runs the recurring lifecycle (24h reminder -> 3-day draft -> auto-delete if unsubmitted).
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
}

export async function GET(request: NextRequest) {
  if (!authorised(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const recurringDeps = liveRecurringDeps()
    const [overdue, recurringSpawned, recurringLifecycle] = await Promise.all([
      alertOverdue(liveAlertDeps()),
      runDueRecurringSchedules(recurringDeps),
      processRecurringTaskLifecycle(recurringDeps),
    ])
    return NextResponse.json({ overdue, recurringSpawned, recurringLifecycle })
  } catch (err) {
    console.error('[alerts] daily task run failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not run' }, { status: 500 })
  }
}
