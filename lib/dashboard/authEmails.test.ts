import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAuthEmails } from './authEmails'

function fakeAuth(total: number) {
  const users = Array.from({ length: total }, (_, i) => ({ id: `u${i}`, email: `u${i}@example.com` }))
  const pages: number[] = []
  return {
    pages,
    client: {
      auth: {
        admin: {
          async listUsers({ page, perPage }: { page: number; perPage: number }) {
            pages.push(page)
            return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }
          },
        },
      },
    },
  }
}

test('finds users past the first page', async () => {
  const { client, pages } = fakeAuth(2500)
  const emails = await getAuthEmails(client, ['u3', 'u2400'])
  assert.equal(emails.get('u3'), 'u3@example.com')
  assert.equal(emails.get('u2400'), 'u2400@example.com')
  assert.deepEqual(pages, [1, 2, 3])
})

test('stops as soon as every id is found', async () => {
  const { client, pages } = fakeAuth(2500)
  await getAuthEmails(client, ['u1', 'u10'])
  assert.deepEqual(pages, [1])
})

test('no ids makes no calls; unknown ids stay missing', async () => {
  const empty = fakeAuth(10)
  assert.equal((await getAuthEmails(empty.client, [])).size, 0)
  assert.deepEqual(empty.pages, [])

  const { client, pages } = fakeAuth(10)
  const emails = await getAuthEmails(client, ['nope'])
  assert.equal(emails.has('nope'), false)
  assert.deepEqual(pages, [1])
})

test('an auth error returns what was found so far', async () => {
  const client = { auth: { admin: { async listUsers() { return { data: null, error: new Error('down') } } } } }
  assert.equal((await getAuthEmails(client, ['u1'])).size, 0)
})
