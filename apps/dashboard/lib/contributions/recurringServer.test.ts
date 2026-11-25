import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeSupabase } from '../testing/fakeSupabase'
import {
  processRecurringTaskLifecycle,
  runDueRecurringSchedules,
  spawnScheduleOccurrence,
  type RecurringDeps,
} from './recurringServer'
import type { RecurringTask } from '@nextrium/supabase/database'

const ADMIN = '00000000-0000-4000-8000-000000000001'
const M1 = '00000000-0000-4000-8000-000000000011'
const M2 = '00000000-0000-4000-8000-000000000012'
const ARCHIVED = '00000000-0000-4000-8000-000000000013'

function makeSetup(seed: Record<string, any[]> = {}) {
  const fake = createFakeSupabase(
    {
      dashboard_users: [
        { user_id: ADMIN, role: 'admin', archived: false, onboarding_completed_at: '2026-01-01T00:00:00Z' },
        { user_id: M1, role: 'member', archived: false, onboarding_completed_at: '2026-01-01T00:00:00Z' },
        { user_id: M2, role: 'member', archived: false, onboarding_completed_at: '2026-01-01T00:00:00Z' },
        { user_id: ARCHIVED, role: 'member', archived: true, onboarding_completed_at: '2026-01-01T00:00:00Z' },
      ],
      recurring_tasks: [],
      recurring_task_runs: [],
      tasks: [],
      contributions: [],
      ...seed,
    },
    { unique: { recurring_task_runs: ['recurring_task_id', 'occurrence_date'] } },
  )
  // Wire assign_contribution_task RPC against the in-memory tasks table.
  ;(fake.client as any).rpc = async (fn: string, args: any) => {
    if (fn === 'assign_contribution_task') {
      const row = fake.tables.tasks.find((t) => t.id === args.p_task_id)
      if (!row) return { data: null, error: { message: 'task_not_found' } }
      row.status = 'assigned'
      row.assigned_to = args.p_assignee
      row.assigned_by = args.p_actor
      row.deadline_at = args.p_deadline_at
      return { data: row, error: null }
    }
    return { data: null, error: { message: 'unknown_rpc' } }
  }

  const notified: { userId: string; subject: string; html: string }[] = []
  const logged: { action: string; targetId: string }[] = []
  const deps: RecurringDeps = {
    db: fake.client,
    link: (p) => `https://dash.example${p}`,
    notify: async (userId, content) => {
      notified.push({ userId, subject: content.subject, html: content.html })
      return true
    },
    log: async (entry) => {
      logged.push({ action: entry.action, targetId: entry.targetId })
    },
  }
  return { fake, deps, notified, logged }
}

const baseSchedule = (over: Partial<RecurringTask> = {}): RecurringTask => ({
  id: 'sched-1',
  title: 'Weekly Team Call',
  description: '<p>Join the weekly sync and confirm updates.</p>',
  category: 'operations',
  complexity: 'small',
  point_range_min: 30,
  point_range_max: 60,
  duration_days: 1,
  links: [],
  cadence: 'weekly',
  day_of_week: 5,
  day_of_month: null,
  starts_on: '2026-11-27',
  ends_on: '2026-12-04',
  max_occurrences: null,
  occurrences_created: 0,
  next_run_on: '2026-11-27',
  last_run_on: null,
  assignment_mode: 'group',
  assignee_ids: [M1, M2, ARCHIVED],
  skip_automated_review: true,
  status: 'active',
  created_by: ADMIN,
  created_at: '2026-11-25T00:00:00Z',
  updated_at: '2026-11-25T00:00:00Z',
  ...over,
})

test('spawnScheduleOccurrence creates group copies for active members only, skips archived, prevents duplicates, and advances next_run_on', async () => {
  const sched = baseSchedule()
  const { fake, deps, notified } = makeSetup({ recurring_tasks: [sched] })

  const first = await spawnScheduleOccurrence(deps, sched, '2026-11-27', { userId: ADMIN }, new Date('2026-11-27T07:00:00Z'))
  assert.equal(first.outcome, 'spawned')
  assert.equal(first.taskIds.length, 2, 'archived member is skipped')
  assert.equal(first.assignedCount, 2)
  assert.equal(notified.length, 2)
  assert.equal(fake.tables.tasks[0].skip_automated_review, true)
  assert.equal(fake.tables.tasks[0].recurring_task_id, 'sched-1')
  assert.ok(fake.tables.tasks[0].group_id && fake.tables.tasks[0].group_id === fake.tables.tasks[1].group_id)
  assert.equal(fake.tables.recurring_tasks[0].next_run_on, '2026-12-04')
  assert.equal(fake.tables.recurring_tasks[0].status, 'active')

  // Duplicate retry for same date sends nothing and spawns nothing
  const dup = await spawnScheduleOccurrence(deps, sched, '2026-11-27', { userId: ADMIN }, new Date('2026-11-27T08:00:00Z'))
  assert.equal(dup.outcome, 'already_spawned')
  assert.equal(fake.tables.tasks.length, 2)
  assert.equal(notified.length, 2)
})

