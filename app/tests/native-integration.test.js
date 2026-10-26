import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, execFileSync, spawn as nodeSpawn } from 'node:child_process'
import { promisify } from 'node:util'
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  writeFile
} from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  NativeIntegrationError,
  NATIVE_BUNDLE_FILES,
  NATIVE_INTEGRATION_CONTRACT,
  NATIVE_MODEL,
  NATIVE_TOOL_VERSION,
  createNativeIntegration
} from '../native-integration.mjs'


const execFileAsync = promisify(execFile)
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PR1_ROOT = process.env.PR1_REPO_ROOT || path.resolve(APP_ROOT, '..')
const PR1_SKILL_ROOT = path.join(PR1_ROOT, 'labs', 'skills', 'renewal-brief')
const PR1_FIXTURE = path.join(PR1_ROOT, 'labs', 'source-fixtures.json')
const PROOF_BRIDGE = path.join(APP_ROOT, 'native-integration-proof.py')

async function exists(filename) {
  try {
    await access(filename, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

const PR1_AVAILABLE = await exists(PR1_SKILL_ROOT) && await exists(PR1_FIXTURE)
const PYTHON = execFileSync('/usr/bin/env', ['which', 'python3'], { encoding: 'utf8' }).trim()

function fixedRecord(source) {
  const fixture = source.fixtures.find(item => item.id === 'baseline')
  return {
    synthetic: true,
    account_id: 'northstar-freight',
    source_id: 'source-fixtures.json#baseline',
    source_ids: ['CRM', 'CALL', 'SUPPORT', 'USAGE'],
    notes: fixture.notes,
    access_checked: true,
    actor_id: 'demo-account-owner'
  }
}

function fakeMcpServer(record) {
  return `
const readline = require('node:readline')
if (Object.keys(process.env).some(key => /ANTHROPIC|API_KEY|AUTH_TOKEN/.test(key))) {
  process.stdout.write('credential leak\\n')
  process.exit(4)
}
const record = ${JSON.stringify(record)}
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
const send = value => process.stdout.write(JSON.stringify(value) + '\\n')
rl.on('line', line => {
  const request = JSON.parse(line)
  if (request.method === 'notifications/initialized') return
  if (request.method === 'initialize') return send({
    jsonrpc: '2.0', id: request.id, result: {
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: 'renewal_review', version: '1.0.0' }
    }
  })
  if (request.method === 'tools/list') return send({
    jsonrpc: '2.0', id: request.id, result: { tools: [{
      name: 'lookup_northstar_account',
      inputSchema: {
        type: 'object',
        properties: { account_id: { type: 'string' } },
        required: ['account_id'],
        additionalProperties: false
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    }] }
  })
  if (request.method === 'tools/call') return send({
    jsonrpc: '2.0', id: request.id, result: {
      content: [{ type: 'text', text: JSON.stringify(record) }],
      structuredContent: record,
      isError: false
    }
  })
  send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'unknown' } })
})
rl.on('close', () => process.exit(0))
`
}

async function renderFixture(environment, record) {
  const recordFile = path.join(environment.temporary, 'record.json')
  const outputFile = path.join(environment.temporary, `brief-${Math.random()}.json`)
  await writeFile(recordFile, `${JSON.stringify(record)}\n`)
  const { stdout } = await execFileAsync(PYTHON, [
    path.join(environment.skillRoot, 'scripts', 'render_brief.py'),
    '--records-file', recordFile,
    '--output', outputFile
  ], {
    env: {
      PATH: process.env.PATH,
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PYTHONDONTWRITEBYTECODE: '1'
    }
  })
  return {
    stdout: stdout.trim(),
    output: JSON.parse(await readFile(outputFile, 'utf8'))
  }
}

async function authoredResponse(environment, request, options = {}) {
  const rendered = await renderFixture(environment, environment.record)
  const skillText = await readFile(path.join(environment.skillRoot, 'SKILL.md'), 'utf8')
  const contractHash = environment.hashes['scripts/contract.py']
  const rendererHash = environment.hashes['scripts/render_brief.py']
  return {
    id: 'msg_native_test',
    model: options.model || NATIVE_MODEL,
    stop_reason: options.stopReason || 'end_turn',
    container: {
      id: 'container_native_test',
      expires_at: '2026-10-27T00:00:00Z',
      skills: request.container.skills
    },
    content: [
      {
        type: 'server_tool_use',
        id: 'read_skill',
        name: 'bash_code_execution',
        input: { command: 'cat /skills/renewal-brief/SKILL.md' }
      },
      {
        type: 'bash_code_execution_tool_result',
        tool_use_id: 'read_skill',
        content: {
          type: 'bash_code_execution_result',
          stdout: skillText,
          stderr: '',
          return_code: 0,
          content: []
        }
      },
      { type: 'thinking', thinking: 'PRIVATE THINKING MUST NOT REACH RECEIPTS' },
      {
        type: 'server_tool_use',
        id: 'hash_scripts',
        name: 'bash_code_execution',
        input: {
          command: 'sha256sum /skills/renewal-brief/scripts/contract.py /skills/renewal-brief/scripts/render_brief.py'
        }
      },
      {
        type: 'bash_code_execution_tool_result',
        tool_use_id: 'hash_scripts',
        content: {
          type: 'bash_code_execution_result',
          stdout: `${contractHash}  /skills/renewal-brief/scripts/contract.py\n${rendererHash}  /skills/renewal-brief/scripts/render_brief.py\n`,
          stderr: '',
          return_code: 0,
          content: []
        }
      },
      {
        type: 'server_tool_use',
        id: 'run_skill',
        name: 'bash_code_execution',
        input: {
          command: 'python /skills/renewal-brief/scripts/render_brief.py --records-file /tmp/renewal-records.json --output /tmp/renewal-brief.json'
        }
      },
      {
        type: 'bash_code_execution_tool_result',
        tool_use_id: 'run_skill',
        content: {
          type: 'bash_code_execution_result',
          stdout: rendered.stdout,
          stderr: '',
          return_code: 0,
          content: []
        }
      },
      { type: 'text', text: 'Synthetic brief complete.' }
    ],
    usage: { input_tokens: 100, output_tokens: 200 }
  }
}

function promiseWithResponse(factory, requestId) {
  return {
    async withResponse() {
      return { data: await factory(), request_id: requestId }
    }
  }
}

function createFakeClient(environment, options = {}) {
  const calls = []
  const client = {
    baseURL: options.baseURL || 'https://api.anthropic.com',
    authToken: 'test-bearer-token',
    apiKey: null,
    maxRetries: 0,
    skills: {
      create(params, requestOptions) {
        calls.push({ kind: 'create_skill', params, requestOptions })
        if (options.uploadDeferred) return promiseWithResponse(() => options.uploadDeferred.promise, 'req_skill_create')
        if (options.uploadError) return promiseWithResponse(() => Promise.reject(options.uploadError), 'req_skill_create')
        return promiseWithResponse(() => ({
          type: 'skill',
          id: 'skill_native_test',
          latest_version_id: 'version_native_1',
          display_name: 'Renewal Brief',
          source: { type: 'custom' }
        }), 'req_skill_create')
      },
      versions: {
        create(skillId, params, requestOptions) {
          calls.push({ kind: 'create_version', skillId, params, requestOptions })
          return promiseWithResponse(() => ({
            type: 'skill_version',
            id: 'version_native_2',
            skill_id: skillId,
            name: 'renewal-brief',
            description: 'test'
          }), 'req_skill_version')
        }
      }
    },
    messages: {
      create(request, requestOptions) {
        calls.push({ kind: 'messages', request, requestOptions })
        if (options.messageError) {
          return promiseWithResponse(() => Promise.reject(options.messageError), 'req_native_message')
        }
        return promiseWithResponse(
          () => authoredResponse(environment, request, options.message || {}),
          'req_native_message'
        )
      }
    }
  }
  return { client, calls }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function setup() {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'native-integration-test-'))
  const labsRoot = path.join(temporary, 'labs')
  const skillRoot = path.join(labsRoot, 'skills', 'renewal-brief')
  const mcpDirectory = path.join(labsRoot, 'mcp', 'renewal-review')
  const fixture = path.join(labsRoot, 'source-fixtures.json')
  const mcpServer = path.join(mcpDirectory, 'server.cjs')
  const stateRoot = path.join(temporary, 'state')
  const pinFile = path.join(stateRoot, 'renewal-brief-pin.json')
  await cp(PR1_SKILL_ROOT, skillRoot, { recursive: true })
  await cp(PR1_FIXTURE, fixture)
  await mkdir(mcpDirectory, { recursive: true })
  const source = JSON.parse(await readFile(fixture, 'utf8'))
  const record = fixedRecord(source)
  await writeFile(mcpServer, fakeMcpServer(record), { mode: 0o700 })
  const inspect = JSON.parse(execFileSync(PYTHON, [PROOF_BRIDGE], {
    input: JSON.stringify({ operation: 'inspect', skill_root: skillRoot }),
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONIOENCODING: 'utf-8'
    }
  }))
  const hashes = Object.fromEntries(inspect.manifest.files.map(item => [item.path, item.sha256]))
  const paths = {
    labsRoot,
    mcpPython: process.execPath,
    proofPython: PYTHON,
    mcpServer,
    fixture,
    skillRoot,
    proofBridge: PROOF_BRIDGE,
    stateRoot,
    pinFile
  }
  return {
    temporary,
    skillRoot,
    paths,
    record,
    hashes,
    core: createNativeIntegration({ paths, timeoutMs: 10_000, uuid: () => 'trace-test' }),
    async cleanup() {
      await rm(temporary, { recursive: true, force: true })
    }
  }
}

test('capability fails closed when reviewed runtime dependencies are absent', async () => {
  const core = createNativeIntegration({
    paths: {
      labsRoot: '/path/that/does/not/exist',
      proofPython: PYTHON,
      proofBridge: PROOF_BRIDGE
    }
  })
  const capability = await core.capability()
  assert.equal(capability.available, false)
  assert.equal(capability.reason, 'runtime_dependencies_missing')
  assert.equal(capability.provider_calls_required, null)
  assert.deepEqual(NATIVE_INTEGRATION_CONTRACT.core_events, [
    'mcp_observed',
    'skill_pinned',
    'native_skill_observed'
  ])
})

test('real fixed STDIO handshake uploads once, proves Sonnet between_tools, then reuses the pin', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  const originalKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'must-not-reach-child'
  try {
    const { client, calls } = createFakeClient(environment)
    const initialCapability = await environment.core.capability()
    assert.equal(initialCapability.enabled, true)
    assert.equal(initialCapability.upload_required, true)
    assert.equal(initialCapability.calls_required, 2)
    const providerStarts = []
    const events = []
    const first = await environment.core.run({
      roleId: 'software-engineer-api',
      client,
      emit: async (event, data) => events.push({ event, data }),
      onProviderCallStart: async data => providerStarts.push(data.kind)
    })

    assert.equal(first.status, 'complete')
    assert.equal(first.mcp.server_name, 'renewal_review')
    assert.equal(first.mcp.tool_name, 'lookup_northstar_account')
    assert.equal(first.mcp.child_exit_code, 0)
    assert.equal(first.skill_pin.operation, 'create_skill')
    assert.equal(first.skill_pin.reused, false)
    assert.equal(first.message.returned_model, NATIVE_MODEL)
    assert.equal(first.message.stop_reason, 'end_turn')
    assert.equal(first.proof_passed, true)
    assert.equal(first.proof.source_record_validated, true)
    assert.equal(first.proof.canonical_output_hash_matched, true)
    assert.deepEqual(first.provider_request_ids, ['req_skill_create', 'req_native_message'])
    assert.deepEqual(providerStarts, ['skill_upload', 'messages'])
    assert.deepEqual(calls.map(call => call.kind), ['create_skill', 'messages'])
    assert.equal(calls[0].params.files.length, 4)
    assert.deepEqual(calls[0].params.files.map(file => file.name), NATIVE_BUNDLE_FILES.map(file => `renewal-brief/${file}`))
    assert.deepEqual(calls[1].request.thinking, { type: 'between_tools' })
    assert.equal(calls[1].request.max_tokens, 900)
    assert.equal(calls[1].request.model, NATIVE_MODEL)
    assert.deepEqual(calls[1].request.tools, [{ type: NATIVE_TOOL_VERSION, name: 'code_execution' }])
    assert.equal('tool_choice' in calls[1].request, false)
    assert.equal('output_config' in calls[1].request, false)
    const prompt = calls[1].request.messages[0].content
    const instructionRead = 'cat /skills/renewal-brief/SKILL.md'
    assert.match(prompt, /Before any other code execution command, run exactly this standalone command/)
    assert.match(prompt, /Do not combine the instruction-file read with another command/)
    assert.match(prompt, /After the required tool results, return one short final text sentence/)
    assert.match(prompt, new RegExp(`pinned SKILL\\.md SHA-256: ${environment.hashes['SKILL.md']}`))
    assert.ok(prompt.indexOf(instructionRead) < prompt.indexOf('<application_observed_mcp_record>'))
    assert.deepEqual(events.map(item => item.event), [
      'mcp_observed',
      'skill_pinned',
      'native_skill_observed'
    ])
    assert.equal(events.at(-1).data.evidence_state, 'native_skill_observed')
    assert.equal(events.at(-1).data.proof.passed, true)
    assert.ok(events.at(-1).data.output.brief.confirmed_facts.length > 0)
    assert.equal(JSON.stringify(first).includes('PRIVATE THINKING'), false)
    assert.equal((await stat(environment.paths.pinFile)).mode & 0o777, 0o600)

    const pinnedCapability = await environment.core.capability()
    assert.equal(pinnedCapability.upload_required, false)
    assert.equal(pinnedCapability.calls_required, 1)

    const secondStarts = []
    const second = await environment.core.run({
      roleId: 'account-executive',
      client,
      emit: async () => true,
      onProviderCallStart: async data => secondStarts.push(data.kind)
    })
    assert.equal(second.status, 'complete')
    assert.equal(second.skill_pin.reused, true)
    assert.equal(second.skill_pin.provider_request_id, null)
    assert.deepEqual(second.provider_request_ids, ['req_native_message'])
    assert.deepEqual(secondStarts, ['messages'])
    assert.deepEqual(calls.map(call => call.kind), ['create_skill', 'messages', 'messages'])
  } finally {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
    await environment.cleanup()
  }
})

