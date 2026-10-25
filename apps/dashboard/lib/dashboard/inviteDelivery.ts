import { sendEmail } from '@nextrium/email/send'
import { brand } from '@nextrium/brand'
import { dashboardUrl } from '@/lib/contributions/notify'
import { inviteEmail, issueInvite } from './invites'

/**
 * Issues a 5-day invitation link for a person and emails it from the
 * operations sender. Never throws: returns false when the email didn't go.
 * Server-only (uses the service client passed in).
 */
export function makeInviteDelivery(db: any, createdBy: string | null) {
  return async (userId: string, email: string): Promise<boolean> => {
    try {
      const { token, expiresAt } = await issueInvite(db, userId, createdBy)
      const content = inviteEmail({ url: dashboardUrl(`/invite/${token}`), teamName: brand.name, expiresAt })
      const { results } = await sendEmail({
        subject: content.subject,
        message: content.message,
        recipients: [{ email }],
        senderEmail: brand.emails.operations,
        sentBy: 'dashboard-invite',
      })
      return results.some((r) => r.email.toLowerCase() === email.toLowerCase() && r.success)
    } catch (err) {
      console.error('[invites] delivery failed:', err instanceof Error ? err.message : err)
      return false
    }
  }
}