test('runDueRecurringSchedules completes schedule after final occurrence inside date range', async () => {
  const sched = baseSchedule({ starts_on: '2026-11-27', ends_on: '2026-11-27', next_run_on: '2026-11-27', assignment_mode: 'one', assignee_ids: [M1] })
  const { fake, deps } = makeSetup({ recurring_tasks: [sched] })

  const res = await runDueRecurringSchedules(deps, new Date('2026-11-27T07:00:00Z'))
  assert.equal(res.spawned, 1)
  assert.equal(fake.tables.recurring_tasks[0].status, 'completed')
  assert.equal(fake.tables.recurring_tasks[0].next_run_on, null)
})

test('processRecurringTaskLifecycle runs 24h reminder -> 3-day draft -> auto-delete, never deleting submitted or normal tasks', async () => {
  const { fake, deps, notified } = makeSetup({
    recurring_task_runs: [{ id: 'run-1', recurring_task_id: 'sched-1', occurrence_date: '2026-11-27', outcome: 'spawned', task_count: 1 }],
    tasks: [
      {
        id: 't-unsubmitted',
        title: 'Weekly Call — 27 Nov 2026',
        assigned_to: M1,
        status: 'assigned',
        deadline_at: '2026-11-28T07:00:00Z',
        extended_deadline_at: null,
        extension_status: 'none',
        recurring_task_id: 'sched-1',
        occurrence_date: '2026-11-27',
        grace_reminder_sent_at: null,
        grace_draft_at: null,
        expires_at: null,
      },
      {
        id: 't-submitted',
        title: 'Weekly Call — 27 Nov 2026',
        assigned_to: M2,
        status: 'assigned',
        deadline_at: '2026-11-28T07:00:00Z',
        extended_deadline_at: null,
        extension_status: 'none',
        recurring_task_id: 'sched-1',
        occurrence_date: '2026-11-27',
        grace_reminder_sent_at: '2026-11-28T08:00:00Z',
        grace_draft_at: '2026-11-29T08:00:00Z',
        expires_at: '2026-12-02T08:00:00Z',
      },
      {
        id: 't-normal',
        title: 'One-off task',
        assigned_to: M1,
        status: 'assigned',
        deadline_at: '2026-11-01T00:00:00Z',
        extended_deadline_at: null,
        extension_status: 'none',
        recurring_task_id: null,
        occurrence_date: null,
        grace_reminder_sent_at: null,
        grace_draft_at: null,
        expires_at: null,
      },
    ],
    contributions: [{ id: 'sub-1', task_id: 't-submitted', contributor_id: M2 }],
  })

  // Step 1: Deadline passed -> sends 24h reminder
  const r1 = await processRecurringTaskLifecycle(deps, new Date('2026-11-28T08:00:00Z'))
  assert.equal(r1.reminded, 1)
  assert.equal(r1.movedToDraft, 0)
  assert.equal(r1.deleted, 0)
  assert.match(notified[0].subject, /24-hour reminder/)

  // Step 2: 24 hours later -> moves to 3-day draft
  const r2 = await processRecurringTaskLifecycle(deps, new Date('2026-11-29T08:00:00Z'))
  assert.equal(r2.movedToDraft, 1)
  assert.equal(r2.deleted, 0)
  assert.ok(fake.tables.tasks.find((t) => t.id === 't-unsubmitted')!.grace_draft_at)
  assert.match(notified[1].subject, /Saved as draft/)

  // Step 3: 3 days later -> auto-deletes unsubmitted recurring task ONLY (keeps submitted & normal tasks!)
  const r3 = await processRecurringTaskLifecycle(deps, new Date('2026-12-02T08:00:00Z'))
  assert.equal(r3.deleted, 1)
  assert.equal(fake.tables.tasks.some((t) => t.id === 't-unsubmitted'), false)
  assert.equal(fake.tables.tasks.some((t) => t.id === 't-submitted'), true, 'submitted task must never be deleted')
  assert.equal(fake.tables.tasks.some((t) => t.id === 't-normal'), true, 'normal one-off task must never be deleted')
})
