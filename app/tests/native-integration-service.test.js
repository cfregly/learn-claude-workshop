import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

import { createServer } from '../server.mjs'
import { createLiveDemo } from '../live-demo.mjs'
import { NativeIntegrationError, NATIVE_MODEL } from '../native-integration.mjs'


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

async function temporaryState() {
  const directory = await mkdtemp(path.join(tmpdir(), 'northstar-native-service-'))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  return {
    budgetFile: path.join(directory, 'model-usage.json'),
    receiptFile: path.join(directory, 'native-skill', 'latest-run.json')
  }
}

async function startServer(options) {
  const server = createServer({ demoOptions: options })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise(resolve => server.close(resolve)))
  return `http://127.0.0.1:${server.address().port}`
}

function nativePost(origin, body, { client = '203.0.113.70', headers = {} } = {}) {
  return fetch(`${origin}/api/native-integration`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      'CF-Connecting-IP': client,
      ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

function directNativeRequest(body, client = '203.0.113.74') {
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

function closedNativeResponse() {
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

async function readSse(response) {
  const text = await response.text()
  return text.trim().split('\n\n').filter(Boolean).map(chunk => {
    const lines = chunk.split('\n')
    return {
      event: lines.find(line => line.startsWith('event: '))?.slice(7),
      data: JSON.parse(lines.find(line => line.startsWith('data: '))?.slice(6) || '{}')
    }
  })
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

const output = Object.freeze({
  brief: Object.freeze({
    confirmed_facts: Object.freeze([{ text: 'Northstar renews January 31, 2027.', source_ids: ['CRM'] }]),
    interpretation: Object.freeze([{ text: 'The source record needs human review.', source_ids: ['CRM'] }]),
    open_questions: Object.freeze([{ text: 'SSO entitlement remains unknown.', source_ids: ['CALL'] }]),
    proposed_next_actions: Object.freeze([{ text: 'Confirm the unknowns.', source_ids: ['CRM', 'CALL'], owner: 'Maya Chen', status: 'Proposed' }])
  })
})

function createFakeNative({ uploadRequired = true, failAfterFirstStart = false, uploadRecovery = null, proofFailure = false, gate = null, entered = null } = {}) {
  const state = { runs: 0, providerStarts: 0 }
  const callsRequired = uploadRequired ? 2 : 1
  return {
    state,
    async plan() {
      return {
        enabled: true,
        reason: 'ready',
        upload_required: uploadRequired,
        calls_required: callsRequired
      }
    },
    async run({ roleId, traceId, signal, emit, onProviderCallStart }) {
      state.runs += 1
      const mcp = {
        trace_id: traceId,
        evidence_state: 'mcp_observed',
        account_id: 'northstar-freight',
        tool_name: 'lookup_northstar_account',
        actor_id: 'demo-account-owner',
        server_name: 'renewal_review',
        server_version: '1.0.0',
        protocol_version: '2025-11-25',
        source_ids: ['CRM', 'CALL', 'SUPPORT', 'USAGE'],
        fixture_sha256: 'a'.repeat(64),
        record_sha256: 'b'.repeat(64),
        receipt_sha256: 'c'.repeat(64)
      }
      await emit('mcp_observed', mcp)
      entered?.resolve()
      if (gate) await gate.promise
      if (signal.aborted) throw signal.reason

      const providerRequestIds = []
      if (uploadRequired) {
        await onProviderCallStart({ kind: 'skill_upload', ordinal: 1, trace_id: traceId })
        state.providerStarts += 1
        if (failAfterFirstStart) {
          throw new NativeIntegrationError('provider_outcome_unknown', 'unknown', {
            stage: 'skill_upload',
            receipt: {
              evidence_state: 'mcp_observed',
              provider_calls_started: 1,
              provider_calls: null,
              provider_request_ids: ['req_skill_unknown'],
              ...(uploadRecovery ? { upload_recovery: uploadRecovery } : {})
            }
          })
        }
        providerRequestIds.push('req_skill_upload')
      }
      const skill = {
        trace_id: traceId,
        evidence_state: 'skill_pinned',
        operation: uploadRequired ? 'create_skill' : 'reuse_pin',
        upload_required: uploadRequired,
        reused: !uploadRequired,
        skill_id: 'skill_native_test',
        version: 'version_native_1',
        bundle_sha256: 'd'.repeat(64),
        provider_request_id: uploadRequired ? 'req_skill_upload' : null,
        source_type: 'custom'
      }
      await emit('skill_pinned', skill)
      await onProviderCallStart({ kind: 'messages', ordinal: uploadRequired ? 2 : 1, trace_id: traceId })
      state.providerStarts += 1
      providerRequestIds.push('req_native_message')
      if (proofFailure) {
        const failedProof = {
          ...proof,
          passed: false,
          skill_instruction_file_access_attempt_seen: false,
          skill_instruction_file_hash_matched: false
        }
        const providerResponse = {
          returned_model: NATIVE_MODEL,
          stop_reason: 'end_turn',
          usage: { input_tokens: 420, output_tokens: 190 }
        }
        throw new NativeIntegrationError('native_proof_failed', 'proof failed', {
          stage: 'verify',
          receipt: {
            evidence_state: 'skill_pinned',
            provider_calls_started: callsRequired,
            provider_request_ids: providerRequestIds,
            message: providerResponse,
            skill_access_proof: failedProof,
            proof: {
              status: 'PROOF_FAILED',
              response: providerResponse,
              skill_access_proof: failedProof
            }
          }
        })
      }
      const native = {
        trace_id: traceId,
        evidence_state: 'native_skill_observed',
        review_required: true,
        stop_reason: 'end_turn',
        model: NATIVE_MODEL,
        provider_request_id: 'req_native_message',
        usage: { input_tokens: 420, output_tokens: 190 },
        container_id: 'container_native_test',
        skill_id: skill.skill_id,
        skill_version: skill.version,
        proof,
        output
      }
      await emit('native_skill_observed', native)
      return {
        schema_version: 1,
        status: 'complete',
        trace_id: traceId,
        role_id: roleId,
        account_id: 'northstar-freight',
        review_required: true,
        evidence_state: 'native_skill_observed',
        provider_request_ids: providerRequestIds,
        provider_calls_started: callsRequired,
        skill_pin: { skill_id: skill.skill_id, version: skill.version },
        message: {
          returned_model: NATIVE_MODEL,
          model_exact_match: true,
          stop_reason: 'end_turn',
          final_text_char_count: 25,
          thinking_response_persisted: false
        },
        skill_access_proof: { passed: true },
        proof,
        output,
        usage: native.usage,
        model: NATIVE_MODEL,
        stop_reason: 'end_turn',
        message_stop: true,
        mcp_read: true,
        native_skill_used: true,
        proof_passed: true
      }
    }
  }
}

function configuredOptions(state, nativeIntegration, overrides = {}) {
  return {
    env: {
      ANTHROPIC_API_KEY: 'offline-test-bearer',
      ANTHROPIC_MODEL: NATIVE_MODEL,
      MODEL_BUDGET_FILE: state.budgetFile
    },
    nativeReceiptFile: state.receiptFile,
    nativeIntegration,
    cooldownMs: 0,
    uuid: () => 'fixed-native-trace',
    ...overrides
  }
}

test('native capability and SSE completion share the ledger and persist only a sanitized terminal receipt', async () => {
  const state = await temporaryState()
  const native = createFakeNative()
  const origin = await startServer(configuredOptions(state, native))

  const capability = await (await fetch(`${origin}/api/demo`)).json()
  assert.deepEqual(capability.native_integration, {
    enabled: true,
    reason: 'ready',
    endpoint: '/api/native-integration',
    upload_required: true,
    calls_required: 2,
    role_ids: ['software-engineer-api', 'account-executive'],
    account_id: 'northstar-freight',
    tool_name: 'lookup_northstar_account',
    skill_name: 'renewal-brief',
    model: NATIVE_MODEL,
    data_kind: 'synthetic',
    review_required: true,
    max_provider_calls: 2,
    limits: { request_bytes: 2_048, max_output_tokens: 900, total_timeout_ms: 45_000 }
  })

  const response = await nativePost(origin, { role_id: 'software-engineer-api' })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/event-stream/)
  assert.equal(response.headers.get('x-accel-buffering'), 'no')
  const events = await readSse(response)
  assert.deepEqual(events.map(item => item.event), [
    'run_start',
    'status',
    'mcp_observed',
    'skill_pinned',
    'native_skill_observed',
    'complete'
  ])
  assert.equal(events.at(-1).data.message_stop, true)
  assert.equal(events.at(-1).data.stop_reason, 'end_turn')
  assert.deepEqual(events.at(-1).data.provider_request_ids, ['req_skill_upload', 'req_native_message'])
  assert.equal(native.state.providerStarts, 2)

  assert.deepEqual(JSON.parse(await readFile(state.budgetFile, 'utf8')), {
    date: new Date().toISOString().slice(0, 10),
    count: 2
  })
  const receipt = JSON.parse(await readFile(state.receiptFile, 'utf8'))
  assert.equal(receipt.status, 'complete')
  assert.equal(receipt.evidence_state, 'native_skill_observed')
  assert.equal(receipt.message_stop, true)
  assert.equal(receipt.thinking_persisted, false)
  assert.equal(receipt.raw_response_persisted, false)
  assert.equal(JSON.stringify(receipt).includes('offline-test-bearer'), false)

  const after = await (await fetch(`${origin}/api/demo`)).json()
  assert.equal(after.limits.remaining_calls, 98)
})

test('native admission rejects extra input and refunds only the unstarted provider slot after an ambiguous method outcome', async () => {
  const state = await temporaryState()
  const native = createFakeNative({ failAfterFirstStart: true })
  const origin = await startServer(configuredOptions(state, native))

  const invalid = await nativePost(origin, { role_id: 'software-engineer-api', model: NATIVE_MODEL })
  assert.equal(invalid.status, 400)
  assert.match(invalid.headers.get('content-type'), /application\/json/)
  assert.equal(native.state.runs, 0)

  const wrongOrigin = await nativePost(origin, { role_id: 'software-engineer-api' }, {
    headers: { Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site' }
  })
  assert.equal(wrongOrigin.status, 403)
  assert.equal(native.state.runs, 0)

  const response = await nativePost(origin, { role_id: 'account-executive' })
  const events = await readSse(response)
  assert.deepEqual(events.map(item => item.event), ['run_start', 'status', 'mcp_observed', 'error'])
  assert.equal(events.at(-1).data.code, 'provider_outcome_unknown')
  assert.deepEqual(events.at(-1).data.provider_request_ids, ['req_skill_unknown'])
  assert.deepEqual(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 1)
  const receipt = JSON.parse(await readFile(state.receiptFile, 'utf8'))
  assert.equal(receipt.status, 'error')
  assert.equal(receipt.provider_calls_started, 1)
  assert.equal(receipt.calls_reserved, 2)
  assert.equal(receipt.retry_attempted, false)
})

test('native upload failure retains only bounded recovery IDs without claiming a confirmed pin', async () => {
  const state = await temporaryState()
  const native = createFakeNative({
    failAfterFirstStart: true,
    uploadRecovery: {
      operation: 'create_skill', provider_request_id: 'req_skill_unknown',
      returned: { id: 'skill_returned', latest_version_id: 'version_returned', name: 'sk-ant-never-store', raw_secret: 'private-value' },
      raw_response: { credential: 'private-value' }, pin_file: '/private/secret-path'
    }
  })
  const origin = await startServer(configuredOptions(state, native))
  const events = await readSse(await nativePost(origin, { role_id: 'software-engineer-api' }))
  const failure = events.at(-1)
  assert.equal(failure.event, 'error')
  assert.equal(failure.data.evidence_state, 'mcp_observed')
  assert.equal(events.some(event => event.event === 'skill_pinned' || event.event === 'complete'), false)
  assert.deepEqual(failure.data.upload_recovery, {
    status: 'requires_reconciliation', operation: 'create_skill', provider_request_id: 'req_skill_unknown',
    returned: { id: 'skill_returned', latest_version_id: 'version_returned' },
    retry_attempted: false, raw_response_persisted: false
  })
  const receiptText = await readFile(state.receiptFile, 'utf8')
  const receipt = JSON.parse(receiptText)
  assert.deepEqual(receipt.upload_recovery, failure.data.upload_recovery)
  for (const forbidden of ['private-value', 'secret-path', 'sk-ant-never-store']) assert.equal(receiptText.includes(forbidden), false)
  assert.equal(native.state.providerStarts, 1)
  assert.equal(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 1)
})

test('native proof failure keeps bounded provider diagnostics without claiming completion', async () => {
  const state = await temporaryState()
  const native = createFakeNative({ uploadRequired: false, proofFailure: true })
  const origin = await startServer(configuredOptions(state, native))

  const response = await nativePost(origin, { role_id: 'software-engineer-api' })
  const events = await readSse(response)
  assert.deepEqual(events.map(item => item.event), ['run_start', 'status', 'mcp_observed', 'skill_pinned', 'error'])
  const failure = events.at(-1).data
  assert.equal(failure.code, 'native_proof_failed')
  assert.equal(failure.evidence_state, 'skill_pinned')
  assert.equal(failure.proof.skill_instruction_file_access_attempt_seen, false)
  assert.equal(failure.proof.skill_instruction_file_hash_matched, false)
  assert.deepEqual(failure.provider_response, {
    response_received: true,
    model: NATIVE_MODEL,
    stop_reason: 'end_turn',
    usage_known: true,
    usage: { input_tokens: 420, output_tokens: 190 }
  })

  assert.deepEqual(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 1)
  const receipt = JSON.parse(await readFile(state.receiptFile, 'utf8'))
  assert.equal(receipt.status, 'error')
  assert.equal(receipt.evidence_state, 'skill_pinned')
  assert.equal(receipt.calls_reserved, 1)
  assert.equal(receipt.provider_calls_started, 1)
  assert.equal(receipt.message_stop, false)
  assert.equal(receipt.stop_reason, null)
  assert.deepEqual(receipt.provider_request_ids, ['req_native_message'])
  assert.deepEqual(receipt.provider_response, failure.provider_response)
  assert.equal(receipt.raw_response_persisted, false)
  assert.equal(receipt.thinking_persisted, false)
  assert.equal(JSON.stringify(receipt).includes('stdout'), false)
})

test('a response closed after native admission starts no core work and refunds the full date-bound reservation', async () => {
  const state = await temporaryState()
  const native = createFakeNative()
  const liveDemo = createLiveDemo(configuredOptions(state, native, {
    maxConcurrentCalls: 1,
    maxDailyCalls: 2,
    now: () => Date.parse('2026-10-26T12:00:00Z')
  }))

  const admitted = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'software-engineer-api' }))
  assert.equal(admitted.stream, true)
  assert.equal(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 2)
  await admitted.start(closedNativeResponse())
  assert.equal(native.state.runs, 0)
  assert.deepEqual(JSON.parse(await readFile(state.budgetFile, 'utf8')), {
    date: '2026-10-26',
    count: 0
  })

  const next = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }, '203.0.113.75'))
  assert.equal(next.stream, true)
  await next.start(closedNativeResponse())
  assert.equal(native.state.runs, 0)
  assert.equal(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 0)
})

