import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STREAMING_LAB_SCENARIOS,
  applyTraceStep,
  authorizeAccountTool,
  createTraceState,
  mountStreamingLab,
  replayScenario,
  validateToolInput
} from '../public/streaming-lab.js'

function scenario(id) {
  return STREAMING_LAB_SCENARIOS.find(item => item.id === id)
}

test('exports three static scenarios with a shared validated rejoin step', () => {
  assert.deepEqual(
    STREAMING_LAB_SCENARIOS.map(item => item.id),
    ['happy', 'unauthorized', 'interrupted']
  )
  assert.equal(scenario('interrupted').label, 'Tool confirmation timeout')
  for (const item of STREAMING_LAB_SCENARIOS) {
    assert.equal(item.catchUpStep, 10)
    assert.equal(item.steps[9].id, 'validated-tool-request')
    assert.equal(Object.isFrozen(item), true)
  }
})

test('assembles text deltas by block index and keeps ping separate', () => {
  const firstDelta = replayScenario('happy', 3)
  assert.equal(firstDelta.lastTextDelta, 'I will check the authorized ')
  assert.equal(firstDelta.accumulatedText, 'I will check the authorized ')

  const afterPing = replayScenario('happy', 4)
  assert.equal(afterPing.accumulatedText, firstDelta.accumulatedText)
  assert.equal(afterPing.heartbeatCount, 1)

  const secondDelta = replayScenario('happy', 5)
  assert.equal(
    secondDelta.accumulatedText,
    'I will check the authorized account record before drafting.'
  )
  assert.equal(secondDelta.blocks[0].index, 0)
})

test('does not parse tool JSON before content_block_stop', () => {
  const beforeStop = replayScenario('happy', 9)
  const toolBlock = beforeStop.blocks[1]

  assert.equal(toolBlock.type, 'tool_use')
  assert.equal(toolBlock.parseAttempted, false)
  assert.equal(toolBlock.parsedInput, null)
  assert.equal(
    toolBlock.partialJson,
    '{"account_id":"acct_northstar","fields":["account_owner","renewal_date","discount_percent_discussed","discount_approval","sso_entitlement","support_case","weekly_active_users","usage_cause"]}'
  )
  assert.equal(beforeStop.status, 'assembling')
})

test('parses and schema-validates the full tool input at block stop', () => {
  const atStop = replayScenario('happy', 10)
  const toolBlock = atStop.blocks[1]

  assert.equal(toolBlock.parseAttempted, true)
  assert.equal(toolBlock.schemaValid, true)
  assert.deepEqual(toolBlock.parsedInput, {
    account_id: 'acct_northstar',
    fields: [
      'account_owner',
      'renewal_date',
      'discount_percent_discussed',
      'discount_approval',
      'sso_entitlement',
      'support_case',
      'weekly_active_users',
      'usage_cause'
    ]
  })
  assert.equal(atStop.toolCall.blockIndex, 1)
  assert.equal(atStop.status, 'proposed')

  assert.deepEqual(validateToolInput('read_account_record', toolBlock.parsedInput), {
    valid: true,
    errors: []
  })
})

test('application authorization blocks an account outside the allowlist', () => {
  const denied = replayScenario('unauthorized', 13)

  assert.equal(denied.authorization.authorized, false)
  assert.equal(denied.authorization.accountId, 'acct_aurora')
  assert.equal(denied.execution.started, false)
  assert.equal(denied.status, 'partial-error')

  assert.deepEqual(
    authorizeAccountTool(
      { input: { account_id: 'acct_northstar' } },
      { authorized_account_ids: ['acct_northstar'] }
    ),
    {
      authorized: true,
      accountId: 'acct_northstar',
      reason: 'Account is present in the application allowlist.'
    }
  )
})

