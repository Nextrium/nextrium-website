import { color } from '@nextrium/brand'
// Contributor program email templates. Each returns a subject and the INNER
// HTML for lib/email/send.ts, which adds the branded wrapper and signature.
// sendEmail inserts the body as raw HTML, so every interpolated value is
// escaped here — including braces, so user text can't trigger the
// {{name}}/{{role}}/{{email}} placeholders.

export interface EmailContent {
  subject: string
  html: string
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
}

/** Subjects are plain text; strip line breaks and placeholder braces. */
function subjectText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/[{}]/g, '').slice(0, 150)
}

function button(url: string, label: string): string {
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;background:${color('--orange')};color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></p>`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'no deadline'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
}

export function taskAssignedEmail(p: { taskTitle: string; points: string; deadlineAt: string | null; url: string }): EmailContent {
  return {
    subject: subjectText(`New task: ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>You've been assigned a new task: <strong>${escapeHtml(p.taskTitle)}</strong>.</p>` +
      `<p>Points: ${escapeHtml(p.points)}<br>Deadline: ${escapeHtml(formatDate(p.deadlineAt))}</p>` +
      button(p.url, 'Open the task'),
  }
}

export function extensionDecidedEmail(p: { taskTitle: string; granted: boolean; deadlineAt: string | null; url: string }): EmailContent {
  return {
    subject: subjectText(`Extension ${p.granted ? 'granted' : 'declined'}: ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      (p.granted
        ? `<p>Your extension for <strong>${escapeHtml(p.taskTitle)}</strong> was granted. Your new deadline is ${escapeHtml(formatDate(p.deadlineAt))}.</p>`
        : `<p>Your extension request for <strong>${escapeHtml(p.taskTitle)}</strong> was declined. The deadline stays ${escapeHtml(formatDate(p.deadlineAt))}.</p>`) +
      button(p.url, 'Open the task'),
  }
}

const REVIEW_LINES: Record<string, string> = {
  changes_requested: 'The automated review found a few things to improve before this can be verified.',
  needs_human: 'Your submission has been passed to the team for review.',
  ai_approved: 'Your submission passed the automated review. The team will verify it and award your points.',
}

export function reviewResultEmail(p: { taskTitle: string; status: string; summary?: string | null; whatToDo?: string | null; url: string }): EmailContent {
  const line = REVIEW_LINES[p.status] ?? 'Your submission has been reviewed.'
  const extra = p.status === 'changes_requested'
    ? (p.summary ? `<p>${escapeHtml(p.summary)}</p>` : '') + (p.whatToDo ? `<p><strong>What to do:</strong><br>${escapeHtml(p.whatToDo)}</p>` : '')
    : ''
  return {
    subject: subjectText(`Review update: ${p.taskTitle}`),
    html: `<p>Hi {{name}},</p><p>${escapeHtml(line)}</p>` + extra + button(p.url, 'See the review'),
  }
}

export function changesRequestedEmail(p: { taskTitle: string; notes: string; url: string }): EmailContent {
  return {
    subject: subjectText(`Changes requested: ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>The team reviewed <strong>${escapeHtml(p.taskTitle)}</strong> and asked for changes:</p>` +
      `<p>${escapeHtml(p.notes).replace(/\n/g, '<br>')}</p>` +
      `<p>You can reply to the team or resubmit your updated work from the task page.</p>` +
      button(p.url, 'View feedback & resubmit'),
  }
}

export function verifiedEmail(p: { taskTitle: string; points: number; url: string; notes?: string | null }): EmailContent {
  const note = p.notes?.trim()
  return {
    subject: subjectText(`Verified: ${p.taskTitle} (+${p.points} points)`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>Great work — <strong>${escapeHtml(p.taskTitle)}</strong> was verified and you earned <strong>${escapeHtml(p.points)} points</strong>.</p>` +
      (note ? `<p><strong>Team feedback:</strong><br>${escapeHtml(note).replace(/\n/g, '<br>')}</p>` : '') +
      `<p>You can read the feedback or reply directly on your task page.</p>` +
      button(p.url, note ? 'Read feedback & reply' : 'Open the task'),
  }
}

export function rejectedEmail(p: { taskTitle: string; notes: string; url: string }): EmailContent {
  return {
    subject: subjectText(`Not accepted: ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>The team decided not to accept <strong>${escapeHtml(p.taskTitle)}</strong>.</p>` +
      `<p>${escapeHtml(p.notes).replace(/\n/g, '<br>')}</p>` +
      `<p>You can reply in the task thread if you have any questions about this feedback.</p>` +
      button(p.url, 'View feedback & reply'),
  }
}

export function staffFeedbackEmail(p: { taskTitle: string; authorName: string; body: string; url: string }): EmailContent {
  return {
    subject: subjectText(`New feedback on ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p><strong>${escapeHtml(p.authorName)}</strong> left feedback on your submission for <strong>${escapeHtml(p.taskTitle)}</strong>:</p>` +
      `<p>${escapeHtml(p.body).replace(/\n/g, '<br>')}</p>` +
      button(p.url, 'Read & reply'),
  }
}

export function recurringDeadlineReminderEmail(p: { taskTitle: string; deadlineAt: string | null; url: string }): EmailContent {
  return {
    subject: subjectText(`24-hour reminder to submit: ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>The deadline for your recurring task <strong>${escapeHtml(p.taskTitle)}</strong> (${escapeHtml(formatDate(p.deadlineAt))}) has passed.</p>` +
      `<p>Please submit your update within the next <strong>24 hours</strong>. If not submitted, it will move into a 3-day draft window and then be automatically removed.</p>` +
      button(p.url, 'Submit now'),
  }
}

export function recurringMovedToDraftEmail(p: { taskTitle: string; expiresAt: string | null; url: string }): EmailContent {
  return {
    subject: subjectText(`Saved as draft (3 days left): ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>Your recurring task <strong>${escapeHtml(p.taskTitle)}</strong> was not submitted within 24 hours of its deadline and has been moved to a <strong>3-day draft</strong>.</p>` +
      `<p>You can still submit it before <strong>${escapeHtml(formatDate(p.expiresAt))}</strong>. If it is still not submitted by then, it will be automatically removed.</p>` +
      button(p.url, 'Open & submit'),
  }
}
