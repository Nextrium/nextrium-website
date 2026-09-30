import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { validateEmailInput } from '@/lib/email/compose'
import { sendEmail } from '@/lib/email/send'
import { getVerifiedDashboardRole } from '@/lib/dashboard/getRole'
import { isRestricted } from '@/lib/dashboard/accessControl'

// This route sends real email through Brevo using Nextrium's own sender
// identity. It has two legitimate callers: agents-engine's automatic
// dispatch (server-to-server, no browser session — authenticates with the
// shared AGENTS_ENGINE_API_KEY it already sends on every call) and the
// dashboard's manual composer (a signed-in recruiter whose role is allowed
// onto the /dashboard/email page in the first place). Without checking
// either, this was reachable by anyone who found the URL, who could then
// send arbitrary content to arbitrary addresses from our sender identity
// at our Brevo cost — an open relay. Role check reuses the exact same
// BLOCKED_PATHS list the /dashboard/email page itself is gated by
// (lib/dashboard/accessControl.ts), so a role blocked from that page in
// the UI can't reach the same capability by calling this route directly.
async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const configuredKey = process.env.AGENTS_ENGINE_API_KEY

  if (configuredKey && bearerToken) {
    try {
      const a = Buffer.from(bearerToken, 'utf8')
      const b = Buffer.from(configuredKey, 'utf8')
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true
    } catch {
      // fall through to session check
    }
  }

  // This route is not covered by proxy.ts, so the session must be verified
  // with the auth server here (getVerifiedDashboardRole) rather than read
  // from the cookie. No session, an unverifiable one, or an account with no
  // dashboard_users row all resolve to 'none', which isRestricted denies.
  const role = await getVerifiedDashboardRole()
  return !isRestricted('/dashboard/email', role)
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, message, recipients, sender_id, fileAttachments } = body

    const invalid = validateEmailInput({ subject, message, recipients })
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    // Sender lookup, the branded wrapper, archived-recipient suppression and
    // email_logs logging all live in sendEmail, so no caller can skip them.
    const { results } = await sendEmail({
      subject,
      message,
      recipients,
      senderId: sender_id,
      fileAttachments,
      sentBy: 'dashboard',
    })

    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('Email route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong.' },
      { status: 500 }
    )
  }
}