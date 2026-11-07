import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkMediaImage, IMAGE_ACCEPT, MAX_IMAGE_BYTES } from './mediaImage'

test('the four photo formats are accepted, with an extension from the type', () => {
  for (const [type, ext] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif']]) {
    assert.deepEqual(checkMediaImage({ type, size: 1000 }), { ok: true, ext, contentType: type })
  }
})

test('SVG and anything else is refused', () => {
  for (const type of ['image/svg+xml', 'IMAGE/SVG+XML', 'image/svg', 'text/html', 'application/pdf', 'image/', 'image/x-icon', 'image/png; charset=x', '']) {
    assert.equal(checkMediaImage({ type, size: 1000 }).ok, false, type)
  }
})

test('the size limit is inclusive at 10 MB', () => {
  assert.equal(checkMediaImage({ type: 'image/png', size: MAX_IMAGE_BYTES }).ok, true)
  assert.equal(checkMediaImage({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }).ok, false)
})

test('the file picker offers only the allowed types', () => {
  assert.equal(IMAGE_ACCEPT, 'image/jpeg,image/png,image/webp,image/gif')
})

test('both media uploaders use the check and never the file name', () => {
  for (const file of ['../../components/dashboard/CoverImageUpload.tsx', '../../components/editor/ImageUpload.tsx']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(src.includes('checkMediaImage('), `${file} skips the check`)
    assert.ok(!src.includes('file.name'), `${file} still reads the file name`)
    assert.ok(!src.includes('accept="image/*"'), `${file} still offers every image type`)
  }
})
