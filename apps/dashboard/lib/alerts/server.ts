import { ALERT_SENDER, OPERATIONS_INBOX, alertEmail, alertKey, alertRecipients, reviewAlertKind, type AlertContent, type AlertKind, type Creator, type TaskSystem } from './rules'

// Sends task alerts to the person who created the task (or the fallback). Every
// dependency is passed in, so the whole flow is tested against fakes. Nothing
// here throws: an alert problem must never break the action that caused it.

export interface AlertDeps {
  /** Nextrium service client (staff, team tasks, the sent-alerts record). */
  db: any
  /** Community service client (portal tasks), for portal alerts. */
  community?: any
  /** The shared sendEmail. */
  send: (input: { subject: string; message: string; recipients: { email: string; name?: string }[]; senderEmail: string; sentBy: string }) => Promise<{ results: { email: string; success: boolean }[] }>
  /** Builds a dashboard link. */
  link: (path: string) => string
}

export type AlertOutcome = 'sent' | 'already_sent' | 'nobody' | 'failed' | 'not_needed'

/** Roles that create tasks and act on alerts. Anyone else counts as no longer able to. */
const CREATOR_ROLES = ['admin', 'moderator']

/** Every active admin and the operations inbox. */
export async function fallbackRecipients(db: any): Promise<string[]> {
  const { data } = await db.from('dashboard_users').select('user_id, role, archived').eq('role', 'admin')
  const admins: string[] = []
  for (const r of (data ?? []) as { user_id: string; archived: boolean }[]) {
    if (r.archived) continue
    const { data: u } = await db.auth.admin.getUserById(r.user_id)
    if (u?.user?.email) admins.push(u.user.email)
  }
  return [...admins, OPERATIONS_INBOX]
}

/** The creator by their dashboard account: their email and whether they can still act. */
export async function creatorFor(db: any, userId: string | null | undefined, fallbackEmail?: string | null): Promise<Creator | null> {
  if (!userId) return null
  const { data: row } = await db.from('dashboard_users').select('role, archived').eq('user_id', userId).maybeSingle()
  const { data: u } = await db.auth.admin.getUserById(userId)
  const email = u?.user?.email ?? fallbackEmail ?? null
  return { email, activeStaff: !!row && !row.archived && CREATOR_ROLES.includes(row.role) }
}

/**
 * Sends one alert once. The key is recorded first, so a second call (a
 * retry, a replayed request, two servers at once) sends nothing. If the email
 * fails for everyone, the record is removed so a later attempt can send it.
 */
export async function deliverAlert(deps: AlertDeps, key: string, kind: AlertKind, recipients: string[], content: AlertContent): Promise<AlertOutcome> {
  if (recipients.length === 0) return 'nobody'
  const { error: claimError } = await deps.db.from('task_alerts_sent').insert({ key, kind })
  if (claimError?.code === '23505') return 'already_sent'
  // Any other recording problem: still send (a missed alert is worse than a rare repeat).
  const email = alertEmail(kind, content)
  let ok = false
  try {
    const { results } = await deps.send({ subject: email.subject, message: email.html, recipients: recipients.map((e) => ({ email: e })), senderEmail: ALERT_SENDER, sentBy: 'task-alert' })
    ok = results.some((r) => r.success)
  } catch (err) {
    console.error('[alerts] send failed:', err instanceof Error ? err.message : err)
  }
  if (!ok) {
    if (!claimError) await deps.db.from('task_alerts_sent').delete().eq('key', key)
    return 'failed'
  }
  return 'sent'
}

async function teamPerson(db: any, userId: string | null): Promise<string> {
  if (!userId) return 'A team member'
  const { data: p } = await db.from('contributor_profiles').select('display_name').eq('user_id', userId).maybeSingle()
  if (p?.display_name?.trim()) return p.display_name.trim()
  const { data: u } = await db.auth.admin.getUserById(userId)
  const local = (u?.user?.email ?? '').split('@')[0]
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'A team member'
}

function portalPerson(c: { name?: string | null; contributor_type?: string | null; team_name?: string | null } | null): string {
  if (!c) return 'A contributor'
  return (c.contributor_type === 'team' && c.team_name?.trim()) || c.name?.trim() || 'A contributor'
}

