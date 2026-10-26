import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import http from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import Anthropic from '@anthropic-ai/sdk'

import { createServer } from '../server.mjs'
import {
  createLiveDemo,
  lookupNorthstarAccount,
  WORKFLOW_ACCOUNT_ID,
  WORKFLOW_TOOL_NAME
} from '../live-demo.mjs'

const cleanups = []
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()()
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function temporaryBudget() {
  const directory = await mkdtemp(path.join(tmpdir(), 'northstar-workflow-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  return path.join(directory, 'model-usage.json')
}

async function startServer(demoOptions) {
  const server = createServer({ demoOptions })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise(resolve => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

function workflowRequest(origin, body, options = {}) {
  return fetch(`${origin}/api/workflow`, {
    method: options.method || 'POST',
    headers: {
      Origin: options.origin || origin,
      'Content-Type': options.contentType || 'application/json',
      'Sec-Fetch-Site': options.fetchSite || 'same-origin',
      'CF-Connecting-IP': options.client || '203.0.113.80'
    },
    body: options.method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    signal: options.signal
  })
}

function directWorkflowRequest(body, client = '203.0.113.120') {
  const request = new EventEmitter()
  request.method = 'POST'
  request.headers = {
    origin: 'https://learn.example',
    host: 'learn.example',
    'content-type': 'application/json',
    'sec-fetch-site': 'same-origin'
  }
  request.socket = { remoteAddress: client, destroyed: false }
  request.complete = true
  request.aborted = false
  request.readableAborted = false
  request.destroyed = false
  request[Symbol.asyncIterator] = async function * () {
    yield Buffer.from(JSON.stringify(body))
  }
  return request
}

function closedWorkflowResponse() {
  const response = new EventEmitter()
  response.destroyed = true
  response.closed = true
  response.writable = false
  response.writableEnded = false
  response.writableFinished = false
  response.socket = { destroyed: true }
  response.write = () => { throw new Error('closed response must not be written') }
  response.end = () => { throw new Error('closed response must not be ended') }
  return response
}

function openWorkflowResponse() {
  const response = new EventEmitter()
  response.destroyed = false
  response.closed = false
  response.writable = true
  response.writableEnded = false
  response.writableFinished = false
  response.socket = { destroyed: false }
  response.chunks = []
  response.write = chunk => {
    response.chunks.push(String(chunk))
    return true
  }
  response.end = () => {
    response.writable = false
    response.writableEnded = true
    response.writableFinished = true
  }
  return response
}

function messageEvents(stopReason, textParts = []) {
  const events = [{ type: 'message_start', message: { usage: { input_tokens: 20 } } }]
  if (textParts.length) {
    events.push({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
    for (const text of textParts) events.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })
    events.push({ type: 'content_block_stop', index: 0 })
  }
  events.push({
    type: 'message_delta',
    delta: { stop_reason: stopReason },
    usage: { input_tokens: 20, output_tokens: 10 }
  })
  events.push({ type: 'message_stop' })
  return events
}

function fakeStream({ requestId, events, message, gateAt = -1, gate = null, failureAt = -1, signal = null }) {
  const stream = {
    async withResponse() {
      return { data: stream, request_id: requestId, response: new Response() }
    },
    async *[Symbol.asyncIterator]() {
      for (let index = 0; index < events.length; index += 1) {
        if (index === gateAt) await gate.promise
        if (index === failureAt) throw new Error('raw provider detail must stay private')
        if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
        yield events[index]
      }
    },
    async finalMessage() {
      return message
    }
  }
  return stream
}

function fakeClient(plans, calls = []) {
  return {
    messages: {
      stream(payload, options) {
        calls.push({ payload, options })
        const plan = plans.shift()
        if (!plan) throw new Error('unexpected provider call')
        return fakeStream({ ...plan, signal: options.signal })
      }
    }
  }
}

function firstMessage(toolInput = { account_id: WORKFLOW_ACCOUNT_ID }, toolName = WORKFLOW_TOOL_NAME) {
  return {
    model: 'claude-sonnet-5-5',
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 30 },
    content: [
      { type: 'thinking', thinking: 'private reasoning', signature: 'private-signature' },
      { type: 'text', text: 'I will inspect the source first.' },
      { type: 'tool_use', id: 'toolu_northstar_1', name: toolName, input: toolInput }
    ]
  }
}

function finalMessage(text, stopReason = 'end_turn', extraContent = []) {
  return {
    model: 'claude-sonnet-5-5',
    stop_reason: stopReason,
    usage: { input_tokens: 140, output_tokens: 60 },
    content: [{ type: 'text', text }, ...extraContent]
  }
}

function configuredOptions(budgetFile, anthropicClient, extra = {}) {
  return {
    env: {
      ANTHROPIC_API_KEY: 'server-only-bearer-token',
      ANTHROPIC_MODEL: 'claude-sonnet-5-5',
      MODEL_BUDGET_FILE: budgetFile
    },
    cooldownMs: 0,
    anthropicClient,
    uuid: () => 'workflow-test-trace',
    ...extra
  }
}

async function readSse(response) {
  const events = []
  let buffer = ''
  for await (const chunk of response.body) {
    buffer += new TextDecoder().decode(chunk, { stream: true })
    let boundary
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      const event = frame.match(/^event: (.+)$/m)?.[1]
      const data = frame.match(/^data: (.+)$/m)?.[1]
      if (event && data) events.push({ event, data: JSON.parse(data) })
    }
  }
  return events
}

function sdkMessageStart(id) {
  return {
    type: 'message_start',
    message: {
      id,
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [],
      container: null,
      diagnostics: null,
      stop_reason: null,
      stop_sequence: null,
      stop_details: null,
      usage: {
        input_tokens: 20,
        output_tokens: 1,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
        server_tool_use: null,
        output_tokens_details: null
      }
    }
  }
}

function sdkMessageDelta(stopReason) {
  return {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null, stop_details: null, container: null },
    usage: {
      input_tokens: 20,
      output_tokens: 10,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
      output_tokens_details: null
    }
  }
}

function sdkSseResponse(events, requestId) {
  const body = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'request-id': requestId }
  })
}

