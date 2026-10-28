import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeSupabase } from '../testing/fakeSupabase'
import { OPERATIONS_INBOX } from './rules'
import { alertOverdue, alertPortalExtension, alertPortalSubmission, alertTeamExtension, alertTeamSubmission, creatorFor, deliverAlert, fallbackRecipients, type AlertDeps } from './server'

const ADMIN = '00000000-0000-4000-8000-000000000001'
const ADMIN2 = '00000000-0000-4000-8000-000000000002'
const MOD = '00000000-0000-4000-8000-000000000003'
const GONE = '00000000-0000-4000-8000-000000000004'
const MEMBER = '00000000-0000-4000-8000-000000000005'
const CONTENT = '00000000-0000-4000-8000-000000000006'

const users = [
  { id: ADMIN, email: 'admin@nextrium.org' }, { id: ADMIN2, email: 'old-admin@nextrium.org' },
  { id: MOD, email: 'mod@nextrium.org' }, { id: GONE, email: 'gone@nextrium.org' },
  { id: MEMBER, email: 'member@nextrium.org' }, { id: CONTENT, email: 'writer@nextrium.org' },
]
const staff = [
  { user_id: ADMIN, role: 'admin', archived: false }, { user_id: ADMIN2, role: 'admin', archived: true },
  { user_id: MOD, role: 'moderator', archived: false }, { user_id: GONE, role: 'moderator', archived: true },
  { user_id: MEMBER, role: 'member', archived: false }, { user_id: CONTENT, role: 'content', archived: false },
]

type Sent = { subject: string; message: string; recipients: { email: string }[]; senderEmail: string; sentBy: string }

function setup(seed: Record<string, any[]> = {}, community: Record<string, any[]> = {}, sendOk: boolean | 'throw' = true) {
  const nx = createFakeSupabase({ dashboard_users: staff, contributor_profiles: [{ user_id: MEMBER, display_name: 'Musa Bello' }], ...seed }, { unique: { task_alerts_sent: ['key'] } }, users)
  const cm = createFakeSupabase(community)
  const sent: Sent[] = []
  const deps: AlertDeps = {
    db: nx.client, community: cm.client, link: (p) => `https://dash.test${p}`,
    send: async (input) => {
      if (sendOk === 'throw') throw new Error('Brevo down')
      sent.push(input)
      return { results: input.recipients.map((r) => ({ email: r.email, success: sendOk })) }
    },
  }
  return { deps, nx, cm, sent }
}
const to = (s: Sent) => s.recipients.map((r) => r.email).sort()

test('fallback: active admins only, plus the operations inbox', async () => {
  const { deps } = setup()
  assert.deepEqual(await fallbackRecipients(deps.db), ['admin@nextrium.org', OPERATIONS_INBOX])
})

test('creator: admins and moderators count; archived, members and other roles do not', async () => {
  const { deps } = setup()
  assert.deepEqual(await creatorFor(deps.db, MOD), { email: 'mod@nextrium.org', activeStaff: true })
  assert.equal((await creatorFor(deps.db, GONE))!.activeStaff, false)
  assert.equal((await creatorFor(deps.db, MEMBER))!.activeStaff, false)
  assert.equal((await creatorFor(deps.db, CONTENT))!.activeStaff, false)
  assert.equal((await creatorFor(deps.db, '00000000-0000-4000-8000-0000000000ff'))!.activeStaff, false, 'no account at all')
  assert.equal(await creatorFor(deps.db, null), null)
  assert.equal((await creatorFor(deps.db, '00000000-0000-4000-8000-0000000000ff', 'recorded@x.com'))!.email, 'recorded@x.com', 'falls back to the recorded email')
})

test('deliver: sends once; a repeat sends nothing', async () => {
  const { deps, sent, nx } = setup()
  const content = { system: 'team' as const, taskTitle: 'T', person: 'P', url: 'u' }
  assert.equal(await deliverAlert(deps, 'k1', 'overdue', ['a@x.com'], content), 'sent')
  assert.equal(await deliverAlert(deps, 'k1', 'overdue', ['a@x.com'], content), 'already_sent')
  assert.equal(sent.length, 1)
  assert.equal(sent[0].senderEmail, 'contributors@nextrium.org')
  assert.equal(nx.tables.task_alerts_sent.length, 1)
})

