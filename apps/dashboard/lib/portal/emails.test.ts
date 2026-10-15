import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applicationApprovedEmail, applicationRejectedEmail, portalRejectedEmail, portalVerifiedEmail, portalExtensionDecidedEmail, portalTaskAssignedEmail, portalTaskUnassignedEmail, portalUrl, revisionRequestedEmail } from './emails'

test('links point at the contributor portal', () => {
  assert.match(portalUrl('/tasks'), /^https?:\/\/[^/]+\/tasks$/)
  assert.ok(applicationApprovedEmail().html.includes(portalUrl('/signin?next=/dashboard')))
})

test('staff notes are escaped and cannot inject markup or placeholders', () => {
  const e = revisionRequestedEmail('Add <script>x</script> {{email}}\nthanks')
  assert.ok(!e.html.includes('<script>'))
  assert.ok(!e.html.includes('{{email}}'))
  assert.ok(e.html.includes('&lt;script&gt;'))
  assert.ok(e.html.includes('<br>'))
})

test('rejection shows a reason only when given', () => {
  assert.ok(!applicationRejectedEmail(null).html.includes('Reason'))
  assert.ok(applicationRejectedEmail('Not a fit').html.includes('Not a fit'))
})

test('subjects are single-line and placeholder-free', () => {
  for (const e of [applicationApprovedEmail(), revisionRequestedEmail('x'), applicationRejectedEmail(null)]) {
    assert.ok(!/[\r\n{}]/.test(e.subject), e.subject)
    assert.ok(e.html.startsWith('<p>Hi {{name}},</p>'))
  }
})

test('task emails link to the portal dashboard and escape titles', () => {
  const a = portalTaskAssignedEmail({ taskTitle: 'Fix <b>it</b>', points: '10–30', deadlineAt: '2026-10-18T12:00:00Z', taskId: 'abc' })
  assert.ok(a.html.includes(portalUrl('/dashboard/tasks/abc')))
  assert.ok(!a.html.includes('<b>it</b>'))
  assert.ok(a.html.includes('18 Oct 2026'))
  assert.match(portalExtensionDecidedEmail({ taskTitle: 'T', granted: true, deadlineAt: null, taskId: 'x' }).subject, /^Extension granted/)
  assert.match(portalExtensionDecidedEmail({ taskTitle: 'T', granted: false, deadlineAt: null, taskId: 'x' }).html, /declined/)
  assert.ok(!portalTaskUnassignedEmail({ taskTitle: 'T', reason: null }).html.includes('<p></p>'))
})

test('decision emails carry points and the escaped note', () => {
  const v = portalVerifiedEmail({ title: 'Docs', points: 25, note: 'Great <i>work</i>', contributionId: 'c1' })
  assert.ok(v.html.includes('25 points') && v.html.includes('&lt;i&gt;') && v.html.includes(portalUrl('/dashboard/submissions/c1')))
  assert.ok(!portalVerifiedEmail({ title: 'Docs', points: 25, note: null, contributionId: 'c1' }).html.includes('Note from'))
  const r = portalRejectedEmail({ title: 'Docs', note: 'Copied work.', contributionId: 'c1' })
  assert.match(r.subject, /^Submission not accepted/)
  assert.ok(r.html.includes('Copied work.'))
})
