import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_PINS, applyPinOp, canPinOn, describePinError, isPinSite, parsePinList } from './pins'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('sites: only known sites', () => {
  assert.ok(isPinSite('nextrium'))
  assert.ok(isPinSite('zivana'))
  for (const bad of ['', 'Nextrium', 'toString', '__proto__', null, 3]) assert.ok(!isPinSite(bad), String(bad))
})

test('canPinOn: published only; parent takes any brand; a brand site only its own', () => {
  const zv = { is_published: true, brand: 'zivana' }
  const nx = { is_published: true, brand: 'nextrium' }
  assert.ok(canPinOn('nextrium', zv), 'parent blog can feature a Zivana post')
  assert.ok(canPinOn('nextrium', nx))
  assert.ok(canPinOn('zivana', zv))
  assert.ok(!canPinOn('zivana', nx), 'Zivana site cannot pin a Nextrium post')
  assert.ok(!canPinOn('nextrium', { ...nx, is_published: false }), 'drafts never')
  assert.ok(canPinOn('nextrium', { is_published: true, brand: null }), 'no brand counts as Nextrium')
})

test('parsePinList: ids, each once, at most 5; anything else refused', () => {
  assert.deepEqual(parsePinList([]), { ids: [] })
  assert.deepEqual(parsePinList([id(1), id(2).toUpperCase()]), { ids: [id(1), id(2)] })
  assert.ok('error' in parsePinList([id(1), id(1)]))
  assert.ok('error' in parsePinList(Array.from({ length: MAX_PINS + 1 }, (_, i) => id(i + 1))))
  for (const bad of [null, 'x', {}, [1], ['nope'], [id(1), null]]) assert.ok('error' in parsePinList(bad), JSON.stringify(bad))
})

test('applyPinOp: pin to the end, unpin, move within bounds', () => {
  assert.deepEqual(applyPinOp([], { kind: 'pin', id: 'a' }), { ids: ['a'] })
  assert.deepEqual(applyPinOp(['a', 'b'], { kind: 'pin', id: 'c' }), { ids: ['a', 'b', 'c'] })
  assert.ok('error' in applyPinOp(['a'], { kind: 'pin', id: 'a' }), 'already pinned')
  assert.ok('error' in applyPinOp(['a', 'b', 'c', 'd', 'e'], { kind: 'pin', id: 'f' }), 'full at 5')
  assert.deepEqual(applyPinOp(['a', 'b', 'c'], { kind: 'unpin', id: 'b' }), { ids: ['a', 'c'] })
  assert.ok('error' in applyPinOp(['a'], { kind: 'unpin', id: 'z' }))
  assert.deepEqual(applyPinOp(['a', 'b', 'c'], { kind: 'move', id: 'c', by: -1 }), { ids: ['a', 'c', 'b'] })
  assert.deepEqual(applyPinOp(['a', 'b', 'c'], { kind: 'move', id: 'a', by: 1 }), { ids: ['b', 'a', 'c'] })
  assert.deepEqual(applyPinOp(['a', 'b'], { kind: 'move', id: 'a', by: -1 }), { ids: ['a', 'b'] }, 'top stays top')
  assert.deepEqual(applyPinOp(['a', 'b'], { kind: 'move', id: 'b', by: 1 }), { ids: ['a', 'b'] }, 'bottom stays bottom')
})

test('describePinError: database refusals in words', () => {
  assert.match(describePinError('at most 5 pinned posts'), /At most 5/)
  assert.match(describePinError('duplicate post'), /only be pinned once/)
  assert.match(describePinError('post not pinnable'), /Only published/)
  assert.match(describePinError(undefined), /Could not save/)
})

// ── saving and loading against a fake database ──────────────────────────────

import { loadPins, savePostPins } from './pins'
import { isRestricted } from './accessControl'
import { createFakeSupabase } from '../testing/fakeSupabase'