test('the real lookup boundary exposes only fixed synthetic Northstar records', () => {
  const result = lookupNorthstarAccount({ account_id: WORKFLOW_ACCOUNT_ID })
  assert.equal(result.account_id, WORKFLOW_ACCOUNT_ID)
  assert.equal(result.data_kind, 'synthetic')
  assert.equal(result.access_context, 'synthetic_teaching_identity')
  assert.deepEqual(result.records.map(record => record.source_id), [
    'northstar-crm-account',
    'northstar-call-2026-10-14',
    'northstar-support-4821',
    'northstar-usage-weekly'
  ])
  assert.equal(result.records[1].facts.discount_approval, 'unknown')
  assert.equal(result.records[1].facts.sso_entitlement, 'unknown')
  assert.throws(
    () => lookupNorthstarAccount({ account_id: WORKFLOW_ACCOUNT_ID, write: true }),
    error => error.code === 'invalid_tool_input'
  )
  assert.throws(
    () => lookupNorthstarAccount({ account_id: WORKFLOW_ACCOUNT_ID }, {
      id: 'production-employee',
      kind: 'production_identity',
      allowed_account_ids: [WORKFLOW_ACCOUNT_ID]
    }),
    error => error.code === 'account_access_denied'
  )
})

test('the official SDK path uses Bearer auth, no retries, and preserves the signed assistant turn', async () => {
  const budgetFile = await temporaryBudget()
  const providerRequests = []
  const responses = [
    sdkSseResponse([
      sdkMessageStart('msg_lookup'),
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'private thought' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'signed-thinking' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_sdk', name: WORKFLOW_TOOL_NAME, input: {}, caller: { type: 'direct' } } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: `{"account_id":"${WORKFLOW_ACCOUNT_ID}"}` } },
      { type: 'content_block_stop', index: 1 },
      sdkMessageDelta('tool_use'),
      { type: 'message_stop' }
    ], 'req_sdk_lookup'),
    sdkSseResponse([
      sdkMessageStart('msg_draft'),
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'SDK streamed draft.' } },
      { type: 'content_block_stop', index: 0 },
      sdkMessageDelta('end_turn'),
      { type: 'message_stop' }
    ], 'req_sdk_draft')
  ]
  const sdk = new Anthropic({
    authToken: 'server-only-bearer-token',
    maxRetries: 0,
    fetch: async (url, options) => {
      providerRequests.push({ url: String(url), options, body: JSON.parse(options.body) })
      return responses.shift()
    }
  })
  const origin = await startServer(configuredOptions(budgetFile, sdk))
  const events = await readSse(await workflowRequest(origin, { role_id: 'account-executive' }))

  assert.equal(providerRequests.length, 2)
  assert.equal(new Headers(providerRequests[0].options.headers).get('authorization'), 'Bearer server-only-bearer-token')
  assert.equal(providerRequests[0].body.tool_choice, undefined)
  assert.deepEqual(providerRequests[0].body.thinking, { type: 'between_tools' })
  assert.deepEqual(providerRequests[1].body.messages[1].content[0], {
    type: 'thinking',
    thinking: 'private thought',
    signature: 'signed-thinking'
  })
  assert.equal(providerRequests[1].body.messages[2].content[0].tool_use_id, 'toolu_sdk')
  assert.equal(events.find(event => event.event === 'complete').data.message_stop, true)
  assert.equal(JSON.stringify(events).includes('private thought'), false)
  assert.equal(JSON.stringify(events).includes('signed-thinking'), false)
  assert.equal(JSON.stringify(events).includes('server-only-bearer-token'), false)
})

