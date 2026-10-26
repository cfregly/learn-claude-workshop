import test from 'node:test'
import assert from 'node:assert/strict'

import { createSseDecoder, validateWorkflowComplete } from '../public/live-workflow.js'

test('decodes chunked UTF-8 and joins multi-line SSE data', () => {
  const events = []
  const decoder = createSseDecoder(event => events.push(event))
  const bytes = new TextEncoder().encode(
    ': keepalive\r\n' +
    'event: status\r\n' +
    'data: {"stage":"tool",\r\n' +
    'data: "message":"café 🚚"}\r\n\r\n' +
    'event: text_delta\n' +
    'data: {"text":"Northstar"}\n\n'
  )

  for (let index = 0; index < bytes.length; index += 3) decoder.push(bytes.slice(index, index + 3))
  assert.deepEqual(decoder.finish(), { incomplete: false })
  assert.equal(events.length, 2)
  assert.equal(events[0].event, 'status')
  assert.deepEqual(JSON.parse(events[0].data), { stage: 'tool', message: 'café 🚚' })
  assert.deepEqual(JSON.parse(events[1].data), { text: 'Northstar' })
})

test('does not dispatch an event that ends without its blank line', () => {
  const events = []
  const decoder = createSseDecoder(event => events.push(event))
  decoder.push(new TextEncoder().encode('event: complete\ndata: {"message_stop":true}'))
  assert.deepEqual(decoder.finish(), { incomplete: true })
  assert.deepEqual(events, [])
})

test('requires the terminal event, matched tool IDs, text, and two provider requests', () => {
  const state = {
    started: true,
    traceId: 'trace_123',
    outputText: '# Northstar\n\nDraft.',
    toolRequest: { id: 'tool_123' },
    toolResult: { tool_use_id: 'tool_123' }
  }
  const complete = {
    trace_id: 'trace_123',
    stop_reason: 'end_turn',
    message_stop: true,
    tool_used: true,
    review_required: true,
    model: 'claude-test',
    provider_request_ids: ['req_1', 'req_2']
  }

  assert.deepEqual(validateWorkflowComplete(complete, state), { valid: true, missing: [] })
  const incomplete = validateWorkflowComplete({ ...complete, stop_reason: 'max_tokens', provider_request_ids: ['req_1'] }, state)
  assert.equal(incomplete.valid, false)
  assert.ok(incomplete.missing.includes('end_turn stop reason'))
  assert.ok(incomplete.missing.includes('two provider request IDs'))
})
