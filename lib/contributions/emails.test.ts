import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  changesRequestedEmail,
  escapeHtml,
  extensionDecidedEmail,
  rejectedEmail,
  reviewResultEmail,
  taskAssignedEmail,
  verifiedEmail,
} from './emails'
import { personalise } from '../email/compose'

const evil = '<img src=x onerror=alert(1)> "q" & {{email}}'
const url = 'https://example.com/dashboard/my-tasks/1?a=1&b=2'

test('escapeHtml escapes markup, quotes and placeholder braces', () => {
  assert.equal(escapeHtml('<a href="x">&{{name}}</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#123;&#123;name&#125;&#125;&lt;/a&gt;')
})

test('every template escapes interpolated user text', () => {
  const all = [
    taskAssignedEmail({ taskTitle: evil, points: evil, deadlineAt: null, url }),
    extensionDecidedEmail({ taskTitle: evil, granted: true, deadlineAt: '2026-10-01T10:00:00Z', url }),
    reviewResultEmail({ taskTitle: evil, status: 'changes_requested', summary: evil, whatToDo: evil, url }),
    changesRequestedEmail({ taskTitle: evil, notes: evil, url }),
    verifiedEmail({ taskTitle: evil, points: 144, url }),
    rejectedEmail({ taskTitle: evil, notes: evil, url }),
  ]
  for (const e of all) {
    assert.ok(!e.html.includes('<img'), e.subject)
    assert.ok(!e.html.includes('{{email}}'), 'user braces escaped: ' + e.subject)
    assert.ok(e.html.includes('href="https://example.com/dashboard/my-tasks/1?a=1&amp;b=2"'), 'link escaped')
    assert.ok(!/[\r\n{}]/.test(e.subject), 'subject is plain text')
  }
})

test("user text can't reach the sender's placeholder substitution", () => {
  const e = changesRequestedEmail({ taskTitle: 'T', notes: 'mail me at {{email}}', url })
  const sent = personalise(e.html, { email: 'member@example.com', name: 'Ada Lovelace' })
  assert.ok(sent.startsWith('<p>Hi Ada,</p>'), 'greeting placeholder still filled')
  assert.ok(!sent.includes('member@example.com'), 'user-typed {{email}} is not substituted')
})

test('review email only includes feedback when changes are needed', () => {
  assert.ok(reviewResultEmail({ taskTitle: 'T', status: 'changes_requested', summary: 'Add tests', whatToDo: '1. Add tests', url }).html.includes('Add tests'))
  assert.ok(!reviewResultEmail({ taskTitle: 'T', status: 'ai_approved', summary: 'Add tests', url }).html.includes('Add tests'))
})

test('verified email states the points', () => {
  const e = verifiedEmail({ taskTitle: 'Guide', points: 144, url })
  assert.ok(e.subject.includes('+144 points') && e.html.includes('144 points'))
})
