import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STREAMING_LAB_SCENARIOS,
  applyTraceStep,
  authorizeAccountTool,
  createTraceState,
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
