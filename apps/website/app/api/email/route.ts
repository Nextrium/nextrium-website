import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { validateEmailInput } from '@nextrium/email/compose'
import { sendEmail } from '@nextrium/email/send'

// Server-to-server only: agents-engine's automatic dispatch and this site's own
// applicant-report flows, all authenticated with AGENTS_ENGINE_API_KEY. The
// public website has no staff sessions; the dashboard's composer uses the
// dashboard's own /api/email.
async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('Authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const configuredKey = process.env.AGENTS_ENGINE_API_KEY
  if (!configuredKey || !bearerToken) return false
  try {
    const a = Buffer.from(bearerToken, 'utf8')
    const b = Buffer.from(configuredKey, 'utf8')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
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