test('relays only final text incrementally and completes after one matched read-only tool result', async () => {
  const budgetFile = await temporaryBudget()
  const calls = []
  const nextDelta = deferred()
  const first = firstMessage()
  const finalText = 'Confirmed: Renewal is January 31, 2027 [northstar-crm-account]. Unknown: Discount approval is not recorded.'
  const client = fakeClient([
    {
      requestId: 'req_lookup',
      events: messageEvents('tool_use'),
      message: first
    },
    {
      requestId: 'req_draft',
      events: messageEvents('end_turn', ['Confirmed: Renewal is January 31, 2027. ', 'Unknown: Discount approval is not recorded.']),
      message: finalMessage(finalText),
      gateAt: 3,
      gate: nextDelta
    }
  ], calls)
  const origin = await startServer(configuredOptions(budgetFile, client))
  const response = await workflowRequest(origin, { role_id: 'account-executive' })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /^text\/event-stream/)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal(response.headers.get('x-accel-buffering'), 'no')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let observed = ''
  while (!observed.includes('Confirmed: Renewal is January 31, 2027. ')) {
    const chunk = await reader.read()
    assert.equal(chunk.done, false)
    observed += decoder.decode(chunk.value, { stream: true })
  }
  assert.equal(observed.includes('Unknown: Discount approval'), false)
  nextDelta.resolve()
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    observed += decoder.decode(chunk.value, { stream: true })
  }

  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].payload.thinking, { type: 'between_tools' })
  assert.equal(calls[0].payload.tool_choice, undefined)
  assert.equal(calls[0].payload.tools[0].name, WORKFLOW_TOOL_NAME)
  assert.equal(calls[0].payload.tools[0].input_schema.properties.account_id.const, WORKFLOW_ACCOUNT_ID)
  assert.deepEqual(calls[1].payload.messages[1].content, first.content)
  assert.equal(calls[1].payload.messages[2].content[0].tool_use_id, 'toolu_northstar_1')
  assert.match(calls[1].payload.messages[2].content[0].content, /northstar-crm-account/)
  assert.equal(calls[1].payload.tool_choice, undefined)
  assert.equal(calls.every(call => call.options.maxRetries === 0), true)
  assert.equal(calls.every(call => call.options.signal instanceof AbortSignal), true)

  const frames = observed.split('\n\n').filter(Boolean).map(frame => ({
    event: frame.match(/^event: (.+)$/m)?.[1],
    data: JSON.parse(frame.match(/^data: (.+)$/m)?.[1] || '{}')
  }))
  assert.equal(frames[0].event, 'run_start')
  assert.deepEqual(frames.filter(frame => frame.event === 'text_delta').map(frame => frame.data.text), [
    'Confirmed: Renewal is January 31, 2027. ',
    'Unknown: Discount approval is not recorded.'
  ])
  const complete = frames.find(frame => frame.event === 'complete')?.data
  assert.deepEqual(complete.provider_request_ids, ['req_lookup', 'req_draft'])
  assert.equal(complete.message_stop, true)
  assert.equal(complete.stop_reason, 'end_turn')
  assert.equal(complete.tool_used, true)
  assert.equal(complete.review_required, true)
  assert.equal(observed.includes('I will inspect the source first.'), false)
  assert.equal(observed.includes('private reasoning'), false)
  assert.equal(observed.includes('private-signature'), false)
  assert.equal(observed.includes('server-only-bearer-token'), false)
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 2)
})

