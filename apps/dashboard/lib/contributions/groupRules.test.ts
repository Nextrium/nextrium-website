import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GROUP_MAX, SIMILARITY_FLAG, deleteTaskRule, findSimilar, groupDeadline, groupOutcome, groupProgress, openCopyIds, parseGroupAssignees, sameEvidence, textSimilarity } from './groupRules'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

test('group: needs 2 to 20 valid, distinct people', () => {
  assert.deepEqual(parseGroupAssignees([id(1), id(2)]), { ids: [id(1), id(2)] })
  // duplicates (any case) count once
  assert.deepEqual(parseGroupAssignees([id(1), id(1).toUpperCase(), id(2)]), { ids: [id(1), id(2)] })
  assert.ok('error' in parseGroupAssignees([id(1)]))
  assert.ok('error' in parseGroupAssignees([id(1), id(1)]))
  assert.ok('error' in parseGroupAssignees([]))
  assert.equal('ids' in parseGroupAssignees(Array.from({ length: GROUP_MAX }, (_, i) => id(i + 1))), true)
  assert.ok('error' in parseGroupAssignees(Array.from({ length: GROUP_MAX + 1 }, (_, i) => id(i + 1))))
})

test('group: rejects anything that is not a list of ids', () => {
  for (const bad of [null, undefined, 'x', id(1), { 0: id(1) }, [id(1), 'not-an-id'], [id(1), 42], [id(1), null]]) {
    assert.ok('error' in parseGroupAssignees(bad), JSON.stringify(bad))
  }
  // a huge list is refused before it is walked
  assert.ok('error' in parseGroupAssignees(Array.from({ length: 10_000 }, () => id(1))))
})

test('group: one deadline for everyone', () => {
  const now = new Date('2026-10-21T10:00:00Z')
  assert.equal(groupDeadline(null, 7, now), '2026-10-28T10:00:00.000Z')
  assert.equal(groupDeadline('2026-11-01T09:00:00.000Z', 7, now), '2026-11-01T09:00:00.000Z')
})

test('group: outcome names who was not assigned', () => {
  assert.equal(groupOutcome(3, []), 'Assigned to all 3 people.')
  assert.match(groupOutcome(2, [{ name: 'Ada', error: 'archived' }]), /Assigned to 2 of 3\. Not assigned: Ada \(archived\)/)
})

test('progress: counts live copies only', () => {
  assert.deepEqual(groupProgress(['assigned', 'submitted', 'completed', 'cancelled']), { total: 3, submitted: 2, completed: 1, label: '2 of 3 submitted · 1 completed' })
  assert.equal(groupProgress(['assigned', 'assigned']).label, '0 of 2 submitted')
  assert.equal(groupProgress(['cancelled']).label, 'All copies cancelled')
})

test('open copies: unsubmitted drafts and assigned copies without any submission', () => {
  const copies = [
    { id: 'a', status: 'assigned' }, { id: 'b', status: 'draft' }, { id: 'c', status: 'submitted' },
    { id: 'd', status: 'changes_requested' }, { id: 'e', status: 'completed' }, { id: 'f', status: 'cancelled' }, { id: 'g', status: 'assigned' },
  ]
  assert.deepEqual(openCopyIds(copies, new Set(['g'])), ['a', 'b'])
})

test('delete: admin, cancelled, never submitted', () => {
  assert.deepEqual(deleteTaskRule('admin', 'cancelled', 0), { ok: true })
  assert.equal(deleteTaskRule('moderator', 'cancelled', 0).ok, false)
  for (const s of ['draft', 'assigned', 'submitted', 'changes_requested', 'completed']) assert.equal(deleteTaskRule('admin', s, 0).ok, false, s)
  assert.match((deleteTaskRule('admin', 'cancelled', 1) as { error: string }).error, /kept for the record/)
})

test('similarity: copied text is flagged, different work is not', () => {
  const a = 'I built the events calendar page with a month view, filters by category and an iCal export for each event.'
  assert.equal(textSimilarity(a, a), 1)
  assert.equal(textSimilarity(a, a.toUpperCase().replace(/\./g, '!')), 1)
  assert.ok(textSimilarity(a, a + ' I also fixed a typo in the footer.') >= SIMILARITY_FLAG)
  assert.ok(textSimilarity(a, 'Wrote a blog post about informal markets in Lagos and how traders keep records today.') < 0.1)
  assert.equal(textSimilarity('', a), 0)
  assert.equal(textSimilarity('<p>Done</p>', 'done'), 1)
  assert.ok(SIMILARITY_FLAG > 0 && SIMILARITY_FLAG < 1)
})

test('similarity: same evidence link however it is written', () => {
  assert.ok(sameEvidence('https://github.com/x/y/pull/3', 'https://www.GitHub.com/x/y/pull/3/'))
  assert.ok(sameEvidence('https://github.com/x/y/pull/3#top', 'https://github.com/x/y/pull/3'))
  assert.ok(!sameEvidence('https://github.com/x/y/pull/3', 'https://github.com/x/y/pull/4'))
  assert.ok(!sameEvidence(null, null))
  assert.ok(!sameEvidence('https://a.com/x', null))
})

test('findSimilar: flags copies and shared links, skips itself, most similar first', () => {
  const text = 'I built the events calendar page with a month view and filters by category for every event.'
  const me = { id: 'me', description: text, evidence_url: 'https://github.com/a/b/pull/1' }
  const r = findSimilar(me, [
    me,
    { id: 'copy', description: text, evidence_url: null },
    { id: 'link', description: 'Completely different words here about another thing entirely.', evidence_url: 'https://github.com/a/b/pull/1/' },
    { id: 'own', description: 'My own write-up of a separate approach using a weekly agenda layout.', evidence_url: null },
  ])
  assert.deepEqual(r.map((x) => x.id), ['link', 'copy'])
})