test('MCP invokes the validated virtualenv path without resolving away its environment', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    const virtualenvPython = path.join(environment.temporary, 'venv-python')
    await symlink(process.execPath, virtualenvPython)
    const spawns = []
    const core = createNativeIntegration({
      paths: { ...environment.paths, mcpPython: virtualenvPython },
      timeoutMs: 10_000,
      uuid: () => 'trace-venv-test',
      spawnImpl(command, args, options) {
        spawns.push({ command, args })
        return nodeSpawn(command, args, options)
      }
    })
    const { client } = createFakeClient(environment)
    const result = await core.run({
      roleId: 'software-engineer-api',
      client,
      emit: async () => true,
      onProviderCallStart: async () => {}
    })

    assert.equal(result.status, 'complete')
    const mcpSpawn = spawns.find(item => item.args.includes('--actor'))
    assert.ok(mcpSpawn)
    assert.equal(mcpSpawn.command, virtualenvPython)
    assert.notEqual(mcpSpawn.command, await realpath(virtualenvPython))
  } finally {
    await environment.cleanup()
  }
})

test('bundle drift creates one version for the pinned Skill and keeps the two-call ceiling', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    const { client, calls } = createFakeClient(environment)
    await environment.core.run({
      roleId: 'software-engineer-api',
      client,
      emit: async () => true,
      onProviderCallStart: async () => {}
    })
    await writeFile(path.join(environment.skillRoot, 'SKILL.md'), `${await readFile(path.join(environment.skillRoot, 'SKILL.md'), 'utf8')}\n`)
    const starts = []
    const result = await environment.core.run({
      roleId: 'software-engineer-api',
      client,
      emit: async () => true,
      onProviderCallStart: async data => starts.push(data.kind)
    })
    assert.equal(result.status, 'complete')
    assert.equal(result.skill_pin.operation, 'create_version')
    assert.equal(result.skill_pin.version, 'version_native_2')
    assert.deepEqual(starts, ['skill_upload', 'messages'])
    assert.deepEqual(calls.map(call => call.kind), ['create_skill', 'messages', 'create_version', 'messages'])
    assert.equal(calls[2].skillId, 'skill_native_test')
  } finally {
    await environment.cleanup()
  }
})

