// The single path for sending email through Brevo. Server-side only: it uses
// the service-role client and the Brevo key. Every send goes through here, so
// the two guarantees live inside it and no caller can skip them:
//   - archived-application addresses are never emailed
//   - every send with at least one delivery is written to email_logs
// Callers do their own authorization before calling this.
import { createServiceClient } from '@/lib/supabase/server'
import {
  defaultSender,
  personalise,
  splitArchivedRecipients,
  toArchivedEmailSet,
  validateEmailInput,
  wrapBrandedHtml,
  type EmailAttachment,
  type EmailRecipient,
  type SendResult,
  type SenderIdentity,
} from './compose'

export interface SendEmailInput {
  subject: string
  /** Inner body: plain text or HTML. Inserted raw — escape interpolated values. */
  message: string
  recipients: EmailRecipient[]
  /** email_senders row to send as; the default sender when omitted. */
  senderId?: string | null
  fileAttachments?: EmailAttachment[]
  /** Recorded in email_logs.sent_by. */
  sentBy?: string
}

export interface SendEmailOutcome {
  results: SendResult[]
}

type Db = ReturnType<typeof createServiceClient>

async function resolveSender(supabase: Db, senderId?: string | null): Promise<SenderIdentity> {
  const sender = defaultSender(process.env.BREVO_SENDER_EMAIL!)
  const query = supabase.from('email_senders').select('name, email, signature_name, signature_title')
  const { data } = await (senderId ? query.eq('id', senderId) : query.eq('is_default', true)).single()
  if (data) {
    const row = data as { name: string; email: string; signature_name: string | null; signature_title: string | null }
    sender.name = row.name
    sender.email = row.email
    sender.signatureName = row.signature_name ?? sender.signatureName
    sender.signatureTitle = row.signature_title ?? sender.signatureTitle
  }
  return sender
}

/**
 * Sends one email per recipient and returns a result for each. Throws only
 * for invalid input or unexpected failures; a recipient that Brevo rejects,
 * or that is archived, comes back as a failed result instead.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailOutcome> {
  const invalid = validateEmailInput(input)
  if (invalid) throw new Error(invalid)

  const { subject, message, recipients, senderId, fileAttachments, sentBy = 'dashboard' } = input
  const supabase = createServiceClient()
  const sender = await resolveSender(supabase, senderId)

  const { data: archivedRows } = await supabase.from('applications').select('email').eq('archived', true)
  const { sendable, blocked } = splitArchivedRecipients(recipients, toArchivedEmailSet((archivedRows ?? []) as any[]))
  const results: SendResult[] = [...blocked]

  for (const recipient of sendable) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender:  { name: sender.name, email: sender.email },
        to:      [{ email: recipient.email, name: recipient.name }],
        replyTo: { email: sender.email, name: sender.name },
        subject,
        ...(fileAttachments && fileAttachments.length > 0 ? {
          attachment: fileAttachments.map((f) => ({ content: f.content, name: f.name })),
        } : {}),
        htmlContent: wrapBrandedHtml(personalise(message, recipient), sender),
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
      recipients:   recipients.filter((r) => successfulEmails.has(r.email)),
      sent_by:      sentBy,
      status:       allSucceeded ? 'sent' : 'partial',
      sender_name:  sender.name,
      sender_email: sender.email,
      attachments:  (fileAttachments ?? []).map((f) => ({ type: 'file', value: f.name })),
    })
    if (logError) console.error('Email log insert error:', logError.message)
  }

  return { results }
}