test('native execution occupies the shared concurrency gate and the same client cooldown', async () => {
  const state = await temporaryState()
  const gate = deferred()
  const entered = deferred()
  const native = createFakeNative({ gate, entered })
  let unexpectedFetch = false
  const origin = await startServer(configuredOptions(state, native, {
    maxConcurrentCalls: 1,
    cooldownMs: 4_000,
    fetchImpl: async () => {
      unexpectedFetch = true
      throw new Error('provider fetch must not run')
    }
  }))

  const nativeResponse = await nativePost(origin, { role_id: 'software-engineer-api' }, { client: '203.0.113.71' })
  const reading = readSse(nativeResponse)
  await entered.promise
  const busy = await fetch(`${origin}/api/demo`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      'CF-Connecting-IP': '203.0.113.72'
    },
    body: JSON.stringify({ role_id: 'account-executive', case_id: 'baseline' })
  })
  assert.equal(busy.status, 429)
  assert.equal((await busy.json()).code, 'live_demo_busy')
  assert.equal(unexpectedFetch, false)

  gate.resolve()
  await reading
  const cooldown = await fetch(`${origin}/api/demo`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      'CF-Connecting-IP': '203.0.113.71'
    },
    body: JSON.stringify({ role_id: 'account-executive', case_id: 'baseline' })
  })
  assert.equal(cooldown.status, 429)
  assert.equal((await cooldown.json()).code, 'client_cooldown')
  assert.equal(unexpectedFetch, false)
})