test('deliver: nobody to tell sends nothing and records nothing', async () => {
  const { deps, sent, nx } = setup()
  assert.equal(await deliverAlert(deps, 'k', 'overdue', [], { system: 'team', taskTitle: 'T', person: 'P', url: 'u' }), 'nobody')
  assert.equal(sent.length, 0)
  assert.equal(nx.tables.task_alerts_sent?.length ?? 0, 0)
})

test('deliver: a failed or crashed send is forgotten so a later try can send it', async () => {
  for (const mode of [false, 'throw'] as const) {
    const { deps, nx } = setup({}, {}, mode)
    assert.equal(await deliverAlert(deps, 'k', 'overdue', ['a@x.com'], { system: 'team', taskTitle: 'T', person: 'P', url: 'u' }), 'failed')
    assert.equal(nx.tables.task_alerts_sent.length, 0, String(mode))
  }
})

test('deliver: if the record cannot be written, it still sends (a missed alert is worse)', async () => {
  const { deps, sent, nx } = setup()
  const fake = createFakeSupabase({}, { failNextWrite: { task_alerts_sent: { code: '42501', message: 'permission denied' } } })
  deps.db = fake.client
  assert.equal(await deliverAlert(deps, 'k', 'overdue', ['a@x.com'], { system: 'team', taskTitle: 'T', person: 'P', url: 'u' }), 'sent')
  assert.equal(sent.length, 1)
  void nx
})

// ── Team ────────────────────────────────────────────────────────────────────

const teamTask = (over = {}) => ({ id: 't1', title: 'Write the guide', created_by: MOD, assigned_to: MEMBER, status: 'submitted', deadline_at: '2026-10-30T10:00:00Z', extension_status: 'none', extension_reason: null, extension_requested_at: null, extended_deadline_at: null, ...over })
const teamSub = (over = {}) => ({ id: 'c1', task_id: 't1', contributor_id: MEMBER, status: 'ai_approved', submission_count: 1, ...over })

test('team submission: the creator hears about work waiting on them, with a link to the review', async () => {
  const { deps, sent } = setup({ tasks: [teamTask()], contributions: [teamSub()] })
  assert.equal(await alertTeamSubmission(deps, 'c1', 'member@nextrium.org'), 'sent')
  assert.deepEqual(to(sent[0]), ['mod@nextrium.org'])
  assert.match(sent[0].subject, /^Ready for review: Write the guide/)
  assert.match(sent[0].message, /Musa Bello/)
  assert.match(sent[0].message, /href="https:\/\/dash\.test\/reviews\/c1"/)
})

test('team submission: resubmission and failed review have their own alert; a second attempt alerts again', async () => {
  const { deps, sent } = setup({ tasks: [teamTask()], contributions: [teamSub({ status: 'needs_human', submission_count: 2 })] })
  assert.equal(await alertTeamSubmission(deps, 'c1'), 'sent')
  assert.match(sent[0].subject, /^Resubmitted/)
  const f = setup({ tasks: [teamTask()], contributions: [teamSub({ status: 'review_failed' })] })
  assert.equal(await alertTeamSubmission(f.deps, 'c1'), 'sent')
  assert.match(f.sent[0].subject, /^Review needs attention/)
})

test('team submission: states that do not wait on staff, and unknown ids, send nothing', async () => {
  for (const status of ['changes_requested', 'pending_review', 'verified', 'rejected']) {
    const { deps, sent } = setup({ tasks: [teamTask()], contributions: [teamSub({ status })] })
    assert.equal(await alertTeamSubmission(deps, 'c1'), 'not_needed', status)
    assert.equal(sent.length, 0)
  }
  const { deps } = setup({ tasks: [], contributions: [teamSub()] })
  assert.equal(await alertTeamSubmission(deps, 'c1'), 'not_needed', 'task gone')
  assert.equal(await alertTeamSubmission(deps, 'nope'), 'not_needed')
})

test('team submission: an archived creator, a member creator or no creator goes to admins + operations', async () => {
  for (const created_by of [GONE, MEMBER, null]) {
    const { deps, sent } = setup({ tasks: [teamTask({ created_by })], contributions: [teamSub()] })
    assert.equal(await alertTeamSubmission(deps, 'c1'), 'sent')
    assert.deepEqual(to(sent[0]), ['admin@nextrium.org', OPERATIONS_INBOX].sort(), String(created_by))
  }
})

