import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFakeSupabase } from './fakeSupabase'

test('fake: filters, order, limit and counts behave like PostgREST', async () => {
  const { client } = createFakeSupabase({ t: [{ id: 'a', n: 2, s: 'x' }, { id: 'b', n: 1, s: 'y' }, { id: 'c', n: 3, s: null }] })
  assert.deepEqual((await client.from('t').select('*').order('n')).data.map((r: any) => r.id), ['b', 'a', 'c'])
  assert.deepEqual((await client.from('t').select('*').order('n', { ascending: false }).limit(1)).data.map((r: any) => r.id), ['c'])
  assert.deepEqual((await client.from('t').select('*').in('id', ['a', 'c'])).data.map((r: any) => r.id), ['a', 'c'])
  assert.deepEqual((await client.from('t').select('*').is('s', null)).data.map((r: any) => r.id), ['c'])
  assert.equal((await client.from('t').select('id', { count: 'exact', head: true }).neq('id', 'a')).count, 2)
})

test('fake: maybeSingle fails on several rows, like the real client', async () => {
  const { client } = createFakeSupabase({ t: [{ id: 'a', k: 1 }, { id: 'b', k: 1 }] })
  const many = await client.from('t').select('*').eq('k', 1).maybeSingle()
  assert.equal(many.data, null)
  assert.equal(many.error.code, 'PGRST116')
  const none = await client.from('t').select('*').eq('k', 9).maybeSingle()
  assert.deepEqual(none, { data: null, error: null })
})

test('fake: unique constraint gives 23505 on insert and update', async () => {
  const { client, tables } = createFakeSupabase({ u: [{ id: '1', user_id: 'x' }] }, { unique: { u: ['user_id'] } })
  const dup = await client.from('u').insert({ user_id: 'x' })
  assert.equal(dup.error.code, '23505')
  assert.equal(tables.u.length, 1)
  await client.from('u').insert({ user_id: 'y' })
  const clash = await client.from('u').update({ user_id: 'x' }).eq('user_id', 'y')
  assert.equal(clash.error.code, '23505')
  // two equal rows in one insert also clash
  assert.equal((await client.from('u').insert([{ user_id: 'z' }, { user_id: 'z' }])).error.code, '23505')
})

test('fake: ilike matches case-insensitively and escapes wildcards', async () => {
  const { client } = createFakeSupabase({ a: [{ id: '1', email: 'Ada@Example.com' }, { id: '2', email: 'adaXexample.com' }] })
  assert.deepEqual((await client.from('a').select('*').ilike('email', 'ada@example.com')).data.map((r: any) => r.id), ['1'])
  assert.deepEqual((await client.from('a').select('*').ilike('email', 'ada\\_example.com')).data, [])
})

test('fake: guarded update only touches matching rows; failNextWrite fails once', async () => {
  const { client, tables } = createFakeSupabase({ t: [{ id: 'a', v: null }, { id: 'b', v: 'set' }] }, { failNextWrite: { t: { code: 'XX', message: 'boom' } } })
  assert.equal((await client.from('t').update({ v: 'new' }).is('v', null)).error.code, 'XX')
  const ok = await client.from('t').update({ v: 'new' }).is('v', null).select('id')
  assert.deepEqual(ok.data.map((r: any) => r.id), ['a'])
  assert.equal(tables.t.find((r) => r.id === 'b')!.v, 'set')
})