test('native planning applies the client cooldown before its first await', async () => {
  const state = await temporaryState()
  const native = createFakeNative()
  const planGate = deferred()
  const planEntered = deferred()
  const readyPlan = native.plan.bind(native)
  let planCalls = 0
  native.plan = async () => {
    planCalls += 1
    if (planCalls === 1) {
      planEntered.resolve()
      await planGate.promise
    }
    return readyPlan()
  }
  const liveDemo = createLiveDemo(configuredOptions(state, native, { cooldownMs: 4_000 }))
  const first = liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'software-engineer-api' }))
  await planEntered.promise
  let overlapping
  try {
    overlapping = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }))
    assert.equal(overlapping.statusCode, 429)
    assert.equal(overlapping.body.code, 'client_cooldown')
    assert.equal(planCalls, 1)
  } finally {
    planGate.resolve()
    for (const result of [await first, overlapping]) {
      if (result?.stream) await result.start(closedNativeResponse())
    }
  }
  assert.equal(native.state.runs, 0)
  assert.equal(native.state.providerStarts, 0)
  assert.equal(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 0)
})

test('pending native plans occupy the shared two-run gate', async () => {
  const state = await temporaryState()
  const native = createFakeNative()
  const planGate = deferred()
  const plansEntered = [deferred(), deferred()]
  const readyPlan = native.plan.bind(native)
  let planCalls = 0
  native.plan = async () => {
    const index = planCalls++
    if (index < plansEntered.length) {
      plansEntered[index].resolve()
      await planGate.promise
    }
    return readyPlan()
  }
  const liveDemo = createLiveDemo(configuredOptions(state, native, { maxConcurrentCalls: 2 }))
  const first = liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'software-engineer-api' }, '203.0.113.81'))
  await plansEntered[0].promise
  const second = liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }, '203.0.113.82'))
  await plansEntered[1].promise
  let extraNative
  let extraWorkflow
  try {
    extraNative = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }, '203.0.113.83'))
    extraWorkflow = await liveDemo.handleWorkflow(directNativeRequest({ role_id: 'account-executive' }, '203.0.113.84'))
    for (const blocked of [extraNative, extraWorkflow]) {
      assert.equal(blocked.statusCode, 429)
      assert.equal(blocked.body.code, 'live_demo_busy')
    }
    assert.equal(planCalls, 2)
  } finally {
    planGate.resolve()
    for (const result of [await first, await second, extraNative, extraWorkflow]) {
      if (result?.stream) await result.start(closedNativeResponse())
    }
  }
  assert.equal(native.state.runs, 0)
  assert.equal(native.state.providerStarts, 0)
  assert.equal(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 0)
})

