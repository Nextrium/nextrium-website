import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { liveAlertDeps } from '@/lib/alerts/live'
import { alertOverdue } from '@/lib/alerts/server'

// Daily, 08:00 Lagos (Vercel cron, see vercel.json): tells task creators about
// running tasks, team and portal, whose deadline passed with nothing
// submitted. Each missed deadline is reported once. Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused.

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
    return NextResponse.json({ overdue: await alertOverdue(liveAlertDeps()) })
  } catch (err) {
    console.error('[alerts] overdue run failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not run' }, { status: 500 })
  }
}
