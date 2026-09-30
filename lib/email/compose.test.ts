import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ARCHIVED_RECIPIENT_ERROR,
  defaultSender,
  personalise,
  splitArchivedRecipients,
  toArchivedEmailSet,
  validateEmailInput,
  wrapBrandedHtml,
} from './compose'

test('validateEmailInput returns the route’s messages in order', () => {
  const recipients = [{ email: 'a@example.com' }]
  assert.equal(validateEmailInput({ subject: '', message: 'hi', recipients }), 'Subject is required.')
  assert.equal(validateEmailInput({ subject: '   ', message: 'hi', recipients }), 'Subject is required.')
  assert.equal(validateEmailInput({ subject: 's', message: '', recipients }), 'Message is required.')
  assert.equal(validateEmailInput({ subject: 's', message: 'hi', recipients: [] }), 'At least one recipient is required.')
  assert.equal(validateEmailInput({ subject: 's', message: 'hi', recipients }), null)
})

test('validateEmailInput treats an empty rich-text editor as no message', () => {
  const recipients = [{ email: 'a@example.com' }]
  assert.equal(validateEmailInput({ subject: 's', message: '<p></p>', recipients }), 'Message is required.')
  assert.equal(validateEmailInput({ subject: 's', message: '<p>  <br></p>', recipients }), 'Message is required.')
  assert.equal(validateEmailInput({ subject: 's', message: '<p>Hello</p>', recipients }), null)
})

test('validateEmailInput rejects wrong types instead of throwing', () => {
  assert.equal(validateEmailInput({ subject: 42, message: 'hi', recipients: [{ email: 'a@b.c' }] }), 'Subject is required.')
  assert.equal(validateEmailInput({ subject: 's', message: 'hi', recipients: 'a@b.c' }), 'At least one recipient is required.')
})

test('archived recipients are suppressed case-insensitively and reported', () => {
  const archived = toArchivedEmailSet([{ email: ' Kemi@Example.com ' }, { email: null }, { email: '' }])
  const { sendable, blocked } = splitArchivedRecipients(
    [{ email: 'KEMI@example.COM', name: 'Kemi' }, { email: 'ada@example.com', name: 'Ada' }],
    archived,
  )
  assert.deepEqual(sendable.map((r) => r.email), ['ada@example.com'])
  assert.deepEqual(blocked, [{ email: 'KEMI@example.COM', success: false, error: ARCHIVED_RECIPIENT_ERROR }])
})

test('toArchivedEmailSet ignores empty addresses', () => {
  assert.equal(toArchivedEmailSet([{ email: '' }, { email: null }, {}]).size, 0)
})

test('personalise fills first name, role and email', () => {
  const out = personalise('Hi {{name}}, re {{role}} ({{email}}). Bye {{name}}.', {
    email: 'ada@example.com', name: '  Ada Lovelace', role: 'Engineer',
  })
  assert.equal(out, 'Hi Ada, re Engineer (ada@example.com). Bye Ada.')
})

test('personalise falls back when name or role is missing', () => {
  assert.equal(personalise('Hi {{name}} — {{role}}', { email: 'x@example.com' }), 'Hi there — your applied role')
})

test('wrapBrandedHtml places the body and the sender signature', () => {
  const sender = { ...defaultSender('hello@example.com'), signatureName: 'Sig', signatureTitle: 'Title' }
  const html = wrapBrandedHtml('<p>Body</p>', sender)
  assert.ok(html.includes('<p>Body</p>'))
  assert.ok(html.includes('>Sig</p>'))
  assert.ok(html.includes('>Title</p>'))
  assert.ok(html.includes('href="mailto:hello@example.com"'))
})

test('defaultSender uses the configured address', () => {
  assert.equal(defaultSender('ops@example.com').email, 'ops@example.com')
})
