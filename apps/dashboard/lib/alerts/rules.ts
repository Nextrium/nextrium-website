import { brand, color } from '@nextrium/brand'
import { escapeHtml, type EmailContent } from '@nextrium/contributions-core/emails'

// Alerts to the person who created a task, when something on it needs them:
// work ready to review, an extension request, a missed deadline. When nobody
// recorded created the task, or its creator is no longer active staff, the
// alert goes to the fallback: every active admin and the operations inbox.
// The person who caused the event is never alerted about their own action.

export type AlertKind = 'review_ready' | 'resubmitted' | 'review_failed' | 'extension_requested' | 'overdue'
export type TaskSystem = 'team' | 'portal'

export interface Creator { email: string | null; activeStaff: boolean }

/** Who receives an alert: the task's creator while they're active staff, else the fallback; never the actor. */
export function alertRecipients(p: { creator: Creator | null; fallback: string[]; actorEmail?: string | null }): string[] {
  const norm = (e: string | null | undefined) => (typeof e === 'string' ? e.trim().toLowerCase() : '')
  const base = p.creator?.activeStaff && norm(p.creator.email) ? [norm(p.creator.email)] : p.fallback.map(norm)
  const actor = norm(p.actorEmail)
  return [...new Set(base.filter((e) => e.includes('@') && e !== actor))]
}

/**
 * Which alert, if any, a submission's state calls for. Only states that wait on staff alert.
 * Portal rows carry no "failed" status: a review that never finished leaves the
 * row submitted or under_review with no decision, and one handed to a person
 * is under_review with a decision. Only ask about a portal row once its review has run.
 */
export function reviewAlertKind(system: TaskSystem, status: string | null | undefined, attempt: number | null | undefined, decision?: string | null): AlertKind | null {
  const ready = (attempt ?? 1) > 1 ? 'resubmitted' : 'review_ready'
  if (system === 'team') {
    if (status === 'review_failed') return 'review_failed'
    return status === 'ai_approved' || status === 'needs_human' ? ready : null
  }
  if (status === 'ai_approved') return ready
  if (status === 'submitted' || status === 'under_review') return decision ? ready : 'review_failed'
  return null
}

/** A key per alert occurrence, so the same alert is never sent twice. */
export function alertKey(kind: AlertKind, system: TaskSystem, ...parts: (string | number | null | undefined)[]): string {
  return [kind, system, ...parts.map((x) => String(x ?? ''))].join(':').slice(0, 300)
}

export interface AlertContent {
  taskTitle: string
  /** The contributor or team member involved, by name. */
  person: string
  /** Where the button goes. */
  url: string
  /** The automated review's verdict, for review alerts. */
  verdict?: string | null
  deadline?: string | null
  reason?: string | null
  system: TaskSystem
}

const subject = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/[{}]/g, '').slice(0, 150)
const button = (url: string, label: string) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;background:${color('--orange')};color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></p>`
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' (Lagos)' : null

/** The email for an alert. Everything interpolated is escaped. */
export function alertEmail(kind: AlertKind, c: AlertContent): EmailContent {
  const t = `<strong>${escapeHtml(c.taskTitle)}</strong>`
  const who = escapeHtml(c.person)
  const where = c.system === 'portal' ? ' on the contributor portal' : ''
  const intro = '<p>Hi {{name}},</p>'
  switch (kind) {
    case 'review_ready':
    case 'resubmitted':
      return {
        subject: subject(`${kind === 'resubmitted' ? 'Resubmitted' : 'Ready for review'}: ${c.taskTitle}`),
        html: intro +
          `<p>${who} ${kind === 'resubmitted' ? 'resubmitted their work' : 'submitted work'} for ${t}${where}, and it is waiting for your review.</p>` +
          (c.verdict ? `<p>Automated review: ${escapeHtml(c.verdict)}</p>` : '') +
          button(c.url, 'Review the submission'),
      }
    case 'review_failed':
      return {
        subject: subject(`Review needs attention: ${c.taskTitle}`),
        html: intro +
          `<p>${who} submitted work for ${t}${where}, but the automated review could not run. Run it again or review the work yourself.</p>` +
          button(c.url, 'Open the submission'),
      }
    case 'extension_requested':
      return {
        subject: subject(`Extension requested: ${c.taskTitle}`),
        html: intro +
          `<p>${who} asked for more time on ${t}${where}.</p>` +
          (c.reason ? `<p>Their reason: ${escapeHtml(c.reason)}</p>` : '') +
          (when(c.deadline) ? `<p>Current deadline: ${escapeHtml(when(c.deadline)!)}</p>` : '') +
          '<p>Please decide before the deadline passes.</p>' +
          button(c.url, 'Decide on the extension'),
      }
    case 'overdue':
      return {
        subject: subject(`Deadline passed: ${c.taskTitle}`),
        html: intro +
          `<p>The deadline for ${t}${where} has passed and ${who} has not submitted any work yet.</p>` +
          (when(c.deadline) ? `<p>Deadline: ${escapeHtml(when(c.deadline)!)}</p>` : '') +
          '<p>You may want to check in with them, or take the task back.</p>' +
          button(c.url, 'Open the task'),
      }
  }
}

export const ALERT_SENDER = brand.emails.contributors
export const OPERATIONS_INBOX = brand.emails.operations
