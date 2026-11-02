import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEngineId } from './engineId'

test('real ids are accepted', () => {
  for (const id of ['0f8fad5b-d9cb-469f-a165-70867728950e', 'job_123', 'NXT-2026-1234']) assert.equal(isEngineId(id), true, id)
})

test('anything that could change the path is refused', () => {
  for (const id of ['..', '.', '../x', '../../hr/route?x=', 'a/b', 'a\\b', 'a%2fb', 'a?b', 'a#b', '', ' ', 'a'.repeat(129), null, undefined, 1, {}]) {
    assert.equal(isEngineId(id), false, String(id))
  }
})
