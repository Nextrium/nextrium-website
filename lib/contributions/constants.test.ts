import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COMPLEXITIES,
  COMPLEXITY_LABELS,
  DEADLINE_DAYS,
  EXTENSION_DAYS,
  POINT_RANGES,
  isCategory,
  isComplexity,
  taskDefaults,
} from './constants'

test('categories and complexities match the review service contract', () => {
  assert.deepEqual([...CATEGORIES], ['technical', 'design', 'research', 'operations', 'community'])
  assert.deepEqual([...COMPLEXITIES], ['small', 'medium', 'large'])
})

test('every category and complexity has a valid point range', () => {
  for (const category of CATEGORIES) {
    for (const complexity of COMPLEXITIES) {
      const { min, max } = POINT_RANGES[category][complexity]
      assert.ok(Number.isInteger(min) && Number.isInteger(max), `${category}/${complexity} integers`)
      assert.ok(min >= 0 && max >= min, `${category}/${complexity} min<=max`)
    }
  }
})

test('point ranges grow with complexity', () => {
  for (const category of CATEGORIES) {
    const r = POINT_RANGES[category]
    assert.ok(r.small.max <= r.medium.max && r.medium.max <= r.large.max, category)
  }
})

test('deadlines and extensions are positive and grow with complexity', () => {
  assert.ok(DEADLINE_DAYS.small < DEADLINE_DAYS.medium && DEADLINE_DAYS.medium < DEADLINE_DAYS.large)
  assert.ok(EXTENSION_DAYS.small < EXTENSION_DAYS.medium && EXTENSION_DAYS.medium < EXTENSION_DAYS.large)
  for (const c of COMPLEXITIES) assert.ok(EXTENSION_DAYS[c] > 0 && EXTENSION_DAYS[c] < DEADLINE_DAYS[c])
})

test('every value has a label', () => {
  for (const c of CATEGORIES) assert.ok(CATEGORY_LABELS[c])
  for (const c of COMPLEXITIES) assert.ok(COMPLEXITY_LABELS[c])
})

test('type guards accept only known values', () => {
  assert.equal(isCategory('design'), true)
  assert.equal(isCategory('marketing'), false)
  assert.equal(isCategory(undefined), false)
  assert.equal(isComplexity('large'), true)
  assert.equal(isComplexity('huge'), false)
})

test('taskDefaults derives range and deadline', () => {
  assert.deepEqual(taskDefaults('technical', 'medium'), { pointRangeMin: 150, pointRangeMax: 280, deadlineDays: 6 })
  assert.deepEqual(taskDefaults('community', 'small'), { pointRangeMin: 10, pointRangeMax: 30, deadlineDays: 3 })
})