test('rejects invalid workflow admission as JSON without opening an SSE stream or spending budget', async () => {
  const budgetFile = await temporaryBudget()
  const calls = []
  const client = fakeClient([], calls)
  const origin = await startServer(configuredOptions(budgetFile, client))

  const cases = [
    await workflowRequest(origin, { role_id: 'not-a-role' }),
    await workflowRequest(origin, { role_id: 'account-executive', account_id: WORKFLOW_ACCOUNT_ID }),
    await workflowRequest(origin, { role_id: 'account-executive' }, { origin: 'https://attacker.example', fetchSite: 'cross-site' }),
    await workflowRequest(origin, { role_id: 'account-executive' }, { method: 'GET' })
  ]
  assert.deepEqual(cases.map(response => response.status), [400, 400, 403, 405])
  for (const response of cases) {
    assert.match(response.headers.get('content-type'), /^application\/json/)
    assert.equal(response.headers.get('content-type').includes('event-stream'), false)
    assert.equal((await response.json()).status, 'error')
  }
  assert.equal(calls.length, 0)
  await assert.rejects(readFile(budgetFile, 'utf8'), error => error.code === 'ENOENT')
})

test('a response closed after admission but before start makes zero provider calls and fully releases admission', async () => {
  const budgetFile = await temporaryBudget()
  const calls = []
  const liveDemo = createLiveDemo(configuredOptions(budgetFile, fakeClient([], calls), {
    maxConcurrentCalls: 1,
    maxDailyCalls: 2,
    now: () => Date.parse('2026-10-26T12:00:00Z')
  }))

  const admitted = await liveDemo.handleWorkflow(directWorkflowRequest({ role_id: 'account-executive' }))
  assert.equal(admitted.stream, true)
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 2)
  await admitted.start(closedWorkflowResponse())
  assert.equal(calls.length, 0)
  assert.deepEqual(JSON.parse(await readFile(budgetFile, 'utf8')), {
    date: '2026-10-26',
    count: 0
  })

  const next = await liveDemo.handleWorkflow(directWorkflowRequest({ role_id: 'account-executive' }, '203.0.113.121'))
  assert.equal(next.stream, true)
  await next.start(closedWorkflowResponse())
  assert.equal(calls.length, 0)
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 0)
})

