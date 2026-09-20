import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardRole } from '@/lib/dashboard/getRole'
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

  // getDashboardRole() defaults to 'community' when there's no session at
  // all, and 'community' is itself blocked from /dashboard/email — so an
  // unauthenticated caller is correctly denied here too, with no separate
  // "is there a user" check needed.
  const role = await getDashboardRole()
  return !isRestricted('/dashboard/email', role)
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, message, recipients, sender_id, fileAttachments } = body

    // message may now be rich HTML from the composer (e.g. `<p></p>` when
    // "empty") as well as the plain-text templates automated dispatch still
    // sends — strip tags before checking so an empty editor can't pass here
    // even if the frontend guard is bypassed.
    const messageHasContent = typeof message === 'string' && message.replace(/<[^>]*>/g, '').trim().length > 0

    if (!subject?.trim())           return NextResponse.json({ error: 'Subject is required.' }, { status: 400 })
    if (!messageHasContent)         return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
    if (!recipients?.length)        return NextResponse.json({ error: 'At least one recipient is required.' }, { status: 400 })

    const supabase = createServiceClient()

    let senderName      = 'Nextrium Global Innovations Ltd'
    let senderEmail     = process.env.BREVO_SENDER_EMAIL!
    let signatureName   = 'Abdulbasit Adigun Abdulrahman'
    let signatureTitle  = 'Founder and Chief Executive Officer, Nextrium Global Innovations Ltd'

    if (sender_id) {
      const { data: senderRow } = await supabase
        .from('email_senders')
        .select('name, email, signature_name, signature_title')
        .eq('id', sender_id)
        .single()
      if (senderRow) {
        const row = senderRow as { name: string; email: string; signature_name: string | null; signature_title: string | null }
        senderName     = row.name
        senderEmail    = row.email
        signatureName  = row.signature_name  ?? signatureName
        signatureTitle = row.signature_title ?? signatureTitle
      }
    } else {
      const { data: defaultRow } = await supabase
        .from('email_senders')
        .select('name, email, signature_name, signature_title')
        .eq('is_default', true)
        .single()
      if (defaultRow) {
        const row = defaultRow as { name: string; email: string; signature_name: string | null; signature_title: string | null }
        senderName     = row.name
        senderEmail    = row.email
        signatureName  = row.signature_name  ?? signatureName
        signatureTitle = row.signature_title ?? signatureTitle
      }
    }

    const results: { email: string; success: boolean; error?: string }[] = []

    // True backstop for the archive/do-not-contact feature: every email
    // trigger in this system (manual composer, bulk dispatch, automatic
    // post-screening sends, rebuttal-resolution sends) ultimately calls this
    // route, so this is the one place that guarantees no archived candidate
    // is ever emailed regardless of which path tried to reach them. Matched
    // by email address rather than application ID (this route never
    // receives one) - a candidate who applied to multiple roles is
    // suppressed everywhere once any of their application rows is archived.
    const { data: archivedRows } = await supabase.from('applications').select('email').eq('archived', true)
    const archivedEmails = new Set(
      (archivedRows ?? [])
        .map((r: any) => (r.email || '').trim().toLowerCase())
        .filter(Boolean)
    )

    const sendableRecipients = recipients.filter((r: any) => {
      const email = (r.email || '').trim().toLowerCase()
      if (email && archivedEmails.has(email)) {
        results.push({ email: r.email, success: false, error: 'Recipient is archived — this address must not be contacted.' })
        return false
      }
      return true
    })

    for (const recipient of sendableRecipients) {
      const firstName = recipient.name?.trim().split(' ')[0] ?? 'there'
      const personalised = message
        .replace(/{{name}}/g, firstName)
        .replace(/{{role}}/g, recipient.role ?? 'your applied role')
        .replace(/{{email}}/g, recipient.email ?? '')

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender:  { name: senderName, email: senderEmail },
          to:      [{ email: recipient.email, name: recipient.name }],
          replyTo: { email: senderEmail, name: senderName },
          subject,
          ...(fileAttachments && fileAttachments.length > 0 ? {
            attachment: fileAttachments.map((f: { content: string; name: string }) => ({ content: f.content, name: f.name }))
          } : {}),
          htmlContent: `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <div style="background: #071628; padding: 24px 32px; border-bottom: 3px solid #DB6727;">
      <h2 style="margin: 0; font-size: 20px; color: #ffffff; font-family: sans-serif; letter-spacing: -0.3px;">NexTrium</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #8A9BB0; text-transform: uppercase; letter-spacing: 0.12em;">Global Innovations Ltd</p>
    </div>
    <div style="padding: 32px; background: #ffffff;">
      <div style="font-size: 15px; color: #1a1a2e; line-height: 1.8; white-space: pre-wrap; margin-bottom: 32px;">${personalised}</div>
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e8edf2;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #1a1a2e; font-weight: 600;">${signatureName}</p>
        <p style="margin: 0 0 4px; font-size: 12px; color: #4a5568;">${signatureTitle}</p>
        <p style="margin: 0; font-size: 12px;">
          <a href="mailto:${senderEmail}" style="color: #DB6727; text-decoration: none;">${senderEmail}</a>
          &nbsp;·&nbsp;
          <a href="https://nextrium.org" style="color: #DB6727; text-decoration: none;">nextrium.org</a>
        </p>
      </div>
    </div>
    <div style="background: #071628; padding: 16px 32px;">
      <p style="margin: 0; font-size: 11px; color: #8A9BB0;">NexTrium Global Innovations Ltd · 69 Abeokuta Street, Ilaje Bariga, Lagos 100223, Nigeria</p>
    </div>
  </div>
`,
        }),
      })

      if (res.ok) {
        results.push({ email: recipient.email, success: true })
      } else {
        const err = await res.json()
        results.push({ email: recipient.email, success: false, error: err?.message ?? 'Send failed.' })
      }
    }

    const allSucceeded = results.every((r) => r.success)
    const anySent      = results.some((r) => r.success)

    if (anySent) {
      const successfulEmails = new Set(results.filter((r) => r.success).map((r) => r.email))
      const { error: logError } = await (supabase.from('email_logs') as any).insert({
        subject,
        body:         message,
        recipients:   recipients.filter((r: any) => successfulEmails.has(r.email)),
        sent_by:      'dashboard',
        status:       allSucceeded ? 'sent' : 'partial',
        sender_name:  senderName,
        sender_email: senderEmail,
        attachments: (fileAttachments ?? []).map((f: { name: string }) => ({ type: 'file', value: f.name })),
      })
      if (logError) console.error('Email log insert error:', logError.message)
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('Email route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Something went wrong.' },
      { status: 500 }
    )
  }
}