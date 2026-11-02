import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildContactEmail } from './contactEmail'

const MARKUP = '<a href="http://other.invalid">Click</a>'
const base = { firstName: 'Ada', lastName: 'Obi', email: 'ada@example.com', organisation: 'Acme', subjectType: 'press', message: 'Hello\nthere' }

test('plain text reaches the email, with a working reply link', () => {
  const { html, subject, replyName } = buildContactEmail(base)
  assert.match(subject, /Press enquiry from Ada Obi$/)
  assert.equal(replyName, 'Ada Obi')
  for (const text of ['Ada Obi', 'Acme', 'Hello\nthere', 'Press enquiry', 'mailto:ada%40example.com']) assert.ok(html.includes(text), text)
})

test('markup in any field is escaped', () => {
  for (const field of ['firstName', 'lastName', 'email', 'organisation', 'message']) {
    const { html } = buildContactEmail({ ...base, [field]: MARKUP })
    assert.ok(!html.includes(MARKUP), field)
    assert.ok(!html.includes('href="http://other.invalid"'), field)
  }
})

test("an email address can't break out of the reply links", () => {
  const { html } = buildContactEmail({ ...base, email: 'a@example.com"><img src=x>?bcc=b@example.com' })
  assert.ok(!html.includes('<img'))
  const links = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
  assert.equal(links.length, 2)
  for (const link of links) assert.ok(!link.includes('?bcc='), link)
})

test('line breaks are removed from the subject and sender name', () => {
  const { subject, replyName } = buildContactEmail({ ...base, firstName: 'Ada\r\nBcc: x@example.com' })
  assert.ok(!/[\r\n]/.test(subject))
  assert.ok(!/[\r\n]/.test(replyName))
})

test('unknown subject types use the default label', () => {
  for (const subjectType of ['constructor', '__proto__', '<b>x</b>', undefined, 5]) {
    const { html, subject } = buildContactEmail({ ...base, subjectType })
    assert.ok(subject.includes('New enquiry'))
    assert.ok(!html.includes('<b>x</b>'))
  }
})
