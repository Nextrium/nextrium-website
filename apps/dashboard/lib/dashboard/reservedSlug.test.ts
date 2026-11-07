import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isReservedSlug } from './reservedSlug'

test('"new" is reserved in any case or padding', () => {
  for (const slug of ['new', 'New', 'NEW', ' new ', '\tnew\n']) assert.equal(isReservedSlug(slug), true, JSON.stringify(slug))
})

test('ordinary slugs, including ones containing "new", are allowed', () => {
  for (const slug of ['news', 'new-post', 'renew', 'brand-new', 'a', '']) assert.equal(isReservedSlug(slug), false, slug)
})

test('every slug editor refuses a reserved slug before saving', () => {
  const editors = [
    'posts/[slug]/PostEditor.tsx',
    'events/[slug]/EventEditor.tsx',
    'community-projects/[slug]/CommunityProjectEditor.tsx',
    'products/[slug]/ProductEditor.tsx',
    'team/[slug]/TeamMemberEditor.tsx',
    'roles/[slug]/RoleEditor.tsx',
  ]
  for (const file of editors) {
    const src = readFileSync(new URL(`../../app/(console)/${file}`, import.meta.url), 'utf8')
    const guard = src.indexOf('isReservedSlug(slug)')
    assert.ok(guard > 0, `${file} has no reserved-slug check`)
    assert.ok(guard < src.indexOf('setSaving(true)'), `${file} checks after it starts saving`)
  }
})
