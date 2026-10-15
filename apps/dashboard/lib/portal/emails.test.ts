import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applicationApprovedEmail, applicationRejectedEmail, portalUrl, revisionRequestedEmail } from './emails'

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
