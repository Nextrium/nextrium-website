import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterPeople, readPeopleFilters } from './peopleFilters'

const params = (q: string) => new URLSearchParams(q)
const people = [
  { id: 'a', contribution: { categories: ['technical', 'design'], status: 'active' } },
  { id: 'b', contribution: { categories: ['community'], status: 'invited' } },
  { id: 'c', contribution: { categories: [], status: 'invited' } },
  { id: 'd' },
  { id: 'e', contribution: null },
]
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

test('filters: known values are read (any case); unknown values are ignored', () => {
  assert.deepEqual(readPeopleFilters(params('category=Technical&status=INVITED')), { category: 'technical', status: 'invited' })
  assert.deepEqual(readPeopleFilters(params('category=xyz&status=archived')), { category: '', status: '' })
  assert.deepEqual(readPeopleFilters(params('')), { category: '', status: '' })
})

test('filters: area and status apply independently and together', () => {
  assert.deepEqual(ids(filterPeople(people, { category: '', status: '' })), ['a', 'b', 'c', 'd', 'e'])
  assert.deepEqual(ids(filterPeople(people, { category: 'technical', status: '' })), ['a'])
  assert.deepEqual(ids(filterPeople(people, { category: '', status: 'invited' })), ['b', 'c'])
  assert.deepEqual(ids(filterPeople(people, { category: 'community', status: 'invited' })), ['b'])
  assert.deepEqual(ids(filterPeople(people, { category: 'design', status: 'invited' })), [])
})