async function safely(label: string, fn: () => Promise<AlertOutcome>): Promise<AlertOutcome> {
  try { return await fn() } catch (err) {
    console.error(`[alerts] ${label} failed:`, err instanceof Error ? err.message : err)
    return 'failed'
  }
}

// ── Team tasks (the dashboard's own) ────────────────────────────────────────

/** After a team member's submission is reviewed: alert if it now waits on staff. */
export function alertTeamSubmission(deps: AlertDeps, contributionId: string, actorEmail?: string | null): Promise<AlertOutcome> {
  return safely('team submission', async () => {
    const { data: c } = await deps.db.from('contributions').select('id, task_id, contributor_id, status, submission_count, review_decision').eq('id', contributionId).maybeSingle()
    if (!c) return 'not_needed'
    const kind = reviewAlertKind('team', c.status, c.submission_count)
    if (!kind) return 'not_needed'
    const { data: t } = await deps.db.from('tasks').select('title, created_by').eq('id', c.task_id).maybeSingle()
    if (!t) return 'not_needed'
    const recipients = alertRecipients({ creator: await creatorFor(deps.db, t.created_by), fallback: await fallbackRecipients(deps.db), actorEmail })
    return deliverAlert(deps, alertKey(kind, 'team', c.id, c.submission_count), kind, recipients, {
      system: 'team', taskTitle: t.title, person: await teamPerson(deps.db, c.contributor_id),
      verdict: c.status === 'ai_approved' ? 'approved, awaiting your verification' : c.status === 'needs_human' ? 'needs a person to decide' : null,
      url: deps.link(`/reviews/${c.id}`),
    })
  })
}

/** When a team member asks for an extension. */
export function alertTeamExtension(deps: AlertDeps, taskId: string, actorEmail?: string | null): Promise<AlertOutcome> {
  return safely('team extension', async () => {
    const { data: t } = await deps.db.from('tasks').select('id, title, created_by, assigned_to, extension_status, extension_reason, extension_requested_at, deadline_at').eq('id', taskId).maybeSingle()
    if (!t || t.extension_status !== 'requested') return 'not_needed'
    const recipients = alertRecipients({ creator: await creatorFor(deps.db, t.created_by), fallback: await fallbackRecipients(deps.db), actorEmail })
    return deliverAlert(deps, alertKey('extension_requested', 'team', t.id, t.extension_requested_at), 'extension_requested', recipients, {
      system: 'team', taskTitle: t.title, person: await teamPerson(deps.db, t.assigned_to), reason: t.extension_reason, deadline: t.deadline_at,
      url: deps.link(`/tasks/${t.id}`),
    })
  })
}

// ── Portal tasks (community database) ───────────────────────────────────────

