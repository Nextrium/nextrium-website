// Sends a contributor program email to one member, through the shared email
// function (sender, wrapper, archived-recipient suppression and logging all
// live there). Skips archived members and members who turned email off.
// Never throws: a notification problem must not break the action behind it.
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { displayNameFromEmail } from './leaderboard'
import { reviewResultEmail, type EmailContent } from './emails'

export function siteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nextrium.org').replace(/\/+$/, '')
  return `${base}${path}`
}

export async function notifyMember(userId: string | null | undefined, content: EmailContent): Promise<boolean> {
  if (!userId) return false
  try {
    const supabase = createServiceClient() as any
    const [{ data: du }, { data: profile }, { data: auth }] = await Promise.all([
      supabase.from('dashboard_users').select('archived, role').eq('user_id', userId).maybeSingle(),
      supabase.from('contributor_profiles').select('notify_email, display_name').eq('user_id', userId).maybeSingle(),
      supabase.auth.admin.getUserById(userId),
    ])
    if (!du || du.archived) return false
    if (profile && profile.notify_email === false) return false
    const email = auth?.user?.email
    if (!email) return false

    const { results } = await sendEmail({
      subject: content.subject,
      message: content.html,
      recipients: [{ email, name: profile?.display_name?.trim() || displayNameFromEmail(email) }],
      sentBy: 'contributor_program',
    })
    return results.some((r) => r.success)
  } catch (err) {
    console.error('[notify] contributor email failed:', err instanceof Error ? err.message : err)
    return false
  }
}

/** Emails the member the outcome of an automated review of their submission. */
export async function notifyReviewResult(contributionId: string, status: string): Promise<void> {
  try {
    const supabase = createServiceClient() as any
    const { data: c } = await supabase.from('contributions').select('contributor_id, task_id, latest_review_id').eq('id', contributionId).maybeSingle()
    if (!c) return
    const [{ data: task }, { data: review }] = await Promise.all([
      supabase.from('tasks').select('title').eq('id', c.task_id).maybeSingle(),
      c.latest_review_id
        ? supabase.from('contribution_reviews').select('feedback').eq('id', c.latest_review_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    await notifyMember(c.contributor_id, reviewResultEmail({
      taskTitle: task?.title ?? 'your task',
      status,
      summary: review?.feedback?.summary ?? null,
      whatToDo: review?.feedback?.what_to_do ?? null,
      url: siteUrl(`/dashboard/my-tasks/${c.task_id}`),
    }))
  } catch (err) {
    console.error('[notify] review result email failed:', err instanceof Error ? err.message : err)
  }
}
