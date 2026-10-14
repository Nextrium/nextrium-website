import { test } from 'node:test'
import assert from 'node:assert/strict'
import { excerptOf } from './excerpt'

test('separates blocks and drops markup', () => {
  assert.equal(excerptOf('<h3>Context</h3><p>Running <strong>npm audit</strong></p><ul><li>One</li><li>Two</li></ul>'), 'Context Running npm audit One Two')
  assert.equal(excerptOf('a<br>b<br/>c'), 'a b c')
})

test('never lets markup or scripts through', () => {
  const out = excerptOf('<p>Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>')
  assert.ok(!/[<>]/.test(out), out)
  assert.ok(!/alert/.test(out), out)
})

test('cuts long text with an ellipsis', () => {
  const out = excerptOf(`<p>${'word '.repeat(100)}</p>`, 20)
  assert.ok(out.endsWith('…'))
  assert.ok(out.length <= 21)
  assert.equal(excerptOf(''), '')
})