test('next request matches tool_result to the original tool_use ID', () => {
  const state = replayScenario('happy', 16)
  const assistantTurn = state.nextRequest.messages.at(-2)
  const resultTurn = state.nextRequest.messages.at(-1)
  const toolUse = assistantTurn.content.find(block => block.type === 'tool_use')
  const toolResult = resultTurn.content[0]

  assert.equal(state.matchingToolIds, true)
  assert.equal(toolResult.type, 'tool_result')
  assert.equal(toolResult.tool_use_id, toolUse.id)
  assert.equal(toolResult.tool_use_id, 'toolu_northstar_001')
  assert.equal(state.execution.receiptId, 'mock_receipt_001')
  assert.equal(state.execution.simulated, true)
  assert.deepEqual(JSON.parse(toolResult.content), {
    account_id: 'acct_northstar',
    account_owner: 'Maya Chen',
    renewal_date: '2027-01-31',
    discount_percent_discussed: 12,
    discount_approval: 'not_recorded',
    sso_entitlement: 'unknown',
    support_case: { id: 4821, status: 'open' },
    weekly_active_users: { current: 64, previous: 78 },
    usage_cause: 'not_established',
    source_ids: ['CRM', 'CALL', 'SUPPORT', 'USAGE']
  })
})

test('max_tokens and an SSE error after HTTP acceptance stay incomplete', () => {
  let maxTokens = createTraceState('happy')
  maxTokens = applyTraceStep(maxTokens, {
    raw: {
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens', stop_sequence: null },
      usage: { output_tokens: 600 }
    }
  })
  maxTokens = applyTraceStep(maxTokens, { raw: { type: 'message_stop' } })

  assert.equal(maxTokens.stopReason, 'max_tokens')
  assert.equal(maxTokens.status, 'partial-error')
  assert.equal(maxTokens.generationComplete, false)
  assert.equal(maxTokens.terminal, true)

  let interrupted = createTraceState('happy')
  interrupted = applyTraceStep(interrupted, {
    raw: {
      type: 'message_start',
      message: { id: 'msg_error', type: 'message', role: 'assistant', content: [] }
    }
  })
  interrupted = applyTraceStep(interrupted, {
    raw: {
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' }
    }
  })

  assert.equal(interrupted.httpAccepted, true)
  assert.equal(interrupted.status, 'partial-error')
  assert.equal(interrupted.streamComplete, false)
  assert.equal(interrupted.generationComplete, false)
  assert.equal(interrupted.error, 'Overloaded')
})

test('a started tool without backend confirmation ends outcome unknown', () => {
  const state = replayScenario('interrupted')

  assert.equal(state.execution.started, true)
  assert.equal(state.execution.confirmed, false)
  assert.equal(state.execution.timedOut, true)
  assert.equal(state.status, 'outcome-unknown')
  assert.equal(state.terminal, true)
  assert.equal(state.toolResult, null)
  assert.equal(state.nextRequest, null)
})

test('end_turn completes generation while source review completes the business task', () => {
  const beforeReview = replayScenario('happy', 22)
  const afterReview = replayScenario('happy')
  const denied = replayScenario('unauthorized')

  assert.equal(beforeReview.stopReason, 'end_turn')
  assert.equal(beforeReview.streamComplete, true)
  assert.equal(beforeReview.generationComplete, true)
  assert.equal(beforeReview.businessComplete, false)
  assert.equal(beforeReview.status, 'awaiting-confirmation')

  assert.equal(afterReview.businessComplete, true)
  assert.equal(afterReview.status, 'complete')
  assert.match(afterReview.accumulatedText, /January 31, 2027/)
  assert.match(afterReview.accumulatedText, /Maya Chen/)
  assert.match(afterReview.accumulatedText, /12 percent discount was discussed, but approval is not recorded/)
  assert.match(afterReview.accumulatedText, /SSO entitlement is unknown/)
  assert.match(afterReview.accumulatedText, /Case 4821 is open/)
  assert.match(afterReview.accumulatedText, /changed from 78 to 64/)
  assert.match(afterReview.accumulatedText, /do not establish a cause/)

  assert.equal(denied.generationComplete, true)
  assert.equal(denied.businessComplete, false)
  assert.equal(denied.status, 'partial-error')
  assert.equal(denied.execution.started, false)
})


