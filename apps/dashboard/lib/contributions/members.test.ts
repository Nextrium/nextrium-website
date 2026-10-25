import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMemberDirectory, memberDisplayName } from './members'
import { createFakeSupabase } from '../testing/fakeSupabase'

test('name: most deliberate source first, blanks skipped', () => {
  assert.equal(memberDisplayName({ profileName: 'Ada L', linkedAppName: 'Ada Lovelace', email: 'ada@x.com' }), 'Ada L')
  assert.equal(memberDisplayName({ profileName: '  ', linkedAppName: 'Ada Lovelace' }), 'Ada Lovelace')
  assert.equal(memberDisplayName({ emailAppName: 'Ada From Email', accountName: 'Account Ada' }), 'Ada From Email')
  assert.equal(memberDisplayName({ accountName: 'Account Ada', email: 'ada@x.com' }), 'Account Ada')
  assert.equal(memberDisplayName({ email: 'ogunmola2801@gmail.com' }), 'Ogunmola2801')
  assert.equal(memberDisplayName({}), 'Unnamed member')
  assert.equal(memberDisplayName({ profileName: 'x'.repeat(500) }).length, 120, 'capped')
})

const auth = [
  { id: 'p1', email: 'profile@x.com' },
  { id: 'p2', email: 'linked@x.com' },
  { id: 'p3', email: 'Unlinked@X.com' },
  { id: 'p4', email: 'meta@x.com', user_metadata: { full_name: 'Meta Name' } },
  { id: 'p5', email: 'glory@nextrium.org' },
]

function seed(extraRows: any[] = []) {
  return createFakeSupabase({
    dashboard_users: [
      { user_id: 'p1', role: 'member', archived: false, onboarding_completed_at: '2026-10-01', application_id: null },
      { user_id: 'p2', role: 'member', archived: false, onboarding_completed_at: null, application_id: 'a2' },
      { user_id: 'p3', role: 'member', archived: false, onboarding_completed_at: null, application_id: null },
      { user_id: 'p4', role: 'admin', archived: false, onboarding_completed_at: '2026-10-01', application_id: null },
      { user_id: 'p5', role: 'moderator', archived: true, onboarding_completed_at: '2026-10-01', application_id: null },
      ...extraRows,
    ],
    contributor_profiles: [{ user_id: 'p1', display_name: 'Profile Person', categories: ['technical'], skills: ['ts'] }],
    applications: [
      { id: 'a2', email: 'linked@x.com', name: 'Linked Applicant', created_at: '2026-09-01' },
      { id: 'a3', email: 'unlinked@x.com', name: 'Older Name', created_at: '2026-08-01' },
      { id: 'a4', email: 'UNLINKED@x.com', name: 'Unlinked Applicant', created_at: '2026-09-15' },
    ],
    tasks: [{ assigned_to: 'p1', status: 'assigned' }, { assigned_to: 'p1', status: 'completed' }],
  }, {}, auth as any)
}

test('directory: every source of a name is used; nobody is Unnamed', async () => {
  const dir = await getMemberDirectory(seed().client)
  const name = (id: string) => dir.find((m) => m.userId === id)!.name
  assert.equal(name('p1'), 'Profile Person')
  assert.equal(name('p2'), 'Linked Applicant')
  assert.equal(name('p3'), 'Unlinked Applicant', 'application by email, any case, newest')
  assert.equal(name('p4'), 'Meta Name')
  assert.equal(name('p5'), 'Glory', 'start of the email as a last resort')
  assert.ok(dir.every((m) => m.name !== 'Unnamed member'))
})

test('directory: active only when onboarded and not archived; open tasks counted', async () => {
  const dir = await getMemberDirectory(seed().client)
  const m = (id: string) => dir.find((x) => x.userId === id)!
  assert.equal(m('p1').active, true)
  assert.equal(m('p2').active, false, 'not onboarded')
  assert.equal(m('p5').active, false, 'archived')
  assert.equal(m('p1').openTasks, 1, 'completed task not counted')
  assert.deepEqual(m('p1').categories, ['technical'])
})

test('directory: a duplicate row still gives one entry per person', async () => {
  const dir = await getMemberDirectory(seed([{ user_id: 'p1', role: 'member', archived: false, onboarding_completed_at: null, application_id: null }]).client)
  assert.equal(dir.filter((m) => m.userId === 'p1').length, 1)
  assert.equal(dir.length, 5)
})

test('directory: nobody → empty list; account list failure → still named from the email-free sources', async () => {
  assert.deepEqual(await getMemberDirectory(createFakeSupabase({ dashboard_users: [] }).client), [])
  const s = seed()
  s.client.auth.admin.listUsers = async () => ({ data: null, error: { message: 'down' } })
  const dir = await getMemberDirectory(s.client)
  assert.equal(dir.find((m) => m.userId === 'p2')!.name, 'Linked Applicant')
  assert.equal(dir.find((m) => m.userId === 'p3')!.name, 'Unnamed member', 'no email to go on')
})
