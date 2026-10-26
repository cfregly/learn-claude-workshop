import test from 'node:test'
import assert from 'node:assert/strict'

import { createSseDecoder, mountLiveWorkflow, validateWorkflowComplete } from '../public/live-workflow.js'

class TestNode {
  constructor(documentRef, tagName = '') {
    this.ownerDocument = documentRef
    this.tagName = tagName.toUpperCase()
    this.children = []
    this.dataset = {}
    this.attributes = new Map()
    this.listeners = new Map()
    this.className = ''
    this._textContent = ''
    this.isConnected = true
    this.classList = {
      remove: name => {
        this.className = this.className.split(/\s+/).filter(value => value && value !== name).join(' ')
      }
    }
  }

  append(...children) {
    this.children.push(...children)
  }

  replaceChildren(...children) {
    this.children = [...children]
    this._textContent = ''
  }

  set textContent(value) {
    this._textContent = String(value)
    this.children = []
  }

  get textContent() {
    return this._textContent || this.children.map(child => child.textContent).join('')
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  removeAttribute(name) {
    this.attributes.delete(name)
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener)
  }

  click() {
    this.listeners.get('click')?.()
  }
}

class TestDocument {
  createElement(tagName) {
    return new TestNode(this, tagName)
  }

  createTextNode(text) {
    const result = new TestNode(this)
    result.textContent = text
    return result
  }
}

function findNode(root, predicate) {
  if (predicate(root)) return root
  for (const child of root.children || []) {
    const found = findNode(child, predicate)
    if (found) return found
  }
  return null
}

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve))
}

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

test('cancel keeps streamed partial text and leaves the mounted view reusable', async () => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  let postCount = 0
  globalThis.fetch = async (url, options = {}) => {
    if (url === '/api/demo') {
      return new Response(JSON.stringify({
        workflow: {
          available: true,
          endpoint: '/api/workflow',
          tool_name: 'lookup_northstar_account',
          data_kind: 'synthetic',
          max_provider_calls: 2,
          role_ids: ['software-engineer-api']
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    postCount += 1
    let bodyController
    const body = new ReadableStream({
      start(controller) {
        bodyController = controller
        controller.enqueue(encoder.encode(
          'event: run_start\ndata: {"trace_id":"trace_1","role_id":"software-engineer-api","account_id":"northstar-freight","review_required":true}\n\n' +
          'event: tool_request\ndata: {"id":"tool_1","name":"lookup_northstar_account","input":{"account_id":"northstar-freight"}}\n\n' +
          'event: tool_result\ndata: {"tool_use_id":"tool_1","name":"lookup_northstar_account","result":{"renewal":"2027-01-31"},"source_ids":["CRM"]}\n\n' +
          'event: text_delta\ndata: {"text":"Partial Northstar draft"}\n\n'
        ))
      }
    })
    options.signal.addEventListener('abort', () => bodyController.error(new DOMException('Cancelled', 'AbortError')), { once: true })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }

  try {
    const documentRef = new TestDocument()
    const host = new TestNode(documentRef, 'div')
    const handle = mountLiveWorkflow(host, { roleId: 'engineer', showRoleLinks: false, showRoleGoal: false, fallbackLabel: 'Prepared example' })
    await nextTurn()
    await nextTurn()
    const runButton = findNode(host, node => node.tagName === 'BUTTON' && node.textContent === 'Run live workflow')
    assert.equal(runButton.disabled, false)
    runButton.click()
    await nextTurn()
    await nextTurn()
    assert.equal(handle.cancel('mode-change'), true)
    await nextTurn()
    await nextTurn()

    const output = findNode(host, node => String(node.className).includes('live-workflow-draft'))
    assert.equal(output.textContent, 'Partial Northstar draft')
    assert.equal(output.dataset.state, 'partial')
    assert.equal(runButton.disabled, false)
    assert.equal(runButton.textContent, 'Run live workflow')
    assert.ok(findNode(host, node => node.textContent === 'Live demo hidden. Run cancelled. Partial text is preserved.'))
    assert.ok(findNode(host, node => node.textContent === 'Review is blocked. Prepared example remains available.'))
    assert.equal(postCount, 1)
    assert.equal(handle.cancel('mode-change'), false)
    handle.destroy()
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('inline unavailable state returns to Prepared example without a workflow POST', async () => {
  const originalFetch = globalThis.fetch
  let capabilityCount = 0
  let workflowCount = 0
  globalThis.fetch = async url => {
    if (url === '/api/demo') {
      capabilityCount += 1
      return new Response(JSON.stringify({
        workflow: {
          available: false,
          endpoint: '/api/workflow',
          tool_name: 'lookup_northstar_account',
          data_kind: 'synthetic',
          max_provider_calls: 2,
          role_ids: ['account-executive']
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    workflowCount += 1
    throw new Error(`Unexpected request: ${url}`)
  }

  try {
    const documentRef = new TestDocument()
    const host = new TestNode(documentRef, 'div')
    const handle = mountLiveWorkflow(host, { roleId: 'sales', showRoleLinks: false, showRoleGoal: false, fallbackLabel: 'Prepared example' })
    await nextTurn()
    await nextTurn()

    const runButton = findNode(host, node => node.tagName === 'BUTTON' && node.textContent === 'Run live workflow')
    assert.equal(runButton.disabled, true)
    assert.ok(findNode(host, node => node.textContent === 'Live is unavailable. Use Prepared example.'))
    runButton.click()
    await nextTurn()
    assert.equal(capabilityCount, 1)
    assert.equal(workflowCount, 0)
    handle.destroy()
  } finally {
    globalThis.fetch = originalFetch
  }
})