test('an authorization denial stays partial-error through the follow-up response', () => {
  for (let count = 13; count <= scenario('unauthorized').steps.length; count += 1) {
    const state = replayScenario('unauthorized', count)
    assert.equal(state.status, 'partial-error', `after step ${count}`)
    assert.equal(state.authorization.authorized, false)
    assert.equal(state.execution.started, false)
    assert.equal(state.error, 'Account is absent from the application allowlist.')
  }
  const state = replayScenario('unauthorized', 15)
  const assistantTurn = state.nextRequest.messages.at(-2)
  const resultTurn = state.nextRequest.messages.at(-1)
  const toolUse = assistantTurn.content.find(block => block.type === 'tool_use')
  assert.equal(resultTurn.role, 'user')
  assert.equal(resultTurn.content.length, 1)
  assert.equal(resultTurn.content[0].type, 'tool_result')
  assert.equal(resultTurn.content[0].is_error, true)
  assert.equal(resultTurn.content[0].tool_use_id, toolUse.id)
  assert.equal(resultTurn.content[0].tool_use_id, 'toolu_aurora_002')
  assert.equal(state.matchingToolIds, true)
})

test('authorization requires a schema-valid matching tool request', () => {
  for (const [state, toolUseId] of [
    [replayScenario('happy', 9), 'toolu_northstar_001'],
    [replayScenario('happy', 10), 'toolu_other']
  ]) {
    const blocked = applyTraceStep(state, {
      action: { type: 'authorize_account', tool_use_id: toolUseId }
    })
    assert.equal(blocked.authorization, null)
    assert.equal(blocked.status, 'partial-error')
    assert.equal(blocked.terminal, true)
    assert.match(blocked.error, /matching validated tool request/)
  }
})

test('execution requires a passed authorization for the matching tool ID', () => {
  for (const [state, toolUseId] of [
    [replayScenario('unauthorized', 13), 'toolu_aurora_002'],
    [replayScenario('happy', 12), 'toolu_northstar_001'],
    [replayScenario('happy', 13), 'toolu_other']
  ]) {
    const blocked = applyTraceStep(state, {
      action: { type: 'execute_tool', tool_use_id: toolUseId }
    })
    assert.equal(blocked.execution.started, false)
    assert.equal(blocked.execution.toolUseId, null)
    assert.equal(blocked.status, 'partial-error')
    assert.equal(blocked.terminal, true)
    assert.match(blocked.error, /authorization did not pass/)
  }
})

test('a backend receipt requires a started matching execution', () => {
  for (const [state, toolUseId] of [
    [replayScenario('happy', 13), 'toolu_northstar_001'],
    [replayScenario('happy', 14), 'toolu_other']
  ]) {
    const blocked = applyTraceStep(state, {
      action: { type: 'backend_receipt', tool_use_id: toolUseId, receipt_id: 'invalid_receipt', content: '{}' }
    })
    assert.equal(blocked.execution.confirmed, false)
    assert.equal(blocked.execution.receiptId, null)
    assert.equal(blocked.toolResult, null)
    assert.equal(blocked.terminal, true)
    assert.match(blocked.error, /started tool execution/)
  }
})

test('a follow-up request rejects a mismatched action or tool_result ID', () => {
  const receipt = replayScenario('happy', 15)
  const mismatchedResult = structuredClone(receipt)
  mismatchedResult.toolResult.tool_use_id = 'toolu_other'
  for (const [state, toolUseId] of [
    [receipt, 'toolu_other'],
    [mismatchedResult, 'toolu_northstar_001']
  ]) {
    const blocked = applyTraceStep(state, {
      action: { type: 'build_next_request', tool_use_id: toolUseId }
    })
    assert.equal(blocked.matchingToolIds, false)
    assert.equal(blocked.nextRequest, null)
    assert.equal(blocked.terminal, true)
    assert.match(blocked.error, /does not match/)
  }
})

