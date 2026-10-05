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
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;background:#DB6727;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></p>`
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
      `<p>${escapeHtml(p.notes)}</p>` +
      `<p>You can update and resubmit it from the task page.</p>` +
      button(p.url, 'Resubmit'),
  }
}

export function verifiedEmail(p: { taskTitle: string; points: number; url: string }): EmailContent {
  return {
    subject: subjectText(`Verified: ${p.taskTitle} (+${p.points} points)`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>Great work — <strong>${escapeHtml(p.taskTitle)}</strong> was verified and you earned <strong>${escapeHtml(p.points)} points</strong>.</p>` +
      button(p.url, 'See the leaderboard'),
  }
}

export function rejectedEmail(p: { taskTitle: string; notes: string; url: string }): EmailContent {
  return {
    subject: subjectText(`Not accepted: ${p.taskTitle}`),
    html:
      `<p>Hi {{name}},</p>` +
      `<p>The team decided not to accept <strong>${escapeHtml(p.taskTitle)}</strong>.</p>` +
      `<p>${escapeHtml(p.notes)}</p>` +
      button(p.url, 'Open the task'),
  }
}
