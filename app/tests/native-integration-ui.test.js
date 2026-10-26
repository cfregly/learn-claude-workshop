import test from 'node:test'
import assert from 'node:assert/strict'

import { mountNativeIntegration } from '../public/native-integration.js'

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
    this.disabled = false
    this.open = false
    this.href = ''
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

async function settle(turns = 8) {
  for (let index = 0; index < turns; index += 1) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

function capability({ uploadRequired, enabled = true, reason = 'ready', roleIds = ['software-engineer-api', 'account-executive'] }) {
  return new Response(JSON.stringify({
    native_integration: {
      enabled,
      reason,
      endpoint: '/api/native-integration',
      upload_required: uploadRequired,
      calls_required: uploadRequired === null ? null : uploadRequired ? 2 : 1,
      role_ids: roleIds,
      limits: { request_bytes: 2_048, max_output_tokens: 900, total_timeout_ms: 45_000 }
    }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const proof = Object.freeze({
  passed: true,
  skill_instruction_file_hash_matched: true,
  mounted_code_hash_matched: true,
  bundled_script_invocation_succeeded: true,
  marker_matched: true,
  deterministic_output_matched: true,
  source_record_validated: true,
  canonical_output_hash_matched: true,
  expected_output_sha256: 'e'.repeat(64),
  returned_output_sha256: 'e'.repeat(64)
})

const brief = Object.freeze({
  confirmed_facts: [
    { text: 'Northstar renews January 31, 2027.', source_ids: ['CRM'] }
  ],
  interpretation: [
    { text: 'The account needs a source review before customer use.', source_ids: ['CRM', 'SUPPORT'] }
  ],
  open_questions: [
    { text: 'The SSO entitlement is not confirmed.', source_ids: ['CALL'] }
  ],
  proposed_next_actions: [
    { text: 'Confirm pricing and entitlement.', source_ids: ['CRM', 'CALL'], owner: 'Maya Chen', status: 'Proposed' }
  ]
})

function eventSet({ roleId = 'software-engineer-api', uploadRequired = true, includeComplete = true } = {}) {
  const traceId = 'native_trace_123'
  const mcp = {
    trace_id: traceId,
    evidence_state: 'mcp_observed',
    account_id: 'northstar-freight',
    tool_name: 'lookup_northstar_account',
    actor_id: 'workshop-native-integration',
    server_name: 'renewal_review',
    server_version: '1.0.0',
    protocol_version: '2025-11-25',
    source_ids: ['CRM', 'CALL', 'SUPPORT', 'USAGE'],
    fixture_sha256: 'a'.repeat(64),
    record_sha256: 'b'.repeat(64),
    receipt_sha256: 'c'.repeat(64)
  }
  const skill = {
    trace_id: traceId,
    evidence_state: 'skill_pinned',
    operation: uploadRequired ? 'create_skill' : 'reuse_pin',
    upload_required: uploadRequired,
    reused: !uploadRequired,
    skill_id: 'skill_renewal_brief',
    version: 'version_1',
    bundle_sha256: 'd'.repeat(64),
    provider_request_id: uploadRequired ? 'req_skill_upload' : null
  }
  const native = {
    trace_id: traceId,
    evidence_state: 'native_skill_observed',
    review_required: true,
    stop_reason: 'end_turn',
    model: 'claude-sonnet-5-5',
    provider_request_id: 'req_native_message',
    usage: { input_tokens: 420, output_tokens: 190, private_detail: 'omit' },
    container_id: 'container_123',
    skill_id: skill.skill_id,
    skill_version: skill.version,
    proof,
    output: { brief, internal_note: 'do not render' }
  }
  const events = [
    {
      event: 'run_start',
      data: {
        trace_id: traceId,
        role_id: roleId,
        account_id: 'northstar-freight',
        evidence_state: 'prepared_unrun',
        upload_required: uploadRequired,
        calls_required: uploadRequired ? 2 : 1,
        review_required: true
      }
    },
    { event: 'mcp_observed', data: mcp },
    { event: 'skill_pinned', data: skill },
    { event: 'native_skill_observed', data: native }
  ]
  if (includeComplete) {
    events.push({
      event: 'complete',
      data: {
        trace_id: traceId,
        evidence_state: 'native_skill_observed',
        review_required: true,
        stop_reason: 'end_turn',
        message_stop: true,
        model: native.model,
        mcp,
        skill,
        proof,
        output: { brief },
        provider_request_ids: uploadRequired
          ? ['req_skill_upload', 'req_native_message']
          : ['req_native_message'],
        usage: native.usage
      }
    })
  }
  return events
}

function streamResponse(events, chunkSize = 37) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(events.map(item => (
    `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`
  )).join(''))
  const body = new ReadableStream({
    start(controller) {
      for (let index = 0; index < bytes.length; index += chunkSize) {
        controller.enqueue(bytes.slice(index, index + chunkSize))
      }
      controller.close()
    }
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

test('availability makes no provider request and an Engineer can complete the upload path', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })
    if (url === '/api/demo') return capability({ uploadRequired: true })
    return streamResponse(eventSet())
  }
  const documentRef = new TestDocument()
  const host = new TestNode(documentRef, 'div')
  const handle = mountNativeIntegration(host, {
    roleId: 'software-engineer-api',
    guideHref: '#material/native-guide',
    sourceHref: 'https://github.com/example/source',
    fetchImpl
  })

  await settle(3)
  const runButton = findNode(host, item => item.tagName === 'BUTTON')
  const receipt = findNode(host, item => item.tagName === 'DETAILS')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/api/demo')
  assert.equal(requests[0].options.body, undefined)
  assert.equal(runButton.textContent, 'Upload Skill and run')
  assert.equal(runButton.disabled, false)
  assert.equal(receipt.open, true)
  const guideLink = findNode(host, item => item.textContent === 'Read the native integration guide')
  const sourceLink = findNode(host, item => item.textContent === 'Inspect the full Skill bundle')
  assert.equal(guideLink.href, '#material/native-guide')
  assert.equal(sourceLink.href, 'https://github.com/example/source')
  assert.equal(sourceLink.target, '_blank')

  runButton.click()
  await settle()
  assert.equal(requests.length, 2)
  assert.equal(requests[1].url, '/api/native-integration')
  assert.equal(requests[1].options.method, 'POST')
  assert.deepEqual(JSON.parse(requests[1].options.body), { role_id: 'software-engineer-api' })
  assert.deepEqual(Object.keys(JSON.parse(requests[1].options.body)), ['role_id'])
  assert.ok(findNode(host, item => item.textContent === 'Brief ready for review'))
  assert.match(host.textContent, /Northstar renews January 31, 2027/)
  assert.match(host.textContent, /Owner: Maya Chen · Status: Proposed/)
  const receiptCode = findNode(host, item => item.tagName === 'CODE')
  assert.match(receiptCode.textContent, /"evidence_state": "native_skill_observed"/)
  assert.match(receiptCode.textContent, /"provider_request_ids"/)
  assert.match(receiptCode.textContent, /"expected_output_sha256"/)
  assert.doesNotMatch(receiptCode.textContent, /private_detail|internal_note/)
  assert.equal(runButton.textContent, 'Run pinned Skill')
  handle.destroy()
})

test('Account Executive uses the pinned path and keeps the sanitized receipt collapsed', async () => {
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options })
    if (url === '/api/demo') return capability({ uploadRequired: false })
    return streamResponse(eventSet({ roleId: 'account-executive', uploadRequired: false }))
  }
  const documentRef = new TestDocument()
  const host = new TestNode(documentRef, 'div')
  const handle = mountNativeIntegration(host, { roleId: 'account-executive', fetchImpl })

  await settle(3)
  const runButton = findNode(host, item => item.tagName === 'BUTTON')
  const receipt = findNode(host, item => item.tagName === 'DETAILS')
  assert.equal(runButton.textContent, 'Run pinned Skill')
  assert.equal(receipt.open, false)
  runButton.click()
  await settle()
  assert.deepEqual(JSON.parse(requests[1].options.body), { role_id: 'account-executive' })
  assert.match(host.textContent, /Confirmed facts/)
  assert.match(host.textContent, /Open questions/)
  assert.ok(findNode(host, item => item.textContent === 'Brief ready for review'))
  handle.destroy()
})

