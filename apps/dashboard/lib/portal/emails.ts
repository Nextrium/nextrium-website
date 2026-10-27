import { brand, color } from '@nextrium/brand'
import { escapeHtml, type EmailContent } from '@nextrium/contributions-core/emails'

// Emails to contributor portal applicants and contributors. Each returns a
// subject and the inner HTML for sendEmail, which adds the branded wrapper
// and signature. Every interpolated value is escaped (escapeHtml also
// neutralises the {{name}} style placeholders).

export function portalUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_CONTRIBUTE_URL || brand.urls.contribute).replace(/\/+$/, '')
  return `${base}${path}`
}

const subject = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/[{}]/g, '').slice(0, 150)
const button = (url: string, label: string) =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 20px;background:${color('--orange')};color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a></p>`
const paragraph = (text: string) => `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`

export function applicationApprovedEmail(): EmailContent {
  return {
    subject: subject(`Your ${brand.name} contributor application is approved`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>Your contributor application has been reviewed and approved. You now have full access to the ${escapeHtml(brand.name)} contributor portal.</p>` +
      '<p>Sign in to browse open tasks, claim work and start earning points on the public leaderboard.</p>' +
      button(portalUrl('/signin?next=/dashboard'), 'Sign in to your dashboard'),
  }
}

export function revisionRequestedEmail(note: string): EmailContent {
  return {
    subject: subject('Updates needed on your contributor application'),
    html:
      '<p>Hi {{name}},</p>' +
      '<p>The core team has reviewed your application and needs a few updates before they can proceed:</p>' +
      paragraph(note) +
      '<p>Sign in and update your application; it is resubmitted for review automatically.</p>' +
      button(portalUrl('/signin?next=/register'), 'Update your application'),
  }
}