/** Mirrors the SQL function set_post_pins, so the wiring is tested end to end in-process. */
function fakeDb(posts: any[], existing: any[] = []) {
  return createFakeSupabase({ posts, post_pins: existing }, {
    rpc: {
      set_post_pins: ({ p_site, p_post_ids }: any, tables: any) => {
        if (!['nextrium', 'zivana'].includes(p_site)) return { data: null, error: { code: 'P0001', message: 'unknown site' } }
        if (p_post_ids.length > 5) return { data: null, error: { code: 'P0001', message: 'at most 5 pinned posts' } }
        if (new Set(p_post_ids).size !== p_post_ids.length) return { data: null, error: { code: 'P0001', message: 'duplicate post' } }
        for (const id of p_post_ids) {
          const p = tables.posts.find((x: any) => x.id === id)
          if (!p || !p.is_published || (p_site !== 'nextrium' && p.brand !== p_site)) return { data: null, error: { code: 'P0001', message: 'post not pinnable' } }
        }
        tables.post_pins = tables.post_pins.filter((r: any) => r.site !== p_site)
        p_post_ids.forEach((id: string, i: number) => tables.post_pins.push({ site: p_site, post_id: id, position: i + 1 }))
        return { data: null, error: null }
      },
    },
  })
}
const posts = [
  { id: id(1), is_published: true, brand: 'nextrium' },
  { id: id(2), is_published: true, brand: 'zivana' },
  { id: id(3), is_published: false, brand: 'nextrium' },
]

test('save: a site\'s list is replaced in order and loads back the same', async () => {
  const f = fakeDb(posts)
  assert.deepEqual(await savePostPins(f.client, 'admin', 'nextrium', [id(2), id(1)]), { ok: true, ids: [id(2), id(1)] })
  assert.deepEqual(await savePostPins(f.client, 'admin', 'zivana', [id(2)]), { ok: true, ids: [id(2)] })
  const pins = await loadPins(f.client)
  assert.deepEqual(pins.nextrium, [id(2), id(1)])
  assert.deepEqual(pins.zivana, [id(2)], 'each site keeps its own list')
  assert.deepEqual(await savePostPins(f.client, 'admin', 'nextrium', []), { ok: true, ids: [] })
  assert.deepEqual((await loadPins(f.client)).nextrium, [], 'unpinning everything empties the list')
  assert.deepEqual((await loadPins(f.client)).zivana, [id(2)], 'the other site is untouched')
})

test('save: refusals happen before the database for bad input, and database refusals are explained', async () => {
  const f = fakeDb(posts)
  assert.deepEqual(await savePostPins(f.client, 'admin', 'elsewhere', [id(1)]), { ok: false, error: 'Unknown site.' })
  assert.equal((await savePostPins(f.client, 'admin', 'nextrium', 'x')).ok, false)
  assert.equal((await savePostPins(f.client, 'admin', 'nextrium', [id(1), id(1)])).ok, false)
  assert.equal(f.calls.filter((c) => c.op === 'rpc').length, 0, 'none of those reached the database')
  const draft = await savePostPins(f.client, 'admin', 'nextrium', [id(3)])
  assert.match((draft as any).error, /Only published/)
  const wrongBrand = await savePostPins(f.client, 'admin', 'zivana', [id(1)])
  assert.match((wrongBrand as any).error, /Only published|brand site/)
  assert.deepEqual((await loadPins(f.client)).nextrium, [], 'a refused save changes nothing')
})

test('save: database unavailable or function missing → clear error', async () => {
  const f = createFakeSupabase({ posts, post_pins: [] })
  const r = await savePostPins(f.client, 'admin', 'nextrium', [id(1)])
  assert.deepEqual(r, { ok: false, error: 'Could not save the pinned posts. Try again.' })
})

test('load: pins table missing or unreadable → empty lists, page still works', async () => {
  const f = createFakeSupabase({})
  f.client.from = () => ({ select: () => ({ order: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }) })
  assert.deepEqual(await loadPins(f.client), { nextrium: [], zivana: [] })
})

test('access: pinning follows who may manage posts', () => {
  for (const role of ['admin', 'moderator', 'content']) assert.equal(isRestricted('/posts', role), false, role)
  for (const role of ['community', 'member', 'unknown-role', '']) assert.equal(isRestricted('/posts', role), true, role)
})
