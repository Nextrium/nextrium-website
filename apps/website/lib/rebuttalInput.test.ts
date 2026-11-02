import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRebuttalInput } from './rebuttalInput'

test('a normal rebuttal is accepted and tidied', () => {
  assert.deepEqual(parseRebuttalInput(['Depth'], '  My evidence  ', [' https://example.com/a ', '', 'http://example.com/b']), {
    dimensions: ['Depth'],
    statement: 'My evidence',
    urls: ['https://example.com/a', 'http://example.com/b'],
  })
  assert.deepEqual(parseRebuttalInput(['Depth'], 'x', undefined), { dimensions: ['Depth'], statement: 'x', urls: [] })
})

test('links that are not web pages are refused', () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'not a url', `https://example.com/${'a'.repeat(2000)}`]) {
    assert.ok('error' in parseRebuttalInput(['Depth'], 'x', [url]), url)
  }
})

test('missing, oversized or wrongly typed input is refused', () => {
  const cases: [unknown, unknown, unknown][] = [
    [[], 'x', []], [undefined, 'x', []], ['Depth', 'x', []], [[1], 'x', []], [Array(51).fill('d'), 'x', []],
    [['d'], '', []], [['d'], '   ', []], [['d'], 5, []], [['d'], 'x'.repeat(2001), []],
    [['d'], 'x', 'https://example.com'], [['d'], 'x', [1]], [['d'], 'x', Array(6).fill('https://example.com')],
  ]
  for (const [dimensions, statement, urls] of cases) {
    assert.ok('error' in parseRebuttalInput(dimensions, statement, urls))
  }
})