test('team submission: the person who did it is never told about their own action', async () => {
  const { deps, sent } = setup({ tasks: [teamTask()], contributions: [teamSub()] })
  assert.equal(await alertTeamSubmission(deps, 'c1', 'MOD@nextrium.org'), 'nobody')
  assert.equal(sent.length, 0)
})

test('team submission: a database failure never throws', async () => {
  const { deps } = setup()
  deps.db = { from() { throw new Error('connection reset') } }
  assert.equal(await alertTeamSubmission(deps, 'c1'), 'failed')
})

test('team extension: only while requested; once per request; the reason is in the email', async () => {
  const { deps, sent } = setup({ tasks: [teamTask({ status: 'assigned', extension_status: 'requested', extension_reason: 'Exams <this> week', extension_requested_at: '2026-10-28T09:00:00Z' })] })
  assert.equal(await alertTeamExtension(deps, 't1', 'member@nextrium.org'), 'sent')
  assert.equal(await alertTeamExtension(deps, 't1', 'member@nextrium.org'), 'already_sent')
  assert.match(sent[0].message, /Exams &lt;this&gt; week/)
  assert.match(sent[0].message, /dash\.test\/tasks\/t1/)
  for (const extension_status of ['none', 'granted', 'denied']) {
    const s = setup({ tasks: [teamTask({ extension_status })] })
    assert.equal(await alertTeamExtension(s.deps, 't1'), 'not_needed', extension_status)
  }
})

// ── Portal ──────────────────────────────────────────────────────────────────

const portalTask = (over = {}) => ({ id: 'p1', title: 'Design the banner', status: 'assigned', assigned_to: 'k1', created_by_user: MOD, created_by_email: 'mod@nextrium.org', deadline_at: '2026-10-30T10:00:00Z', extension_requested_at: null, extension_granted: false, extended_deadline_at: null, ...over })
const contributors = [{ id: 'k1', name: 'Ada Obi', contributor_type: 'individual', team_name: null }, { id: 'k2', name: 'Lead', contributor_type: 'team', team_name: 'Pixel Crew' }]

test('portal submission: the creator hears about it, linked to the portal review', async () => {
  const { deps, sent } = setup({}, { tasks: [portalTask()], contributors, contributions: [{ id: 'pc1', task_id: 'p1', contributor_id: 'k2', status: 'under_review', review_decision: 'human_required', submission_count: 1 }] })
  assert.equal(await alertPortalSubmission(deps, 'pc1'), 'sent')
  assert.match(sent[0].subject, /^Ready for review/)
  assert.match(sent[0].message, /needs a person to decide/)
  assert.deepEqual(to(sent[0]), ['mod@nextrium.org'])
  assert.match(sent[0].message, /Pixel Crew/)
  assert.match(sent[0].message, /on the contributor portal/)
  assert.match(sent[0].message, /dash\.test\/portal\/reviews\/pc1/)
})

test('portal submission: a review that never finished alerts as needing attention', async () => {
  const { deps, sent } = setup({}, { tasks: [portalTask()], contributors, contributions: [{ id: 'pc1', task_id: 'p1', contributor_id: 'k1', status: 'submitted', review_decision: null, submission_count: 1 }] })
  assert.equal(await alertPortalSubmission(deps, 'pc1'), 'sent')
  assert.match(sent[0].subject, /^Review needs attention/)
  assert.doesNotMatch(sent[0].message, /needs a person to decide/)
})

test('portal submission: rejected or verified sends nothing; no task id sends nothing', async () => {
  for (const status of ['rejected', 'verified']) {
    const { deps } = setup({}, { tasks: [portalTask()], contributions: [{ id: 'pc1', task_id: 'p1', status, submission_count: 1 }] })
    assert.equal(await alertPortalSubmission(deps, 'pc1'), 'not_needed', status)
  }
  const { deps } = setup({}, { contributions: [{ id: 'pc1', task_id: null, status: 'ai_approved', submission_count: 1 }] })
  assert.equal(await alertPortalSubmission(deps, 'pc1'), 'not_needed')
})

