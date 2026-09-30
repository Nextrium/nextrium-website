// Pure pieces of sending an email: validation, archived-recipient
// suppression, placeholder filling and the branded wrapper. No I/O here, so
// they can be unit-tested; lib/email/send.ts does the lookups and the send.

export interface EmailRecipient {
  email: string
  name?: string
  role?: string
}

export interface EmailAttachment {
  content: string
  name: string
}

export interface SenderIdentity {
  name: string
  email: string
  signatureName: string
  signatureTitle: string
}

export interface SendResult {
  email: string
  success: boolean
  error?: string
}

export const ARCHIVED_RECIPIENT_ERROR = 'Recipient is archived — this address must not be contacted.'

export function defaultSender(senderEmail: string): SenderIdentity {
  return {
    name: 'Nextrium Global Innovations Ltd',
    email: senderEmail,
    signatureName: 'Abdulbasit Adigun Abdulrahman',
    signatureTitle: 'Founder and Chief Executive Officer, Nextrium Global Innovations Ltd',
  }
}

/**
 * Returns the error message for invalid input, or null when it can be sent.
 * `message` may be rich HTML from the composer (e.g. `<p></p>` when "empty")
 * as well as plain text, so tags are stripped before checking for content.
 */
export function validateEmailInput(input: { subject?: unknown; message?: unknown; recipients?: unknown }): string | null {
  const messageHasContent = typeof input.message === 'string' && input.message.replace(/<[^>]*>/g, '').trim().length > 0
  if (typeof input.subject !== 'string' || !input.subject.trim()) return 'Subject is required.'
  if (!messageHasContent) return 'Message is required.'
  if (!Array.isArray(input.recipients) || input.recipients.length === 0) return 'At least one recipient is required.'
  return null
}

/**
 * Splits recipients into those that may be emailed and a failed result for
 * each archived address. Matched by email address, case-insensitively, so a
 * candidate archived on any application is suppressed everywhere.
 */
export function splitArchivedRecipients<T extends EmailRecipient>(
  recipients: T[],
  archivedEmails: Set<string>,
): { sendable: T[]; blocked: SendResult[] } {
  const sendable: T[] = []
  const blocked: SendResult[] = []
  for (const r of recipients) {
    const email = (r.email || '').trim().toLowerCase()
    if (email && archivedEmails.has(email)) {
      blocked.push({ email: r.email, success: false, error: ARCHIVED_RECIPIENT_ERROR })
    } else {
      sendable.push(r)
    }
  }
  return { sendable, blocked }
}

/** Normalises archived application emails into the lookup set used above. */
export function toArchivedEmailSet(rows: Array<{ email?: string | null }>): Set<string> {
  return new Set(rows.map((r) => (r.email || '').trim().toLowerCase()).filter(Boolean))
}

/** Fills {{name}} (first name), {{role}} and {{email}} for one recipient. */
export function personalise(message: string, recipient: EmailRecipient): string {
  const firstName = recipient.name?.trim().split(' ')[0] ?? 'there'
  return message
    .replace(/{{name}}/g, firstName)
    .replace(/{{role}}/g, recipient.role ?? 'your applied role')
    .replace(/{{email}}/g, recipient.email ?? '')
}

/**
 * The branded email body. `innerHtml` is inserted as raw HTML, so callers
 * building it from data must escape every interpolated value.
 */
export function wrapBrandedHtml(innerHtml: string, sender: SenderIdentity): string {
  return `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <div style="background: #071628; padding: 24px 32px; border-bottom: 3px solid #DB6727;">
      <h2 style="margin: 0; font-size: 20px; color: #ffffff; font-family: sans-serif; letter-spacing: -0.3px;">NexTrium</h2>
      <p style="margin: 4px 0 0; font-size: 11px; color: #8A9BB0; text-transform: uppercase; letter-spacing: 0.12em;">Global Innovations Ltd</p>
    </div>
    <div style="padding: 32px; background: #ffffff;">
      <div style="font-size: 15px; color: #1a1a2e; line-height: 1.8; white-space: pre-wrap; margin-bottom: 32px;">${innerHtml}</div>
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e8edf2;">
        <p style="margin: 0 0 4px; font-size: 13px; color: #1a1a2e; font-weight: 600;">${sender.signatureName}</p>
        <p style="margin: 0 0 4px; font-size: 12px; color: #4a5568;">${sender.signatureTitle}</p>
        <p style="margin: 0; font-size: 12px;">
          <a href="mailto:${sender.email}" style="color: #DB6727; text-decoration: none;">${sender.email}</a>
          &nbsp;·&nbsp;
          <a href="https://nextrium.org" style="color: #DB6727; text-decoration: none;">nextrium.org</a>
        </p>
      </div>
    </div>
    <div style="background: #071628; padding: 16px 32px;">
      <p style="margin: 0; font-size: 11px; color: #8A9BB0;">NexTrium Global Innovations Ltd · 69 Abeokuta Street, Ilaje Bariga, Lagos 100223, Nigeria</p>
    </div>
  </div>
`
}