test('unknown upload outcome is retained without a retry, pin, or Messages call', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    const error = Object.assign(new Error('transport ended'), { request_id: 'req_unknown' })
    const { client, calls } = createFakeClient(environment, { uploadError: error })
    const starts = []
    await assert.rejects(
      environment.core.run({
        roleId: 'software-engineer-api',
        client,
        emit: async () => true,
        onProviderCallStart: async data => starts.push(data.kind)
      }),
      failure => {
        assert.ok(failure instanceof NativeIntegrationError)
        assert.equal(failure.code, 'provider_outcome_unknown')
        assert.equal(failure.receipt.provider_error.outcome, 'unknown_after_started_request')
        assert.equal(failure.receipt.provider_error.retry_attempted, false)
        assert.equal(failure.receipt.provider_calls_started, 1)
        assert.equal(failure.receipt.skills_method_invocations, 1)
        assert.equal(failure.receipt.provider_calls, null)
        assert.equal(failure.receipt.provider_request_and_usage_state, 'unknown_after_method_exception')
        assert.deepEqual(failure.receipt.provider_request_ids, ['req_unknown'])
        return true
      }
    )
    assert.deepEqual(starts, ['skill_upload'])
    assert.deepEqual(calls.map(call => call.kind), ['create_skill'])
    await assert.rejects(lstat(environment.paths.pinFile), { code: 'ENOENT' })
  } finally {
    await environment.cleanup()
  }
})