test('reports workflow capability separately and shares the persisted provider-call budget', async () => {
  const budgetFile = await temporaryBudget()
  const client = fakeClient([
    { requestId: 'req_lookup', events: messageEvents('tool_use'), message: firstMessage() },
    { requestId: 'req_draft', events: messageEvents('end_turn', ['Draft.']), message: finalMessage('Draft.') }
  ])
  const origin = await startServer(configuredOptions(budgetFile, client, { maxDailyCalls: 2 }))
  const before = await (await fetch(`${origin}/api/demo`)).json()
  assert.equal(before.available, true)
  assert.equal(before.workflow.available, true)
  assert.equal(before.workflow.endpoint, '/api/workflow')
  assert.equal(before.workflow.tool_name, WORKFLOW_TOOL_NAME)
  assert.equal(before.workflow.data_kind, 'synthetic')
  assert.equal(before.workflow.max_provider_calls, 2)

  const response = await workflowRequest(origin, { role_id: 'account-executive' })
  const events = await readSse(response)
  assert.ok(events.some(event => event.event === 'complete'))
  const after = await (await fetch(`${origin}/api/demo`)).json()
  assert.equal(after.available, false)
  assert.equal(after.reason, 'daily_limit_reached')
  assert.equal(after.workflow.available, false)
  assert.equal(after.workflow.reason, 'daily_limit_reached')

  const blocked = await workflowRequest(origin, { role_id: 'account-executive' }, { client: '203.0.113.81' })
  assert.equal(blocked.status, 429)
  assert.equal((await blocked.json()).code, 'workflow_budget_insufficient')
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 2)
})

test('refunds an unstarted second call after an invalid first tool request', async () => {
  const budgetFile = await temporaryBudget()
  const calls = []
  const client = fakeClient([
    {
      requestId: 'req_bad_tool',
      events: messageEvents('tool_use'),
      message: firstMessage({ account_id: 'another-account' })
    }
  ], calls)
  const origin = await startServer(configuredOptions(budgetFile, client))
  const response = await workflowRequest(origin, { role_id: 'account-executive' })
  const events = await readSse(response)
  assert.equal(calls.length, 1)
  assert.equal(events.some(event => event.event === 'complete'), false)
  assert.equal(events.find(event => event.event === 'error').data.code, 'invalid_tool_input')
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 1)
})

test('an old-day workflow refund never overwrites a newer UTC day budget', async () => {
  const budgetFile = await temporaryBudget()
  const providerStarted = deferred()
  const providerAborted = deferred()
  let currentTime = Date.parse('2026-10-26T23:59:59Z')
  const client = {
    messages: {
      stream(_payload, options) {
        const stream = {
          async withResponse() {
            providerStarted.resolve()
            return { data: stream, request_id: 'req_old_day', response: new Response() }
          },
          async *[Symbol.asyncIterator]() {
            await new Promise(resolve => {
              if (options.signal.aborted) return resolve()
              options.signal.addEventListener('abort', resolve, { once: true })
            })
            providerAborted.resolve()
            throw new DOMException('aborted', 'AbortError')
          },
          async finalMessage() {
            throw new Error('no final message')
          }
        }
        return stream
      }
    }
  }
  const liveDemo = createLiveDemo(configuredOptions(budgetFile, client, {
    now: () => currentTime,
    maxConcurrentCalls: 2,
    fetchImpl: async () => new Response(JSON.stringify({
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: 'New UTC day demo response.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 }
    }), { status: 200, headers: { 'request-id': 'req_new_day' } })
  }))

  const oldDayRequest = directWorkflowRequest({ role_id: 'account-executive' }, '203.0.113.130')
  const oldDayAdmission = await liveDemo.handleWorkflow(oldDayRequest)
  const oldDayResponse = openWorkflowResponse()
  const oldDayRun = oldDayAdmission.start(oldDayResponse)
  await providerStarted.promise
  assert.deepEqual(JSON.parse(await readFile(budgetFile, 'utf8')), { date: '2026-10-26', count: 2 })

  currentTime = Date.parse('2026-10-27T00:00:01Z')
  const newDayResult = await liveDemo.handle(directWorkflowRequest({
    role_id: 'account-executive',
    case_id: 'baseline'
  }, '203.0.113.131'))
  assert.equal(newDayResult.statusCode, 200)
  assert.equal(newDayResult.body.status, 'draft')
  assert.deepEqual(JSON.parse(await readFile(budgetFile, 'utf8')), { date: '2026-10-27', count: 1 })

  oldDayResponse.destroyed = true
  oldDayResponse.closed = true
  oldDayResponse.writable = false
  oldDayResponse.socket.destroyed = true
  oldDayResponse.emit('close')
  await providerAborted.promise
  await oldDayRun
  assert.deepEqual(JSON.parse(await readFile(budgetFile, 'utf8')), { date: '2026-10-27', count: 1 })
})

