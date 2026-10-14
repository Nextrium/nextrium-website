import { NextResponse } from 'next/server'
import { getVerifiedDashboardRole } from '@/lib/dashboard/getRole'
import { isRestricted } from '@/lib/dashboard/accessControl'
import { validateEmailInput } from '@nextrium/email/compose'
import { sendEmail } from '@nextrium/email/send'

// Staff-only: the dashboard's Send Email composer and applicant emails. Server
// callers (agents-engine) use the website's /api/email with the server key.
async function isAuthorized(_request: Request): Promise<boolean> {
  // Not covered by proxy.ts, so the session is verified with the auth server
  // here. No session, an unverifiable one or no dashboard_users row resolve
  // to 'none', which isRestricted denies; roles blocked from the Send Email
  // page are blocked here too.
  const role = await getVerifiedDashboardRole()
  return !isRestricted('/email', role)
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