test('portal submission: tasks created before creators were recorded go to the fallback', async () => {
  const { deps, sent } = setup({}, { tasks: [portalTask({ created_by_user: null, created_by_email: null })], contributions: [{ id: 'pc1', task_id: 'p1', status: 'ai_approved', review_decision: 'approved', submission_count: 1 }] })
  assert.equal(await alertPortalSubmission(deps, 'pc1'), 'sent')
  assert.deepEqual(to(sent[0]), ['admin@nextrium.org', OPERATIONS_INBOX].sort())
})

test('portal extension: only while requested and undecided', async () => {
  const { deps, sent } = setup({}, { tasks: [portalTask({ extension_requested_at: '2026-10-28T09:00:00Z' })], contributors })
  assert.equal(await alertPortalExtension(deps, 'p1'), 'sent')
  assert.match(sent[0].message, /Ada Obi asked for more time/)
  assert.match(sent[0].message, /dash\.test\/portal\/tasks\/p1/)
  const cases = [
    { extension_requested_at: null },
    { extension_requested_at: '2026-10-28T09:00:00Z', extension_granted: true, extended_deadline_at: '2026-11-02T10:00:00Z' },
    { extension_requested_at: '2026-10-28T09:00:00Z', extended_deadline_at: '2026-10-30T10:00:00Z' }, // declined
    { extension_requested_at: '2026-10-28T09:00:00Z', status: 'completed' },
  ]
  for (const c of cases) {
    const s = setup({}, { tasks: [portalTask(c)] })
    assert.equal(await alertPortalExtension(s.deps, 'p1'), 'not_needed', JSON.stringify(c))
  }
})

// ── Overdue ─────────────────────────────────────────────────────────────────

test('overdue: past-deadline running tasks with nothing submitted, once per deadline, in both systems', async () => {
  const now = new Date('2026-10-31T00:00:00Z')
  const team = [
    teamTask({ id: 'late', status: 'assigned' }),
    teamTask({ id: 'done', status: 'assigned' }),
    teamTask({ id: 'future', status: 'assigned', deadline_at: '2026-11-05T00:00:00Z' }),
    teamTask({ id: 'extended', status: 'assigned', extension_status: 'granted', extended_deadline_at: '2026-11-05T00:00:00Z' }),
    teamTask({ id: 'denied', status: 'assigned', extension_status: 'denied', extended_deadline_at: '2026-11-05T00:00:00Z' }),
    teamTask({ id: 'cancelled', status: 'cancelled' }),
    teamTask({ id: 'nodeadline', status: 'assigned', deadline_at: null }),
  ]
  const portal = [
    portalTask({ id: 'plate' }),
    portalTask({ id: 'pext', extension_granted: true, extended_deadline_at: '2026-11-05T00:00:00Z' }),
    portalTask({ id: 'pdeclined', extended_deadline_at: '2026-10-30T10:00:00Z' }),
    portalTask({ id: 'popen', status: 'open', assigned_to: null }),
  ]
  const { deps, sent } = setup({ tasks: team, contributions: [teamSub({ task_id: 'done' })] }, { tasks: portal, contributors })
  const first = await alertOverdue(deps, now)
  assert.equal(first.sent, 4)
  const links = sent.map((s) => s.message.match(/href="([^"]+)"/)![1]).sort()
  assert.deepEqual(links, ['https://dash.test/portal/tasks/pdeclined', 'https://dash.test/portal/tasks/plate', 'https://dash.test/tasks/denied', 'https://dash.test/tasks/late'])
  const second = await alertOverdue(deps, now)
  assert.equal(second.sent, 0)
  assert.equal(second.already_sent, 4)
})

test('overdue: a new deadline after an extension can alert again', async () => {
  const { deps, nx } = setup({ tasks: [teamTask({ status: 'assigned' })] })
  assert.equal((await alertOverdue(deps, new Date('2026-10-31T00:00:00Z'))).sent, 1)
  Object.assign(nx.tables.tasks[0], { extension_status: 'granted', extended_deadline_at: '2026-11-03T00:00:00Z' })
  assert.equal((await alertOverdue(deps, new Date('2026-11-01T00:00:00Z'))).sent, 0, 'not yet due again')
  assert.equal((await alertOverdue(deps, new Date('2026-11-04T00:00:00Z'))).sent, 1)
})

test('overdue: works without the community client (team only)', async () => {
  const { deps } = setup({ tasks: [teamTask({ status: 'assigned' })] })
  deps.community = undefined
  assert.equal((await alertOverdue(deps, new Date('2026-10-31T00:00:00Z'))).sent, 1)
})
