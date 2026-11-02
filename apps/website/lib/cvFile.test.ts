import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CV_BYTES, checkCvFile } from './cvFile'

test('real document types are accepted, with the type from their bytes', () => {
  assert.equal((checkCvFile(Buffer.from('%PDF-1.7 body')) as any).extension, 'pdf')
  assert.equal((checkCvFile(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])) as any).extension, 'doc')
  assert.equal((checkCvFile(Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('word/document.xml')])) as any).extension, 'docx')
})

test('other files are refused', () => {
  for (const bytes of [
    Buffer.from('<html><script>1</script></html>'), Buffer.from('MZ program'), Buffer.from('#!/bin/sh'),
    Buffer.from('plain text %PDF-'), Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.from('other.txt')]), Buffer.alloc(0),
  ]) {
    assert.ok('error' in checkCvFile(bytes), bytes.toString().slice(0, 20))
  }
})

test('the size limit is enforced', () => {
  const header = Buffer.from('%PDF-')
  assert.ok('extension' in checkCvFile(Buffer.concat([header, Buffer.alloc(MAX_CV_BYTES - header.length)])))
  assert.match((checkCvFile(Buffer.concat([header, Buffer.alloc(MAX_CV_BYTES)])) as any).error, /10 MB/)
})