test('a failed older native plan preserves a newer client cooldown', async () => {
  const state = await temporaryState()
  const native = createFakeNative()
  const planGate = deferred()
  const planEntered = deferred()
  const readyPlan = native.plan.bind(native)
  let timestamp = Date.parse('2026-10-26T12:00:00Z')
  let planCalls = 0
  native.plan = async () => {
    planCalls += 1
    if (planCalls === 1) {
      planEntered.resolve()
      await planGate.promise
      return { enabled: false, reason: 'runtime_dependencies_missing' }
    }
    return readyPlan()
  }
  const liveDemo = createLiveDemo(configuredOptions(state, native, {
    maxConcurrentCalls: 2,
    cooldownMs: 4_000,
    now: () => timestamp
  }))
  const older = liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'software-engineer-api' }))
  await planEntered.promise
  timestamp += 5_000
  const newer = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }))
  try {
    assert.equal(newer.stream, true)
  } finally {
    if (newer.stream) await newer.start(closedNativeResponse())
    planGate.resolve()
    await older
  }
  const cooldown = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }))
  try {
    assert.equal(cooldown.statusCode, 429)
    assert.equal(cooldown.body.code, 'client_cooldown')
  } finally {
    if (cooldown.stream) await cooldown.start(closedNativeResponse())
  }
  assert.equal(native.state.providerStarts, 0)
})