export function applicationRejectedEmail(reason: string | null): EmailContent {
  return {
    subject: subject(`Your ${brand.name} contributor application`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>Thank you for your interest in contributing to ${escapeHtml(brand.name)}. Unfortunately we are unable to approve your application at this time.</p>` +
      (reason ? `<p><strong>Reason:</strong></p>${paragraph(reason)}` : '') +
      '<p>You are welcome to keep following the public task board and leaderboard.</p>' +
      button(portalUrl('/tasks'), 'See the task board'),
  }
}

export function accountDeactivatedEmail(): EmailContent {
  return {
    subject: subject(`Your ${brand.name} contributor account`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>Your contributor account has been deactivated. If you believe this is a mistake, reply to this email or contact ${escapeHtml(brand.emails.contributors)}.</p>`,
  }
}

export function accountReactivatedEmail(): EmailContent {
  return {
    subject: subject(`Your ${brand.name} contributor account is active again`),
    html:
      '<p>Hi {{name}},</p>' +
      '<p>Your contributor account has been reactivated. You can sign in, claim tasks and submit work again.</p>' +
      button(portalUrl('/signin?next=/dashboard'), 'Sign in to your dashboard'),
  }
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : 'no deadline'

export function portalTaskAssignedEmail(p: { taskTitle: string; points: string; deadlineAt: string | null; taskId: string }): EmailContent {
  return {
    subject: subject(`New task assigned: ${p.taskTitle}`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>The core team has assigned you a task: <strong>${escapeHtml(p.taskTitle)}</strong>.</p>` +
      `<p>Points: ${escapeHtml(p.points)}<br>Deadline: ${escapeHtml(when(p.deadlineAt))}</p>` +
      button(portalUrl(`/dashboard/tasks/${p.taskId}`), 'Open the task'),
  }
}

export function portalExtensionDecidedEmail(p: { taskTitle: string; granted: boolean; deadlineAt: string | null; taskId: string }): EmailContent {
  return {
    subject: subject(`Extension ${p.granted ? 'granted' : 'declined'}: ${p.taskTitle}`),
    html:
      '<p>Hi {{name}},</p>' +
      (p.granted
        ? `<p>Your extension for <strong>${escapeHtml(p.taskTitle)}</strong> was granted. Your new deadline is ${escapeHtml(when(p.deadlineAt))}.</p>`
        : `<p>Your extension request for <strong>${escapeHtml(p.taskTitle)}</strong> was declined. The deadline stays ${escapeHtml(when(p.deadlineAt))}.</p>`) +
      button(portalUrl('/dashboard?tab=tasks'), 'Go to my tasks'),
  }
}

export function portalTaskUnassignedEmail(p: { taskTitle: string; reason: string | null }): EmailContent {
  return {
    subject: subject(`Task returned to the board: ${p.taskTitle}`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>The core team has taken <strong>${escapeHtml(p.taskTitle)}</strong> off your running tasks and returned it to the open board.</p>` +
      (p.reason ? paragraph(p.reason) : '') +
      '<p>This does not count against you; you can claim other tasks straight away.</p>' +
      button(portalUrl('/dashboard/tasks'), 'Browse open tasks'),
  }
}

/** A contributor's copy of a shared task was withdrawn by the core team (cancelled or taken back). */
export function portalSharedCopyRemovedEmail(p: { taskTitle: string; reason: string | null }): EmailContent {
  return {
    subject: subject(`Task withdrawn: ${p.taskTitle}`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>The core team has taken <strong>${escapeHtml(p.taskTitle)}</strong> off your running tasks.</p>` +
      (p.reason ? paragraph(p.reason) : '') +
      '<p>This does not count against you; you can claim other tasks straight away.</p>' +
      button(portalUrl('/dashboard/tasks'), 'Browse open tasks'),
  }
}

export function portalVerifiedEmail(p: { title: string; points: number; note: string | null; contributionId: string }): EmailContent {
  return {
    subject: subject(`Verified: ${p.title}`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>Your submission <strong>${escapeHtml(p.title)}</strong> has been verified. <strong>${escapeHtml(String(p.points))} points</strong> have been added to your total on the public leaderboard.</p>` +
      (p.note ? `<p><strong>Note from the core team:</strong></p>${paragraph(p.note)}` : '') +
      button(portalUrl(`/dashboard/submissions/${p.contributionId}`), 'See your submission'),
  }
}

export function portalRejectedEmail(p: { title: string; note: string; contributionId: string }): EmailContent {
  return {
    subject: subject(`Submission not accepted: ${p.title}`),
    html:
      '<p>Hi {{name}},</p>' +
      `<p>The core team has reviewed your submission <strong>${escapeHtml(p.title)}</strong> and was unable to accept it.</p>` +
      `<p><strong>Note from the core team:</strong></p>${paragraph(p.note)}` +
      '<p>The task has gone back to the open board. You can keep claiming other tasks.</p>' +
      button(portalUrl(`/dashboard/submissions/${p.contributionId}`), 'See your submission'),
  }
}

export function portalDeadlineReminderEmail(p: { taskTitle: string; lead: string; overdue: boolean; deadlineAt: string; taskId: string }): EmailContent {
  return {
    subject: subject(p.overdue ? `Overdue: ${p.taskTitle}` : `Deadline reminder: ${p.taskTitle}`),
    html:
      '<p>Hi {{name}},</p>' +
      (p.overdue
        ? `<p>The deadline for <strong>${escapeHtml(p.taskTitle)}</strong> passed on ${escapeHtml(when(p.deadlineAt))}. Submit your work as soon as you can, or unclaim the task so someone else can take it.</p>`
        : `<p>You have ${escapeHtml(p.lead)} left to submit your work for <strong>${escapeHtml(p.taskTitle)}</strong>. Deadline: ${escapeHtml(when(p.deadlineAt))}.</p>`) +
      button(portalUrl('/dashboard?tab=tasks'), 'Go to my tasks') +
      '<p>You are receiving this because you claimed this task. You can turn reminders off in your portal profile.</p>',
  }
}
