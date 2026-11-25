import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDaysYmd,
  cycleDeadlineAt,
  describeSchedule,
  draftExpiryLabel,
  evaluateRecurringTaskLifecycle,
  firstOccurrenceOnOrAfter,
  formatOccurrenceTitle,
  isRecurringGraceDraft,
  isScheduleDue,
  lagosToday,
  nextOccurrenceAfter,
  parseRecurringOptions,
} from './recurring'
import { parseDirectSubmission, DIRECT_SUBMISSION_MIN_WORDS } from './submission'
import { recurringDeadlineReminderEmail, recurringMovedToDraftEmail } from './emails'

test('Lagos date helper and calendar math handle UTC+1 cleanly', () => {
  // 23:30 UTC on Nov 24 is 00:30 WAT on Nov 25
  assert.equal(lagosToday(new Date('2026-11-24T23:30:00Z')), '2026-11-25')
  assert.equal(addDaysYmd('2026-11-25', 7), '2026-12-02')
})

test('firstOccurrenceOnOrAfter and nextOccurrenceAfter cover daily, weekdays, weekly, biweekly, monthly and end bounds', () => {
  // Weekly on Friday starting Wednesday 2026-11-25 -> first is Friday 2026-11-27
  const weekly = {
    cadence: 'weekly' as const,
    day_of_week: 5,
    day_of_month: null,
    starts_on: '2026-11-25',
    ends_on: '2026-12-10',
    max_occurrences: null,
    occurrences_created: 0,
  }
  assert.equal(firstOccurrenceOnOrAfter(weekly, '2026-11-25'), '2026-11-27')
  assert.equal(nextOccurrenceAfter(weekly, '2026-11-27'), '2026-12-04')
  assert.equal(nextOccurrenceAfter(weekly, '2026-12-04'), null, 'Dec 11 exceeds ends_on Dec 10')

  // Weekdays skips Saturday and Sunday
  const weekdays = {
    cadence: 'weekdays' as const,
    day_of_week: null,
    day_of_month: null,
    starts_on: '2026-11-27', // Friday
    ends_on: null,
    max_occurrences: null,
    occurrences_created: 0,
  }
  assert.equal(nextOccurrenceAfter(weekdays, '2026-11-27'), '2026-11-30')

  // Monthly rolls year cleanly
  const monthly = {
    cadence: 'monthly' as const,
    day_of_week: null,
    day_of_month: 15,
    starts_on: '2026-12-01',
    ends_on: null,
    max_occurrences: 2,
    occurrences_created: 1,
  }
  assert.equal(nextOccurrenceAfter(monthly, '2026-12-15'), '2027-01-15')
  assert.equal(nextOccurrenceAfter({ ...monthly, occurrences_created: 2 }, '2027-01-15'), null, 'hit max_occurrences')
})

test('parseRecurringOptions validates ranges, caps, assignees, and defaults skip_automated_review to true', () => {
  const ok = parseRecurringOptions(
    {
      cadence: 'weekly',
      dayOfWeek: 1,
      startsOn: '2026-11-25',
      endMode: 'date',
      endsOn: '2026-12-31',
      durationDays: 5,
      assignmentMode: 'one',
      assigneeIds: ['11111111-1111-4111-8111-111111111111'],
    },
    { category: 'operations', complexity: 'small' },
    '2026-11-25',
  )
  assert.ok('options' in ok)
  assert.equal(ok.options.skip_automated_review, true)
  assert.equal(ok.options.duration_days, 5)
  assert.equal(ok.options.next_run_on, '2026-11-30')

  // Rejects end date before start date
  const badRange = parseRecurringOptions(
    { cadence: 'weekly', startsOn: '2026-12-10', endMode: 'date', endsOn: '2026-12-01', assignmentMode: 'draft' },
    { category: 'operations', complexity: 'small' },
    '2026-11-25',
  )
  assert.ok('error' in badRange)

  // Rejects range containing zero occurrences (e.g. starts Wed, ends Thu, weekly on Fri)
  const emptyRange = parseRecurringOptions(
    { cadence: 'weekly', dayOfWeek: 5, startsOn: '2026-11-25', endMode: 'date', endsOn: '2026-11-26', assignmentMode: 'draft' },
    { category: 'operations', complexity: 'small' },
    '2026-11-25',
  )
  assert.ok('error' in emptyRange)

  // Rejects bad duration and group with < 2 people
  assert.ok('error' in parseRecurringOptions({ cadence: 'daily', durationDays: 0, assignmentMode: 'draft' }, { category: 'operations', complexity: 'small' }, '2026-11-25'))
  assert.ok('error' in parseRecurringOptions({ cadence: 'daily', durationDays: 45, assignmentMode: 'draft' }, { category: 'operations', complexity: 'small' }, '2026-11-25'))
  assert.ok('error' in parseRecurringOptions({ cadence: 'daily', assignmentMode: 'group', assigneeIds: ['11111111-1111-4111-8111-111111111111'] }, { category: 'operations', complexity: 'small' }, '2026-11-25'))
})