test('HTTP 200 without complete preserves the brief and receipt but blocks review', async () => {
  let postCount = 0
  const fetchImpl = async url => {
    if (url === '/api/demo') return capability({ uploadRequired: false })
    postCount += 1
    return streamResponse(eventSet({ uploadRequired: false, includeComplete: false }), 19)
  }
  const documentRef = new TestDocument()
  const host = new TestNode(documentRef, 'div')
  const handle = mountNativeIntegration(host, { roleId: 'software-engineer-api', fetchImpl })

  await settle(3)
  const runButton = findNode(host, item => item.tagName === 'BUTTON')
  runButton.click()
  await settle()
  assert.equal(postCount, 1)
  assert.ok(findNode(host, item => item.textContent === 'Brief incomplete'))
  assert.match(host.textContent, /stream ended before the complete event/i)
  assert.match(host.textContent, /Northstar renews January 31, 2027/)
  const receiptCode = findNode(host, item => item.tagName === 'CODE')
  assert.match(receiptCode.textContent, /"container_id": "container_123"/)
  assert.doesNotMatch(host.textContent, /Brief ready for review/)
  assert.equal(runButton.disabled, false)
  assert.equal(runButton.textContent, 'Run pinned Skill')
  handle.destroy()
})

test('a terminal stream error preserves sanitized MCP, Skill, and partial proof receipts', async () => {
  let postCount = 0
  const staged = eventSet().slice(0, 3)
  staged.push({
    event: 'error',
    data: {
      code: 'native_proof_failed',
      message: 'The native proof did not pass.',
      trace_id: staged[0].data.trace_id,
      evidence_state: 'skill_pinned',
      failed_stage: 'verify',
      partial: true,
      review_required: true,
      provider_request_ids: ['req_skill_upload', 'req_native_message'],
      mcp: staged[1].data,
      skill: staged[2].data,
      proof: { passed: false, marker_matched: false }
    }
  })
  const fetchImpl = async url => {
    if (url === '/api/demo') return capability({ uploadRequired: true })
    postCount += 1
    return streamResponse(staged)
  }
  const documentRef = new TestDocument()
  const host = new TestNode(documentRef, 'div')
  const handle = mountNativeIntegration(host, { roleId: 'software-engineer-api', fetchImpl })

  await settle(3)
  const runButton = findNode(host, item => item.tagName === 'BUTTON')
  runButton.click()
  await settle()
  assert.equal(postCount, 1)
  assert.match(host.textContent, /The native proof did not pass/)
  assert.doesNotMatch(host.textContent, /Brief ready for review/)
  const receiptCode = findNode(host, item => item.tagName === 'CODE')
  assert.match(receiptCode.textContent, /"evidence_state": "skill_pinned"/)
  assert.match(receiptCode.textContent, /"failed_stage": "verify"/)
  assert.match(receiptCode.textContent, /"marker_matched": false/)
  assert.equal(runButton.textContent, 'Run pinned Skill')
  handle.destroy()
})