test('unknown Messages outcome preserves the confirmed pin and started-call accounting without a retry', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    const error = Object.assign(new Error('response stream ended'), { request_id: 'req_message_unknown' })
    const { client, calls } = createFakeClient(environment, { messageError: error })
    const starts = []
    await assert.rejects(
      environment.core.run({
        roleId: 'account-executive',
        client,
        emit: async () => true,
        onProviderCallStart: async data => starts.push(data.kind)
      }),
      failure => {
        assert.ok(failure instanceof NativeIntegrationError)
        assert.equal(failure.code, 'provider_outcome_unknown')
        assert.equal(failure.receipt.evidence_state, 'skill_pinned')
        assert.equal(failure.receipt.provider_calls_started, 2)
        assert.equal(failure.receipt.messages_method_invocations, 1)
        assert.equal(failure.receipt.provider_calls, null)
        assert.equal(failure.receipt.provider_request_and_usage_state, 'unknown_after_method_exception')
        assert.deepEqual(failure.receipt.provider_request_ids, ['req_skill_create', 'req_message_unknown'])
        return true
      }
    )
    assert.deepEqual(starts, ['skill_upload', 'messages'])
    assert.deepEqual(calls.map(call => call.kind), ['create_skill', 'messages'])
    const pin = JSON.parse(await readFile(environment.paths.pinFile, 'utf8'))
    assert.equal(pin.skill_id, 'skill_native_test')
    assert.equal(pin.version, 'version_native_1')
  } finally {
    await environment.cleanup()
  }
})

