import { NextResponse, type NextRequest } from 'next/server'
import { verifyAlert } from '@nextrium/contributions-core/alertSignature'
import { liveAlertDeps } from '@/lib/alerts/live'
import { alertPortalExtension, alertPortalSubmission } from '@/lib/alerts/server'

// The contributor portal calls this when something on a portal task needs
// staff. The request must be signed with PORTAL_ALERT_SECRET and at most five
// minutes old. It only names a submission or task: everything in the email is
// read from the database here, and each alert is sent at most once.

export const dynamic = 'force-dynamic'

const MAX_BODY = 2_000

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large' }, { status: 413 })
  const check = verifyAlert(raw, request.headers.get('x-nextrium-timestamp'), request.headers.get('x-nextrium-signature'), process.env.PORTAL_ALERT_SECRET)
  if (!check.ok) {
    if (check.reason === 'not configured') console.error('[alerts] PORTAL_ALERT_SECRET is missing or too short')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const deps = liveAlertDeps()
  const result = check.event === 'submission' ? await alertPortalSubmission(deps, check.id) : await alertPortalExtension(deps, check.id)
  return NextResponse.json({ result })
}