test('Cancel keeps an observed MCP receipt and does not retry', async () => {
  const encoder = new TextEncoder()
  let postCount = 0
  const fetchImpl = async (url, options = {}) => {
    if (url === '/api/demo') return capability({ uploadRequired: true })
    postCount += 1
    const events = eventSet().slice(0, 2)
    const bytes = encoder.encode(events.map(item => (
      `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`
    )).join(''))
    let bodyController
    const body = new ReadableStream({
      start(controller) {
        bodyController = controller
        controller.enqueue(bytes)
      }
    })
    options.signal.addEventListener('abort', () => {
      bodyController.error(new DOMException('Cancelled', 'AbortError'))
    }, { once: true })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }
  const documentRef = new TestDocument()
  const host = new TestNode(documentRef, 'div')
  const handle = mountNativeIntegration(host, { roleId: 'software-engineer-api', fetchImpl })

  await settle(3)
  const runButton = findNode(host, item => item.tagName === 'BUTTON')
  runButton.click()
  await settle(4)
  assert.equal(runButton.textContent, 'Cancel')
  runButton.click()
  await settle(4)
  assert.equal(postCount, 1)
  assert.match(host.textContent, /Run cancelled. Partial receipt evidence is preserved./)
  const receiptCode = findNode(host, item => item.tagName === 'CODE')
  assert.match(receiptCode.textContent, /"evidence_state": "mcp_observed"/)
  assert.match(receiptCode.textContent, /"receipt_sha256"/)
  assert.equal(runButton.disabled, false)
  assert.equal(handle.cancel(), false)
  handle.destroy()
})

test('an unsupported role cannot check capability or start a native run', async () => {
  let fetchCount = 0
  const documentRef = new TestDocument()
  const host = new TestNode(documentRef, 'div')
  const handle = mountNativeIntegration(host, {
    roleId: 'product-manager',
    fetchImpl: async () => {
      fetchCount += 1
      throw new Error('unexpected fetch')
    }
  })

  await settle(2)
  const runButton = findNode(host, item => item.tagName === 'BUTTON')
  assert.equal(fetchCount, 0)
  assert.equal(runButton.disabled, true)
  runButton.click()
  await settle(2)
  assert.equal(fetchCount, 0)
  assert.match(host.textContent, /only for Engineer and Account Executive views/)
  handle.destroy()
})
