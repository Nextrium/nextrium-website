import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ALERT_SENDER, OPERATIONS_INBOX, alertEmail, alertKey, alertRecipients, reviewAlertKind, type AlertKind } from './rules'

const fallback = ['Admin1@nextrium.org', 'admin2@nextrium.org', OPERATIONS_INBOX]

test('recipients: the creator while they are active staff', () => {
  assert.deepEqual(alertRecipients({ creator: { email: 'Ada@X.com', activeStaff: true }, fallback }), ['ada@x.com'])
})

test('recipients: fallback (admins + operations) when there is no creator, or they left, or have no email', () => {
  const expected = ['admin1@nextrium.org', 'admin2@nextrium.org', OPERATIONS_INBOX]
  assert.deepEqual(alertRecipients({ creator: null, fallback }), expected)
  assert.deepEqual(alertRecipients({ creator: { email: 'ada@x.com', activeStaff: false }, fallback }), expected)
  assert.deepEqual(alertRecipients({ creator: { email: null, activeStaff: true }, fallback }), expected)
})

test('recipients: never the person who caused it; no duplicates; junk dropped', () => {
  assert.deepEqual(alertRecipients({ creator: { email: 'ada@x.com', activeStaff: true }, fallback, actorEmail: 'ADA@x.com' }), [], 'creator did it themselves')
  assert.deepEqual(alertRecipients({ creator: null, fallback: ['a@x.com', 'A@X.com', '', 'nope', 'b@x.com'], actorEmail: 'b@x.com' }), ['a@x.com'])
})

test('review alert kind: only states that wait on staff', () => {
  assert.equal(reviewAlertKind('team', 'ai_approved', 1), 'review_ready')
  assert.equal(reviewAlertKind('team', 'needs_human', 1), 'review_ready')
  assert.equal(reviewAlertKind('team', 'needs_human', 2), 'resubmitted')
  assert.equal(reviewAlertKind('team', 'review_failed', 1), 'review_failed')
  for (const s of ['changes_requested', 'pending_review', 'verified', 'rejected', null, undefined]) assert.equal(reviewAlertKind('team', s, 1), null, String(s))
  assert.equal(reviewAlertKind('portal', 'ai_approved', 1, 'approved'), 'review_ready')
  assert.equal(reviewAlertKind('portal', 'under_review', 3, 'human_required'), 'resubmitted', 'handed to a person')
  assert.equal(reviewAlertKind('portal', 'under_review', 1, null), 'review_failed', 'review never finished')
  assert.equal(reviewAlertKind('portal', 'submitted', 1, null), 'review_failed')
  for (const s of ['rejected', 'verified', 'needs_human', 'pending', 'review_failed', null]) assert.equal(reviewAlertKind('portal', s, 1, 'approved'), null, String(s))
})

test('keys: one per occurrence', () => {
  assert.equal(alertKey('review_ready', 'portal', 'c1', 2), 'review_ready:portal:c1:2')
  assert.notEqual(alertKey('overdue', 'team', 't1', '2026-10-01'), alertKey('overdue', 'team', 't1', '2026-10-05'), 'an extended deadline can alert again')
  assert.ok(alertKey('overdue', 'team', 'x'.repeat(500)).length <= 300)
})

test('emails: a button to the right page, escaped content, a subject per kind', () => {
  const kinds: AlertKind[] = ['review_ready', 'resubmitted', 'review_failed', 'extension_requested', 'overdue']
  const subjects = new Set<string>()
  for (const k of kinds) {
    const e = alertEmail(k, { taskTitle: 'Fix <b>it</b> {{x}}', person: 'Ada <i>L</i>', url: 'https://dash.test/x?a=1&b="2"', verdict: 'approved <script>', reason: 'need <time>', deadline: '2026-10-30T10:00:00Z', system: 'portal' })
    subjects.add(e.subject.split(':')[0])
    assert.ok(e.html.includes('href="https://dash.test/x?a=1&amp;b=&quot;2&quot;"'), `${k}: button link`)
    assert.ok(!/<b>it<\/b>|<i>L<\/i>|<script>|<time>|\{\{x\}\}/.test(e.html), `${k}: escaped`)
    assert.match(e.html, /<a href=/, `${k}: has a call to action`)
    assert.ok(!/[\r\n{}]/.test(e.subject), `${k}: clean subject`)
  }
  assert.equal(subjects.size, kinds.length)
  assert.match(alertEmail('overdue', { taskTitle: 'T', person: 'P', url: 'u', deadline: '2026-10-30T10:00:00Z', system: 'team' }).html, /30 October 2026 at 11:00 \(Lagos\)/)
  assert.doesNotMatch(alertEmail('review_ready', { taskTitle: 'T', person: 'P', url: 'u', system: 'team' }).html, /contributor portal/)
})

test('sent from the contributors address', () => {
  assert.match(ALERT_SENDER, /^contributors@/)
})