test('preserves partial final text and emits an error for max_tokens, provider failure, and missing terminal', async t => {
  const cases = [
    {
      label: 'max_tokens',
      second: {
        requestId: 'req_max',
        events: messageEvents('max_tokens', ['Partial draft']),
        message: finalMessage('Partial draft', 'max_tokens')
      },
      code: 'max_tokens',
      text: 'Partial draft'
    },
    {
      label: 'provider stream error',
      second: {
        requestId: 'req_stream_error',
        events: messageEvents('end_turn', ['Partial provider draft']),
        message: finalMessage('Partial provider draft'),
        failureAt: 3
      },
      code: 'provider_stream_error',
      text: 'Partial provider draft'
    },
    {
      label: 'missing terminal',
      second: {
        requestId: 'req_missing_terminal',
        events: messageEvents('end_turn', ['Partial without terminal']).filter(event => event.type !== 'message_stop'),
        message: finalMessage('Partial without terminal')
      },
      code: 'missing_terminal',
      text: 'Partial without terminal'
    }
  ]

  for (const item of cases) {
    await t.test(item.label, async () => {
      const budgetFile = await temporaryBudget()
      const client = fakeClient([
        { requestId: 'req_lookup', events: messageEvents('tool_use'), message: firstMessage() },
        item.second
      ])
      const origin = await startServer(configuredOptions(budgetFile, client))
      const response = await workflowRequest(origin, { role_id: 'account-executive' })
      const events = await readSse(response)
      assert.equal(events.filter(event => event.event === 'text_delta').map(event => event.data.text).join(''), item.text)
      assert.equal(events.some(event => event.event === 'complete'), false)
      const error = events.find(event => event.event === 'error').data
      assert.equal(error.code, item.code)
      assert.equal(error.partial, true)
      assert.equal(error.review_required, true)
      assert.equal(JSON.stringify(events).includes('raw provider detail must stay private'), false)
    })
  }
})

test('rejects an additional final tool request without executing a third provider call', async () => {
  const budgetFile = await temporaryBudget()
  const calls = []
  const extraTool = { type: 'tool_use', id: 'toolu_extra', name: WORKFLOW_TOOL_NAME, input: { account_id: WORKFLOW_ACCOUNT_ID } }
  const client = fakeClient([
    { requestId: 'req_lookup', events: messageEvents('tool_use'), message: firstMessage() },
    {
      requestId: 'req_extra_tool',
      events: messageEvents('tool_use', ['I need another lookup.']),
      message: finalMessage('I need another lookup.', 'tool_use', [extraTool])
    }
  ], calls)
  const origin = await startServer(configuredOptions(budgetFile, client))
  const events = await readSse(await workflowRequest(origin, { role_id: 'account-executive' }))
  assert.equal(calls.length, 2)
  assert.equal(events.some(event => event.event === 'complete'), false)
  assert.equal(events.find(event => event.event === 'error').data.code, 'unexpected_tool')
})