test('an error tool_result requires an explicit matching authorization denial', () => {
  for (const [state, toolUseId] of [
    [replayScenario('happy', 12), 'toolu_northstar_001'],
    [replayScenario('happy', 13), 'toolu_northstar_001'],
    [replayScenario('unauthorized', 13), 'toolu_other']
  ]) {
    const blocked = applyTraceStep(state, {
      action: { type: 'prepare_tool_error', tool_use_id: toolUseId, content: 'Denied' }
    })
    assert.equal(blocked.toolResult, null)
    assert.equal(blocked.terminal, true)
    assert.match(blocked.error, /matching rejected tool request/)
  }
})

test('malformed tool JSON fails before authorization or execution', () => {
  const malformed = [
    { raw: { type: 'message_start', message: { id: 'msg_bad', content: [] } } },
    { raw: { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_bad', name: 'read_account_record', input: {} } } },
    { raw: { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"account_id":' } } },
    { raw: { type: 'content_block_stop', index: 0 } }
  ].reduce(applyTraceStep, createTraceState('happy'))
  assert.equal(malformed.toolCall, null)
  assert.equal(malformed.blocks[0].parseAttempted, true)
  assert.equal(malformed.blocks[0].schemaValid, false)
  assert.equal(malformed.authorization, null)
  assert.equal(malformed.execution.started, false)
  assert.equal(malformed.status, 'partial-error')
  assert.match(malformed.error, /not complete JSON/)
})

test('validateToolInput rejects input outside the declared contract', () => {
  for (const [name, input] of [
    ['other_tool', { account_id: 'acct_northstar', fields: ['account_owner'] }],
    ['read_account_record', null],
    ['read_account_record', ['acct_northstar']],
    ['read_account_record', { account_id: 'acct_northstar' }],
    ['read_account_record', { fields: ['account_owner'] }],
    ['read_account_record', { account_id: '', fields: ['account_owner'] }],
    ['read_account_record', { account_id: 'acct_northstar', fields: [] }],
    ['read_account_record', { account_id: 'acct_northstar', fields: [1] }],
    ['read_account_record', { account_id: 'acct_northstar', fields: ['account_owner'], extra: true }]
  ]) {
    const validation = validateToolInput(name, input)
    assert.equal(validation.valid, false, JSON.stringify([name, input]))
    assert.ok(validation.errors.length > 0)
  }
})

test('positive review flags cannot erase an authorization denial', () => {
  const denied = replayScenario('unauthorized')
  const reviewed = applyTraceStep(denied, {
    action: { type: 'human_source_review', sourceCheckPassed: true, businessComplete: true }
  })
  assert.equal(reviewed.generationComplete, true)
  assert.equal(reviewed.sourceCheckPassed, true)
  assert.equal(reviewed.businessComplete, false)
  assert.equal(reviewed.status, 'partial-error')
  assert.equal(reviewed.error, denied.error)
  assert.equal(reviewed.authorization.authorized, false)
})

// This fixture checks DOM node identity and simulated focus, not browser rendering.
function createTestDocument() {
  const document = { activeElement: null }
  class Element {
    constructor(tagName, nodeType = 1) {
      this.tagName = tagName.toUpperCase()
      this.nodeType = nodeType
      this.ownerDocument = document
      this.children = []
      this.dataset = {}
      this.attributes = new Map()
      this.listeners = new Map()
      this.className = ''
      this._text = ''
      this.classList = {
        add: name => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), name])].join(' ') },
        remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' ') }
      }
    }
    contains(element) { return this === element || this.children.some(child => child.contains(element)) }
    append(...elements) {
      for (const element of elements) {
        if (element.nodeType === 11) {
          this.append(...element.children)
          element.children = []
        } else {
          element.parentNode = this
          this.children.push(element)
        }
      }
    }
    replaceChildren(...elements) {
      if (this.children.some(child => child.contains(document.activeElement))) document.activeElement = document.body
      for (const child of this.children) child.parentNode = null
      this.children = []
      this._text = ''
      this.append(...elements)
    }
    set textContent(value) { this.replaceChildren(); this._text = String(value) }
    get textContent() { return this._text + this.children.map(child => child.textContent).join('') }
    get lastElementChild() { return this.children.at(-1) || null }
    get isConnected() { return document.body.contains(this) }
    setAttribute(name, value) { this.attributes.set(name, String(value)) }
    getAttribute(name) { return this.attributes.get(name) ?? null }
    addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) || []), listener]) }
    focus() { document.activeElement = this }
    click() { if (!this.disabled) for (const listener of this.listeners.get('click') || []) listener({ target: this }) }
  }
  document.createElement = tagName => new Element(tagName)
  document.createDocumentFragment = () => new Element('fragment', 11)
  document.body = document.createElement('body')
  document.activeElement = document.body
  return document
}