for (const failure of ['disabled', 'throws']) {
  test(`native plan ${failure} releases admission and client cooldown without spending budget`, async () => {
    const state = await temporaryState()
    const native = createFakeNative()
    const readyPlan = native.plan.bind(native)
    let planCalls = 0
    native.plan = async () => {
      planCalls += 1
      if (planCalls === 1) {
        if (failure === 'throws') throw new Error('offline plan failure')
        return { enabled: false, reason: 'runtime_dependencies_missing' }
      }
      return readyPlan()
    }
    const liveDemo = createLiveDemo(configuredOptions(state, native, {
      maxConcurrentCalls: 1,
      cooldownMs: 4_000
    }))
    const failed = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'software-engineer-api' }))
    assert.equal(failed.statusCode, 503)
    assert.equal(failed.body.code, 'runtime_dependencies_missing')
    await assert.rejects(readFile(state.budgetFile), { code: 'ENOENT' })
    const retry = await liveDemo.handleNativeIntegration(directNativeRequest({ role_id: 'account-executive' }))
    try {
      assert.equal(retry.stream, true)
    } finally {
      if (retry.stream) await retry.start(closedNativeResponse())
    }
    assert.equal(native.state.runs, 0)
    assert.equal(native.state.providerStarts, 0)
    assert.equal(JSON.parse(await readFile(state.budgetFile, 'utf8')).count, 0)
  })
}

