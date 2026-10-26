import test from 'node:test'
import assert from 'node:assert/strict'

import { formatCode } from '../public/code-blocks.js'

test('formatCode pretty prints JSON objects and arrays with two spaces', () => {
  assert.equal(
    formatCode('{"account":"Northstar","facts":[{"approved":false}]}'),
    '{\n  "account": "Northstar",\n  "facts": [\n    {\n      "approved": false\n    }\n  ]\n}'
  )
  assert.equal(formatCode('[{"id":1},{"id":2}]'), '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]')
})

test('formatCode preserves invalid JSON exactly', () => {
  const source = '  {"account":"Northstar", trailing: true}\n'
  assert.equal(formatCode(source), source)
})

test('formatCode preserves Python, SSE, and plain source text exactly', () => {
  const python = '{"looks": "json"}\nprint("keep source")\n'
  const sse = 'event: message_delta\ndata: {"stop_reason":"max_tokens"}\n\n'
  const plain = 'Northstar renewal\n  keep indentation\n'
  assert.equal(formatCode(python, 'python'), python)
  assert.equal(formatCode(sse, 'sse'), sse)
  assert.equal(formatCode(plain), plain)
})
