import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// The dashboard has no DOM test runner; the behaviour is proven in the proof
// lab's round 3 test. This keeps the guards from being removed by accident.
const src = readFileSync(new URL('./CopilotDrawer.tsx', import.meta.url), 'utf8')

test('a late history reply for the previous candidate is ignored', () => {
  assert.match(src, /let cancelled = false/)
  assert.match(src, /if \(cancelled\) return\s*\n\s*setHistory\(history\)/)
  assert.match(src, /return \(\) => \{ cancelled = true \}/)
})

test('a late chat reply is not added to another candidate\'s conversation', () => {
  const send = src.indexOf('await sendCopilotChat(')
  const guard = src.indexOf('targetKeyRef.current !== sentFor')
  const append = src.indexOf('setHistory((prev) =>')
  assert.ok(send > 0 && guard > send && append > guard)
})