test('Ask receives trusted native route context without a current receipt or silent role remap', async () => {
  const state = await temporaryState()
  const native = createFakeNative({ uploadRequired: false })
  let providerBody
  const origin = await startServer(configuredOptions(state, native, {
    fetchImpl: async (_url, options) => {
      providerBody = JSON.parse(options.body)
      return new Response(JSON.stringify({
        id: 'msg_ask_native',
        model: NATIVE_MODEL,
        content: [{ type: 'text', text: 'The route is optional and no current native receipt is included.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 20 }
      }), { status: 200, headers: { 'request-id': 'req_ask_native' } })
    }
  }))

  const response = await fetch(`${origin}/api/ask`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'Sec-Fetch-Site': 'same-origin',
      'CF-Connecting-IP': '203.0.113.73'
    },
    body: JSON.stringify({
      question: 'What does this optional route prove?',
      context: { route: 'native-integration', role_id: 'product-manager' }
    })
  })
  assert.equal(response.status, 200)
  const serialized = JSON.stringify(providerBody)
  assert.match(serialized, /must not be remapped to another learner role/)
  assert.match(serialized, /source commit c74acd4/)
  assert.match(serialized, /includes no current native brief, SSE event, trace ID, provider request ID/)
  assert.equal(serialized.includes('skill_native_test'), false)

  const missingRole = await fetch(`${origin}/api/ask`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' },
    body: JSON.stringify({ question: 'Explain this route.', context: { route: 'native-integration' } })
  })
  assert.equal(missingRole.status, 400)
})