test('the total workflow timeout aborts the provider and emits a partial error', async () => {
  const budgetFile = await temporaryBudget()
  let providerSignal
  const client = {
    messages: {
      stream(_payload, options) {
        providerSignal = options.signal
        const stream = {
          async withResponse() {
            return { data: stream, request_id: 'req_timeout', response: new Response() }
          },
          async *[Symbol.asyncIterator]() {
            await new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }))
            throw new DOMException('aborted', 'AbortError')
          },
          async finalMessage() {
            throw new Error('no final message')
          }
        }
        return stream
      }
    }
  }
  const origin = await startServer(configuredOptions(budgetFile, client, { workflowTimeoutMs: 5 }))
  const events = await readSse(await workflowRequest(origin, { role_id: 'account-executive' }))
  const error = events.find(event => event.event === 'error').data
  assert.equal(providerSignal.aborted, true)
  assert.equal(error.code, 'workflow_timeout')
  assert.equal(error.partial, true)
  assert.equal(events.some(event => event.event === 'complete'), false)
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 1)
})

test('a browser disconnect aborts the active provider stream and releases shared concurrency', async () => {
  const budgetFile = await temporaryBudget()
  const providerStarted = deferred()
  const providerAborted = deferred()
  const client = {
    messages: {
      stream(_payload, options) {
        const stream = {
          async withResponse() {
            providerStarted.resolve()
            return { data: stream, request_id: 'req_waiting', response: new Response() }
          },
          async *[Symbol.asyncIterator]() {
            await new Promise(resolve => {
              if (options.signal.aborted) return resolve()
              options.signal.addEventListener('abort', resolve, { once: true })
            })
            providerAborted.resolve(options.signal.aborted)
            throw new DOMException('aborted', 'AbortError')
          },
          async finalMessage() {
            throw new Error('no final message')
          }
        }
        return stream
      }
    }
  }
  const origin = await startServer(configuredOptions(budgetFile, client, { maxConcurrentCalls: 1 }))
  const abortController = new AbortController()
  const response = await workflowRequest(origin, { role_id: 'account-executive' }, { signal: abortController.signal })
  await providerStarted.promise
  abortController.abort()
  await assert.rejects(response.text(), error => error.name === 'AbortError')
  assert.equal(await providerAborted.promise, true)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const demo = await fetch(`${origin}/api/demo`)
    if ((await demo.json()).status === 'ok') break
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.equal((JSON.parse(await readFile(budgetFile, 'utf8'))).count, 1)
})

test('workflow admission shares concurrency with the existing demo lane', async () => {
  const budgetFile = await temporaryBudget()
  const release = deferred()
  const started = deferred()
  const first = firstMessage()
  const client = fakeClient([
    {
      requestId: 'req_blocking',
      events: messageEvents('tool_use'),
      message: first,
      gateAt: 0,
      gate: release
    }
  ])
  const origin = await startServer(configuredOptions(budgetFile, client, { maxConcurrentCalls: 1 }))
  const pending = workflowRequest(origin, { role_id: 'account-executive' })
  const response = await pending
  const reader = response.body.getReader()
  await reader.read()
  started.resolve()

  const encoded = JSON.stringify({ role_id: 'account-executive', case_id: 'baseline' })
  const target = new URL(origin)
  const busy = await new Promise((resolve, reject) => {
    const request = http.request({
      host: target.hostname,
      port: target.port,
      path: '/api/demo',
      method: 'POST',
      headers: {
        Host: target.host,
        Origin: origin,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(encoded),
        'Sec-Fetch-Site': 'same-origin',
        'CF-Connecting-IP': '203.0.113.91'
      }
    }, incoming => {
      const chunks = []
      incoming.on('data', chunk => chunks.push(chunk))
      incoming.on('end', () => resolve({ status: incoming.statusCode, body: JSON.parse(Buffer.concat(chunks)) }))
    })
    request.on('error', reject)
    request.end(encoded)
  })
  assert.equal(busy.status, 429)
  assert.equal(busy.body.code, 'live_demo_busy')
  release.resolve()
  await reader.cancel()
})