function findElement(root, predicate) {
  if (predicate(root)) return root
  for (const child of root.children) {
    const result = findElement(child, predicate)
    if (result) return result
  }
  return null
}

function mountTestLab(saved) {
  const document = createTestDocument()
  const host = document.createElement('section')
  document.body.append(host)
  const mounted = mountStreamingLab(host, { saved })
  return { document, host, mounted }
}

test('scenario and role selection preserve button identity and update pressed states', () => {
  const { document, host } = mountTestLab()
  const scenarioButtons = findElement(host, element => element.getAttribute('aria-label') === 'Prepared trace')
  const roleButtons = findElement(host, element => element.getAttribute('aria-label') === 'Role view')
  const originalScenarios = [...scenarioButtons.children]
  const originalRoles = [...roleButtons.children]
  const deniedButton = originalScenarios[1]
  deniedButton.focus()
  deniedButton.click()
  assert.equal(document.activeElement, deniedButton)
  assert.equal(deniedButton.isConnected, true)
  assert.deepEqual(scenarioButtons.children, originalScenarios)
  assert.deepEqual(roleButtons.children, originalRoles)
  assert.equal(deniedButton.dataset.id, 'unauthorized')
  assert.equal(deniedButton.getAttribute('aria-pressed'), 'true')
  assert.equal(originalScenarios[0].getAttribute('aria-pressed'), 'false')

  const roleButton = originalRoles[1]
  roleButton.focus()
  roleButton.click()
  assert.equal(document.activeElement, roleButton)
  assert.equal(roleButton.isConnected, true)
  assert.deepEqual(scenarioButtons.children, originalScenarios)
  assert.deepEqual(roleButtons.children, originalRoles)
  assert.equal(roleButton.dataset.id, 'sales')
  assert.equal(roleButton.getAttribute('aria-pressed'), 'true')
  assert.equal(originalRoles[0].getAttribute('aria-pressed'), 'false')
})

test('request inspection distinguishes the initial request from a matching denial follow-up', () => {
  const initial = mountTestLab()
  const initialPanel = findElement(initial.host, element => element.tagName === 'DETAILS' && element.children[0]?.textContent === 'Inspect request context and conversation history')
  assert.equal(initialPanel.children[1].textContent, 'Initial Messages API request')
  assert.deepEqual(JSON.parse(initialPanel.children[2].textContent), scenario('happy').initialRequest)

  const { host } = mountTestLab({ scenarioId: 'unauthorized', stepByScenario: { unauthorized: 14 } })
  const panel = findElement(host, element => element.tagName === 'DETAILS' && element.children[0]?.textContent === 'Inspect request context and conversation history')
  assert.equal(panel.children[1].textContent, 'Follow-up Messages API request with tool_result')
  const request = JSON.parse(panel.children[2].textContent)
  const toolUse = request.messages.at(-2).content.find(block => block.type === 'tool_use')
  const toolResult = request.messages.at(-1).content[0]
  assert.equal(toolResult.is_error, true)
  assert.equal(toolResult.tool_use_id, toolUse.id)

  const stateList = findElement(host, element => element.tagName === 'DL')
  const stateRows = Object.fromEntries(stateList.children.reduce((rows, element, index, children) => {
    if (element.tagName === 'DT') rows.push([element.textContent, children[index + 1].textContent])
    return rows
  }, []))
  assert.match(stateRows.Authorization, /^Denied: acct_aurora\./)
  assert.equal(stateRows['Application error'], 'Account is absent from the application allowlist.')
})
