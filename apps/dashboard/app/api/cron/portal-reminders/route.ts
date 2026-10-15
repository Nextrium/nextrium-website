import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { community, contributorName, notifyContributor } from '@/lib/portal/server'
import { REMINDER_LEAD, effectiveDeadline, reminderFor } from '@/lib/portal/reminders'
import { portalDeadlineReminderEmail } from '@/lib/portal/emails'

// Daily deadline reminders for contributor portal tasks (Vercel cron, see
// vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything
// else is refused. Contributors who turned reminders off are skipped.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
}

export async function GET(request: NextRequest) {
  if (!authorised(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = community()
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, assigned_to, deadline_days, deadline_at, extended_deadline_at, extension_granted')
    .eq('status', 'assigned')
    .not('deadline_at', 'is', null)
  if (error) return NextResponse.json({ error: 'Could not load tasks' }, { status: 500 })

  const now = new Date()
  const due = (tasks ?? []).flatMap((t) => {
    const kind = reminderFor(t, now)
    return kind && t.assigned_to ? [{ t, kind }] : []
  })
  if (due.length === 0) return NextResponse.json({ checked: tasks?.length ?? 0, sent: 0 })

  const ids = [...new Set(due.map((d) => d.t.assigned_to!))]
  const { data: people } = await db.from('contributors').select('id, name, email, contributor_type, team_name, status, notification_email').in('id', ids)
  const byId = new Map((people ?? []).map((p) => [p.id, p]))

  let sent = 0
  let skipped = 0
  for (const { t, kind } of due) {
    const c = byId.get(t.assigned_to!)
    if (!c || c.status !== 'active' || c.notification_email === false) { skipped++; continue }
    const ok = await notifyContributor(
      { email: c.email, name: contributorName(c) },
      portalDeadlineReminderEmail({ taskTitle: t.title, lead: REMINDER_LEAD[kind], overdue: kind === 'overdue', deadlineAt: effectiveDeadline(t)!.toISOString(), taskId: t.id }),
    )
    if (ok) sent++
  }
  return NextResponse.json({ checked: tasks?.length ?? 0, due: due.length, sent, skipped })
}