test('recurring lifecycle enforces: deadline -> 24h reminder -> 3-day draft -> auto-delete (never touching submitted or normal tasks)', () => {
  const base = {
    recurring_task_id: 'sched-1',
    status: 'assigned',
    deadline_at: '2026-11-27T07:00:00Z',
    extended_deadline_at: null,
    extension_status: 'none',
    grace_reminder_sent_at: null,
    grace_draft_at: null,
    expires_at: null,
  }

  // Before deadline -> none
  assert.equal(evaluateRecurringTaskLifecycle(base, false, new Date('2026-11-27T06:59:00Z')), 'none')
  // Non-recurring task -> always none
  assert.equal(evaluateRecurringTaskLifecycle({ ...base, recurring_task_id: null }, false, new Date('2026-12-10T00:00:00Z')), 'none')
  // Submitted task -> always none (NEVER deleted!)
  assert.equal(evaluateRecurringTaskLifecycle({ ...base, grace_draft_at: '2026-11-28T08:00:00Z', expires_at: '2026-12-01T08:00:00Z' }, true, new Date('2026-12-10T00:00:00Z')), 'none')

  // Deadline passed -> send 24h reminder
  assert.equal(evaluateRecurringTaskLifecycle(base, false, new Date('2026-11-27T08:00:00Z')), 'send_reminder')

  // Reminder sent 12h ago -> wait full 24h
  const reminded = { ...base, grace_reminder_sent_at: '2026-11-27T08:00:00Z' }
  assert.equal(evaluateRecurringTaskLifecycle(reminded, false, new Date('2026-11-27T20:00:00Z')), 'none')
  // 24h after reminder -> move to 3-day draft
  assert.equal(evaluateRecurringTaskLifecycle(reminded, false, new Date('2026-11-28T08:00:00Z')), 'move_to_draft')

  // In 3-day draft window -> kept until expires_at
  const inDraft = { ...reminded, grace_draft_at: '2026-11-28T08:00:00Z', expires_at: '2026-12-01T08:00:00Z' }
  assert.equal(isRecurringGraceDraft(inDraft), true)
  assert.equal(evaluateRecurringTaskLifecycle(inDraft, false, new Date('2026-11-30T08:00:00Z')), 'none')
  assert.equal(evaluateRecurringTaskLifecycle(inDraft, false, new Date('2026-12-01T08:00:00Z')), 'auto_delete')
})

test('parseDirectSubmission accepts 10+ words with optional https link and rejects unsafe links', () => {
  const tenWords = Array.from({ length: DIRECT_SUBMISSION_MIN_WORDS }, (_, i) => `word${i}`).join(' ')
  const noLink = parseDirectSubmission({ title: 'Weekly call attendance', description: tenWords, evidenceUrl: '' })
  assert.ok('submission' in noLink)
  assert.equal(noLink.submission.evidenceUrl, null)

  const withLink = parseDirectSubmission({ title: 'Weekly ops', description: tenWords, evidenceUrl: 'https://docs.example/notes' })
  assert.ok('submission' in withLink)
  assert.equal(withLink.submission.evidenceUrl, 'https://docs.example/notes')

  assert.ok('error' in parseDirectSubmission({ title: 'Short', description: 'only four words here', evidenceUrl: '' }))
  assert.ok('error' in parseDirectSubmission({ title: 'Bad link', description: tenWords, evidenceUrl: 'javascript:alert(1)' }))
  assert.ok('error' in parseDirectSubmission({ title: 'Http link', description: tenWords, evidenceUrl: 'http://insecure.example' }))
})

test('helpers format titles, deadlines, schedules, due checks, and escape reminder/draft emails', () => {
  assert.equal(formatOccurrenceTitle('Weekly Ops', '2026-11-25'), 'Weekly Ops — 25 Nov 2026')
  assert.equal(cycleDeadlineAt('2026-11-25', 5), '2026-11-30T07:00:00.000Z')
  assert.equal(isScheduleDue({ status: 'active', next_run_on: '2026-11-25', ends_on: null, max_occurrences: null, occurrences_created: 0 }, '2026-11-25'), true)
  assert.equal(isScheduleDue({ status: 'paused', next_run_on: '2026-11-25', ends_on: null, max_occurrences: null, occurrences_created: 0 }, '2026-11-25'), false)
  assert.match(draftExpiryLabel('2026-12-01T08:00:00Z', new Date('2026-11-28T08:00:00Z')), /3 days/)
  assert.match(describeSchedule({ cadence: 'weekly', day_of_week: 5, day_of_month: null, starts_on: '2026-11-25', ends_on: '2026-12-31', max_occurrences: null }), /Weekly on Fridays/)

  const rem = recurringDeadlineReminderEmail({ taskTitle: 'Call <script>1</script> {{x}}', deadlineAt: '2026-11-27T07:00:00Z', url: 'https://dash.example/my-tasks/1' })
  assert.ok(!rem.html.includes('<script>'))
  assert.ok(!rem.html.includes('{{x}}'))
  assert.match(rem.html, /24 hours/)

  const dr = recurringMovedToDraftEmail({ taskTitle: 'Call <b>1</b>', expiresAt: '2026-12-01T08:00:00Z', url: 'https://dash.example/my-tasks/1' })
  assert.ok(!dr.html.includes('<b>1</b>'))
  assert.match(dr.html, /3 days|removed/)
})