/** After a contributor's submission is reviewed: alert if it now waits on staff. */
export function alertPortalSubmission(deps: AlertDeps, contributionId: string): Promise<AlertOutcome> {
  return safely('portal submission', async () => {
    const cdb = deps.community
    const { data: c } = await cdb.from('contributions').select('id, task_id, contributor_id, status, submission_count, review_decision').eq('id', contributionId).maybeSingle()
    if (!c || !c.task_id) return 'not_needed'
    const kind = reviewAlertKind('portal', c.status, c.submission_count, c.review_decision)
    if (!kind) return 'not_needed'
    const [{ data: t }, { data: who }] = await Promise.all([
      cdb.from('tasks').select('title, created_by_user, created_by_email').eq('id', c.task_id).maybeSingle(),
      c.contributor_id ? cdb.from('contributors').select('name, contributor_type, team_name').eq('id', c.contributor_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    if (!t) return 'not_needed'
    const recipients = alertRecipients({ creator: await creatorFor(deps.db, t.created_by_user, t.created_by_email), fallback: await fallbackRecipients(deps.db) })
    return deliverAlert(deps, alertKey(kind, 'portal', c.id, c.submission_count), kind, recipients, {
      system: 'portal', taskTitle: t.title, person: portalPerson(who),
      verdict: c.status === 'ai_approved' ? 'approved, awaiting your verification' : kind !== 'review_failed' ? 'needs a person to decide' : null,
      url: deps.link(`/portal/reviews/${c.id}`),
    })
  })
}

/** When a contributor asks for an extension. */
export function alertPortalExtension(deps: AlertDeps, taskId: string): Promise<AlertOutcome> {
  return safely('portal extension', async () => {
    const cdb = deps.community
    const { data: t } = await cdb.from('tasks').select('id, title, status, assigned_to, created_by_user, created_by_email, extension_requested_at, extension_granted, extended_deadline_at, deadline_at').eq('id', taskId).maybeSingle()
    // Requested and not yet decided (a decline stores the original deadline as the extended one).
    if (!t || t.status !== 'assigned' || !t.extension_requested_at || t.extension_granted || t.extended_deadline_at) return 'not_needed'
    const { data: who } = t.assigned_to ? await cdb.from('contributors').select('name, contributor_type, team_name').eq('id', t.assigned_to).maybeSingle() : { data: null }
    const recipients = alertRecipients({ creator: await creatorFor(deps.db, t.created_by_user, t.created_by_email), fallback: await fallbackRecipients(deps.db) })
    return deliverAlert(deps, alertKey('extension_requested', 'portal', t.id, t.extension_requested_at), 'extension_requested', recipients, {
      system: 'portal', taskTitle: t.title, person: portalPerson(who), deadline: t.deadline_at,
      url: deps.link(`/portal/tasks/${t.id}`),
    })
  })
}

// ── Missed deadlines (daily) ────────────────────────────────────────────────

const effective = (t: { deadline_at: string | null; extended_deadline_at?: string | null; extension_granted?: boolean | null; extension_status?: string | null }) =>
  (t.extension_granted || t.extension_status === 'granted') && t.extended_deadline_at ? t.extended_deadline_at : t.deadline_at

/** Alerts creators about running tasks whose deadline passed with nothing submitted. Once per deadline. */
export async function alertOverdue(deps: AlertDeps, now: Date = new Date()): Promise<Record<AlertOutcome, number>> {
  const tally: Record<AlertOutcome, number> = { sent: 0, already_sent: 0, nobody: 0, failed: 0, not_needed: 0 }
  const fallback = await fallbackRecipients(deps.db)

  const { data: team } = await deps.db.from('tasks').select('id, title, created_by, assigned_to, deadline_at, extended_deadline_at, extension_status').eq('status', 'assigned')
  for (const t of (team ?? []) as any[]) {
    const due = effective(t)
    if (!due || new Date(due).getTime() > now.getTime()) continue
    const { count } = await deps.db.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', t.id)
    if (count) continue
    const r = await safely('team overdue', async () => deliverAlert(deps, alertKey('overdue', 'team', t.id, due), 'overdue',
      alertRecipients({ creator: await creatorFor(deps.db, t.created_by), fallback }),
      { system: 'team', taskTitle: t.title, person: await teamPerson(deps.db, t.assigned_to), deadline: due, url: deps.link(`/tasks/${t.id}`) }))
    tally[r]++
  }

  if (deps.community) {
    const cdb = deps.community
    const { data: portal } = await cdb.from('tasks').select('id, title, assigned_to, created_by_user, created_by_email, deadline_at, extended_deadline_at, extension_granted').eq('status', 'assigned')
    for (const t of (portal ?? []) as any[]) {
      const due = effective(t)
      if (!due || new Date(due).getTime() > now.getTime()) continue
      const { count } = await cdb.from('contributions').select('id', { count: 'exact', head: true }).eq('task_id', t.id)
      if (count) continue
      const { data: who } = t.assigned_to ? await cdb.from('contributors').select('name, contributor_type, team_name').eq('id', t.assigned_to).maybeSingle() : { data: null }
      const r = await safely('portal overdue', async () => deliverAlert(deps, alertKey('overdue', 'portal', t.id, due), 'overdue',
        alertRecipients({ creator: await creatorFor(deps.db, t.created_by_user, t.created_by_email), fallback }),
        { system: 'portal', taskTitle: t.title, person: portalPerson(who), deadline: due, url: deps.link(`/portal/tasks/${t.id}`) }))
      tally[r]++
    }
  }
  return tally
}