test('non-official SDK origin is rejected before MCP or provider work', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    const { client, calls } = createFakeClient(environment, { baseURL: 'https://example.invalid' })
    await assert.rejects(
      environment.core.run({
        roleId: 'software-engineer-api',
        client,
        emit: async () => assert.fail('no event may be emitted'),
        onProviderCallStart: async () => assert.fail('no provider call may start')
      }),
      failure => failure instanceof NativeIntegrationError && failure.code === 'sdk_contract_invalid'
    )
    assert.deepEqual(calls, [])
  } finally {
    await environment.cleanup()
  }
})

test('concurrent pin-changing runs reject the second request instead of queueing or duplicating upload', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  const upload = deferred()
  try {
    const firstClient = createFakeClient(environment, { uploadDeferred: upload })
    const first = environment.core.run({
      roleId: 'software-engineer-api',
      client: firstClient.client,
      emit: async () => true,
      onProviderCallStart: async () => {}
    })
    while (!firstClient.calls.some(call => call.kind === 'create_skill')) {
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    const secondClient = createFakeClient(environment)
    await assert.rejects(
      environment.core.run({
        roleId: 'account-executive',
        client: secondClient.client,
        emit: async () => true,
        onProviderCallStart: async () => {}
      }),
      failure => failure instanceof NativeIntegrationError && failure.code === 'native_skill_busy'
    )
    assert.deepEqual(secondClient.calls, [])

    upload.resolve({
      type: 'skill',
      id: 'skill_native_test',
      latest_version_id: 'version_native_1',
      display_name: 'Renewal Brief',
      source: { type: 'custom' }
    })
    const result = await first
    assert.equal(result.status, 'complete')
  } finally {
    upload.reject(new Error('cleanup'))
    await environment.cleanup()
  }
})

test('AbortSignal stops a hanging MCP child before any provider call starts', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    await writeFile(environment.paths.mcpServer, 'setInterval(() => {}, 1000)\n', { mode: 0o700 })
    const { client, calls } = createFakeClient(environment)
    const controller = new AbortController()
    const running = environment.core.run({
      roleId: 'software-engineer-api',
      client,
      signal: controller.signal,
      emit: async () => true,
      onProviderCallStart: async () => assert.fail('provider call must not start')
    })
    setTimeout(() => controller.abort(), 30)
    await assert.rejects(
      running,
      failure => failure instanceof NativeIntegrationError && failure.code === 'native_aborted'
    )
    assert.deepEqual(calls, [])
    await assert.rejects(lstat(environment.paths.pinFile), { code: 'ENOENT' })
  } finally {
    await environment.cleanup()
  }
})

test('a slot accepted by the start callback stays conservatively started if abort wins before the SDK method', { skip: !PR1_AVAILABLE }, async () => {
  const environment = await setup()
  try {
    const { client, calls } = createFakeClient(environment)
    const controller = new AbortController()
    await assert.rejects(
      environment.core.run({
        roleId: 'software-engineer-api',
        client,
        signal: controller.signal,
        emit: async () => true,
        onProviderCallStart: async data => {
          assert.equal(data.kind, 'skill_upload')
          controller.abort()
        }
      }),
      failure => {
        assert.ok(failure instanceof NativeIntegrationError)
        assert.equal(failure.code, 'native_aborted')
        assert.equal(failure.receipt.provider_calls_started, 1)
        return true
      }
    )
    assert.deepEqual(calls, [])
    await assert.rejects(lstat(environment.paths.pinFile), { code: 'ENOENT' })
  } finally {
    await environment.cleanup()
  }
})
