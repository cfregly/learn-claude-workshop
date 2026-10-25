const TOOL_NAME = 'read_account_record'

const TOOL_SCHEMA = deepFreeze({
  type: 'object',
  properties: {
    account_id: { type: 'string' },
    fields: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['account_id', 'fields'],
  additionalProperties: false
})

const BASE_REQUEST = deepFreeze({
  model: 'claude-opus-5-5',
  max_tokens: 600,
  stream: true,
  system: 'Use only records returned by the account tool. State when approval evidence is missing.',
  tools: [{
    name: TOOL_NAME,
    description: 'Read selected fields from one account record after the application authorizes access.',
    input_schema: TOOL_SCHEMA
  }],
  messages: [{
    role: 'user',
    content: [{
      type: 'text',
      text: 'Prepare a source-linked renewal brief for Northstar Freight. Include the owner, renewal date, discount status, SSO status, open support case, and weekly active users. Preserve unknowns and do not infer a cause from the usage change.'
    }]
  }]
})

const ROLE_VIEWS = Object.freeze({
  engineer: Object.freeze({
    id: 'engineer',
    label: 'Engineer',
    question: 'Which event or application check makes the next transition safe?',
    evidence: 'Bring back the block index, stop reason, tool ID, or authorization result that supports your answer.'
  }),
  sales: Object.freeze({
    id: 'sales',
    label: 'Sales',
    question: 'What can the account team use now, and which customer claim still needs a source?',
    evidence: 'Bring back the exact account field or approval record that supports the claim.'
  }),
  product: Object.freeze({
    id: 'product',
    label: 'Product',
    question: 'What state should the product show now, and what evidence allows the next state?',
    evidence: 'Bring back the event, receipt, or human review that changes the visible state.'
  })
})

export const STREAMING_LAB_ROLES = ROLE_VIEWS

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value)) deepFreeze(nested)
  return value
}

function eventStep(id, title, raw, explanation, businessValue, reference) {
  return {
    id,
    title,
    kind: 'protocol',
    raw,
    familiarTask: 'Follow one delivery receipt from the first scan through final confirmation.',
    explanation,
    businessValue,
    reference
  }
}

function actionStep(id, title, action, explanation, businessValue, reference) {
  return {
    id,
    title,
    kind: 'application',
    action,
    familiarTask: 'Follow one delivery receipt from the first scan through final confirmation.',
    explanation,
    businessValue,
    reference
  }
}

function messageStart(messageId) {
  return {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      model: BASE_REQUEST.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 128, output_tokens: 1 }
    }
  }
}

function commonToolPrelude({ messageId, toolUseId, accountId }) {
  return [
    eventStep(
      'message-start',
      'Response starts',
      messageStart(messageId),
      'The server accepted the streaming request and started a typed Message with an empty content array.',
      'The application can show that generation started. It cannot claim that a customer task finished.',
      'HTTP success can begin an SSE stream. Later events can still report an error.'
    ),
    eventStep(
      'text-block-start',
      'Text block opens at index 0',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      'Each content block has an index that matches its position in the final Message content array.',
      'Keeping the index prevents text and tool input from being joined into the wrong block.',
      'Index 0 is a text block. The later tool block will use index 1.'
    ),
    eventStep(
      'text-delta-one',
      'First text delta arrives',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'I will check the authorized ' } },
      'A text delta is only the new fragment. The application appends it to the text already stored for block 0.',
      'Learners see useful text quickly without treating a fragment as the final answer.',
      'The raw delta is shorter than the accumulated text that the application will eventually show.'
    ),
    eventStep(
      'ping',
      'Ping heartbeat arrives',
      { type: 'ping' },
      'A ping keeps the stream active. It adds no model text and proves no tool ran.',
      'The interface can stay connected without inventing a percent complete.',
      'Count the heartbeat separately. Do not append it to the response.'
    ),
    eventStep(
      'text-delta-two',
      'Second text delta completes the sentence',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'account record before drafting.' } },
      'The application appends this fragment. The full sentence is model-authored narration, not execution evidence.',
      'A customer sees clear status language while the product keeps proof boundaries honest.',
      'The cumulative snapshot now joins both text deltas in order.'
    ),
    eventStep(
      'text-block-stop',
      'Text block closes',
      { type: 'content_block_stop', index: 0 },
      'The text block is complete. The Message stream can still add another content block.',
      'The application can preserve readable text while it waits for the next typed block.',
      'Closing block 0 does not close the whole Message.'
    ),
    eventStep(
      'tool-block-start',
      'Tool block opens at index 1',
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: toolUseId, name: TOOL_NAME, input: {} }
      },
      'The tool call has its own content block, ID, name, and initially empty input object.',
      'The application can route the completed call to the right client tool without confusing it with text.',
      `Keep ${toolUseId} so the later tool_result can refer to the same call.`
    ),
    eventStep(
      'tool-json-one',
      'First tool JSON fragment arrives',
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: `{"account_id":"${accountId}",` }
      },
      'An input_json_delta carries a partial JSON string. Store the bytes and do not parse yet.',
      'Waiting avoids dispatching a malformed or incomplete tool request.',
      'The buffer is visible for diagnosis. Parsed input remains empty.'
    ),
    eventStep(
      'tool-json-two',
      'Second tool JSON fragment arrives',
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '"fields":["account_owner","renewal_date","discount_percent_discussed","discount_approval","sso_entitlement","support_case","weekly_active_users","usage_cause"]}' }
      },
      'The second fragment completes the string, but the handler still waits for content_block_stop.',
      'The same rule works when networks split JSON at a different byte boundary.',
      'A complete-looking buffer is not the protocol signal to execute.'
    ),
    eventStep(
      'validated-tool-request',
      'Validated tool request',
      { type: 'content_block_stop', index: 1 },
      'At block stop, join the full buffer, parse JSON once, and validate the result against the tool schema.',
      'Schema validation prevents malformed inputs from reaching account systems.',
      'Step 10 is the common rejoin point. The parsed object needs account_id and a string array named fields.'
    )
  ]
}

function finalResponseSteps({ prefix, messageId, text, reviewAction }) {
  return [
    eventStep(
      `${prefix}-message-start`,
      'Next model response starts',
      messageStart(messageId),
      'The tool_result is part of the conversation history for a new model request.',
      'The final draft can use the returned record while preserving the tool trail.',
      'This is a new stream with a new Message ID.'
    ),
    eventStep(
      `${prefix}-text-start`,
      'Final text block opens',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      'The next Message starts a new content array at index 0.',
      'The application can render the new answer separately from the earlier narration.',
      'Content block indices apply within one Message.'
    ),
    eventStep(
      `${prefix}-text-delta`,
      'Final answer text arrives',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
      'This text is a model-authored draft. It is not a backend receipt or a human source check.',
      'The wording becomes useful only when the required customer facts match approved sources.',
      'Read the claim, then identify the source needed to accept it.'
    ),
    eventStep(
      `${prefix}-text-stop`,
      'Final text block closes',
      { type: 'content_block_stop', index: 0 },
      'The final text block is assembled, but the stream still needs a top-level stop reason and message_stop.',
      'The interface avoids showing a complete state too early.',
      'Block completion and Message completion are separate signals.'
    ),
    eventStep(
      `${prefix}-end-turn`,
      'Stop reason is end_turn',
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 64 }
      },
      'end_turn says the model completed this response naturally. It does not approve a discount or confirm a client tool side effect.',
      'The product can distinguish generation complete from business complete.',
      'Wait for message_stop, then check facts against their sources.'
    ),
    eventStep(
      `${prefix}-message-stop`,
      'Stream completes',
      { type: 'message_stop' },
      'message_stop closes the SSE stream. The application now has a complete model response.',
      'The response can move to human review with no invented runtime percentage.',
      'Generation is complete. Business review is still pending.'
    ),
    actionStep(
      `${prefix}-source-review`,
      reviewAction.businessComplete ? 'Source review completes the task' : 'Source review keeps the task incomplete',
      reviewAction,
      'A person compares each required claim with the approved account source.',
      'The final state reflects usable customer evidence, not just fluent text.',
      reviewAction.businessComplete
        ? 'The owner and renewal date match CRM. The discount and SSO stay unresolved. Case 4821 and the 78 to 64 usage change match their sources, with no cause invented.'
        : 'The requested account work remains incomplete even though the final model response ended normally.'
    )
  ]
}

const happyToolId = 'toolu_northstar_001'
const happyPrelude = commonToolPrelude({
  messageId: 'msg_northstar_001',
  toolUseId: happyToolId,
  accountId: 'acct_northstar'
})

const happyScenario = {
  id: 'happy',
  label: 'Happy tool cycle',
  summary: 'Assemble a client tool call, authorize it, record a mocked backend receipt, return a matching tool_result, then check the final draft against its source.',
  initialRequest: BASE_REQUEST,
  applicationContext: {
    actor_id: 'employee_42',
    authorized_account_ids: ['acct_northstar'],
    source_record: 'synthetic-crm/acct_northstar',
    simulation: true
  },
  catchUpStep: 10,
  steps: [
    ...happyPrelude,
    eventStep(
      'tool-stop-reason',
      'Stop reason requests tool use',
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { output_tokens: 42 }
      },
      'The top-level stop reason says the application must handle a client tool call before asking Claude to continue.',
      'The application can route the request through its own authorization and execution policy.',
      'tool_use is a handoff to application code. It is not proof that the tool ran.'
    ),
    eventStep(
      'first-message-stop',
      'First stream completes',
      { type: 'message_stop' },
      'The first Message stream is complete and its tool request can be handled.',
      'The product has a stable assistant turn to add to conversation history.',
      'The tool cycle continues after this stream closes.'
    ),
    actionStep(
      'authorize-account',
      'Application authorizes the account',
      { type: 'authorize_account', tool_use_id: happyToolId },
      'The application checks the parsed account_id against the signed-in employee allowlist. API credentials do not replace this check.',
      'Northstar data stays inside the account boundary before any client tool runs.',
      'acct_northstar is in the prepared allowlist, so execution may proceed.'
    ),
    actionStep(
      'execute-tool',
      'Client tool starts',
      { type: 'execute_tool', tool_use_id: happyToolId },
      'The application dispatches only a validated and authorized call.',
      'The running state is based on application execution, not on a sentence from the model.',
      'This teaching trace marks a mocked read as started. It performs no real account action.'
    ),
    actionStep(
      'backend-receipt',
      'Mock backend receipt confirms the result',
      {
        type: 'backend_receipt',
        tool_use_id: happyToolId,
        content: '{"account_id":"acct_northstar","account_owner":"Maya Chen","renewal_date":"2027-01-31","discount_percent_discussed":12,"discount_approval":"not_recorded","sso_entitlement":"unknown","support_case":{"id":4821,"status":"open"},"weekly_active_users":{"current":64,"previous":78},"usage_cause":"not_established","source_ids":["CRM","CALL","SUPPORT","USAGE"]}',
        receipt_id: 'mock_receipt_001',
        simulated: true
      },
      'A prepared backend receipt confirms that the mocked client tool returned a result. This is an application record, not a Claude streaming event.',
      'The interface can move from running to awaiting confirmation with named evidence.',
      'The simulation records mock_receipt_001. No real CRM read or write occurs.'
    ),
    actionStep(
      'next-model-request',
      'Matching tool_result enters the next request',
      { type: 'build_next_request', tool_use_id: happyToolId },
      'The next user message starts with a tool_result whose tool_use_id matches the earlier tool_use block.',
      'Claude can continue from a coherent conversation history without losing the audit trail.',
      'The reducer preserves the original user turn, assistant content blocks, and matching tool result.'
    ),
    ...finalResponseSteps({
      prefix: 'happy-final',
      messageId: 'msg_northstar_002',
      text: 'Northstar Freight renews on January 31, 2027, and Maya Chen owns the account [CRM]. A 12 percent discount was discussed, but approval is not recorded [CALL]. SSO entitlement is unknown [CALL]. Case 4821 is open [SUPPORT]. Weekly active users changed from 78 to 64, and the records do not establish a cause [USAGE].',
      reviewAction: {
        type: 'human_source_review',
        source: 'synthetic-crm/acct_northstar',
        sourceCheckPassed: true,
        businessComplete: true
      }
    })
  ]
}

const deniedToolId = 'toolu_aurora_002'
const deniedScenario = {
  id: 'unauthorized',
  label: 'Unauthorized record',
  summary: 'A well-formed tool request asks for an account outside the employee allowlist. The application rejects it before execution and returns a matching error result.',
  initialRequest: BASE_REQUEST,
  applicationContext: {
    actor_id: 'employee_42',
    authorized_account_ids: ['acct_northstar'],
    source_record: null,
    simulation: true
  },
  catchUpStep: 10,
  steps: [
    ...commonToolPrelude({
      messageId: 'msg_aurora_001',
      toolUseId: deniedToolId,
      accountId: 'acct_aurora'
    }),
    eventStep(
      'denied-tool-stop-reason',
      'Stop reason requests tool use',
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { output_tokens: 40 }
      },
      'The model requested a client tool, but application authorization still decides whether it can run.',
      'The account boundary holds even when the protocol shape is valid.',
      'A valid tool schema does not grant access to acct_aurora.'
    ),
    eventStep(
      'denied-message-stop',
      'First stream completes',
      { type: 'message_stop' },
      'The response stream closes with a complete tool request.',
      'The application can make one authorization decision from stable input.',
      'Stream completion does not change the employee allowlist.'
    ),
    actionStep(
      'deny-account',
      'Application rejects the account',
      { type: 'authorize_account', tool_use_id: deniedToolId },
      'acct_aurora is absent from the employee allowlist, so the application refuses execution.',
      'No unauthorized customer record reaches the model or the employee.',
      'The trace records a denial. The execution.started flag remains false.'
    ),
    actionStep(
      'denied-tool-result',
      'Matching error result is prepared',
      {
        type: 'prepare_tool_error',
        tool_use_id: deniedToolId,
        content: 'AuthorizationError: account is not available to this employee'
      },
      'The application can continue the conversation with is_error true and the same tool ID.',
      'Claude can explain the safe failure without seeing the protected record.',
      'This is an application error result. It is not evidence of a tool execution.'
    ),
    actionStep(
      'denied-next-request',
      'Error tool_result enters the next request',
      { type: 'build_next_request', tool_use_id: deniedToolId },
      'The error result immediately follows the assistant tool_use turn in conversation history.',
      'The next response can tell the learner what failed while preserving the authorization boundary.',
      'The tool_result ID must still match the rejected tool call.'
    ),
    ...finalResponseSteps({
      prefix: 'denied-final',
      messageId: 'msg_aurora_002',
      text: 'I cannot read that account because the application did not authorize access. Ask the account owner to confirm the correct record.',
      reviewAction: {
        type: 'human_source_review',
        source: null,
        sourceCheckPassed: false,
        businessComplete: false
      }
    })
  ]
}

const interruptedToolId = 'toolu_northstar_003'
const interruptedScenario = {
  id: 'interrupted',
  label: 'Timeout or interrupted stream',
  summary: 'A client tool starts after validation and authorization, then the application loses confirmation. The only truthful terminal state is outcome unknown.',
  initialRequest: BASE_REQUEST,
  applicationContext: {
    actor_id: 'employee_42',
    authorized_account_ids: ['acct_northstar'],
    source_record: 'synthetic-crm/acct_northstar',
    simulation: true
  },
  catchUpStep: 10,
  steps: [
    ...commonToolPrelude({
      messageId: 'msg_timeout_001',
      toolUseId: interruptedToolId,
      accountId: 'acct_northstar'
    }),
    eventStep(
      'timeout-tool-stop-reason',
      'Stop reason requests tool use',
      {
        type: 'message_delta',
        delta: { stop_reason: 'tool_use', stop_sequence: null },
        usage: { output_tokens: 41 }
      },
      'The first model response hands the validated client tool call to the application.',
      'The application can now apply its own authorization and timeout policy.',
      'No execution claim is justified yet.'
    ),
    eventStep(
      'timeout-message-stop',
      'First stream completes',
      { type: 'message_stop' },
      'The Message stream closes normally at the tool handoff.',
      'A closed stream gives stable tool input, but says nothing about the later client tool outcome.',
      'This message_stop does not confirm a backend result.'
    ),
    actionStep(
      'timeout-authorize',
      'Application authorizes the account',
      { type: 'authorize_account', tool_use_id: interruptedToolId },
      'The signed-in employee may access acct_northstar.',
      'The product can proceed without weakening the account boundary.',
      'Authorization is necessary. It is not execution proof.'
    ),
    actionStep(
      'timeout-execute',
      'Client tool starts',
      { type: 'execute_tool', tool_use_id: interruptedToolId },
      'The prepared trace marks the mocked client tool as started.',
      'The running state is based on an application dispatch record.',
      'No real tool runs in this browser.'
    ),
    actionStep(
      'timeout-without-receipt',
      'Confirmation times out',
      { type: 'execution_timeout', tool_use_id: interruptedToolId },
      'The tool started, but no backend receipt confirmed success or failure. Do not retry a side effect blindly.',
      'Outcome unknown tells an operator to reconcile the backend before any retry.',
      'The trace is terminal and incomplete. No tool_result or next model request is fabricated.'
    )
  ]
}

export const STREAMING_LAB_SCENARIOS = deepFreeze([
  happyScenario,
  deniedScenario,
  interruptedScenario
])

export const STREAMING_TERMINAL_EXAMPLES = deepFreeze([
  {
    label: 'max_tokens',
    raw: {
      type: 'message_delta',
      delta: { stop_reason: 'max_tokens', stop_sequence: null },
      usage: { output_tokens: 600 }
    },
    state: 'partial-error',
    explanation: 'The response hit its output limit. Preserve the readable text, mark it incomplete, and do not infer a percent from token counts.'
  },
  {
    label: 'Error after HTTP 200',
    raw: {
      type: 'error',
      error: { type: 'overloaded_error', message: 'Overloaded' }
    },
    state: 'partial-error',
    explanation: 'An SSE stream can emit an error after the initial HTTP response. Preserve partial output and show that the stream did not complete.'
  },
  {
    label: 'Tool started without confirmation',
    action: { type: 'execution_timeout' },
    state: 'outcome-unknown',
    explanation: 'Reconcile the client tool backend before retrying because the application did not receive a final receipt.'
  }
])

export const STREAMING_PROGRESS_REFERENCE = deepFreeze({
  request: {
    headers: {
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'thinking-display-updates-2026-08-18',
      'content-type': 'application/json'
    },
    body: {
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      stream: true,
      thinking: { type: 'adaptive', display: 'updates' },
      messages: [{ role: 'user', content: 'Review the prepared Northstar renewal record with the available tools.' }]
    }
  },
  progressBlock: {
    type: 'thinking',
    thinking: 'The account record preserves the unresolved discount and SSO fields. I will check support and usage next.',
    signature: 'opaque_example_signature_not_live_or_replayable'
  },
  streamingDelta: {
    type: 'content_block_delta',
    index: 2,
    delta: {
      type: 'thinking_delta',
      thinking: 'The account record preserves the unresolved discount and SSO fields. I will check support and usage next.'
    }
  }
})

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function scenarioFor(value) {
  if (value && typeof value === 'object') return value
  return STREAMING_LAB_SCENARIOS.find(item => item.id === value) || STREAMING_LAB_SCENARIOS[0]
}

function orderedBlocks(state) {
  return Object.values(state.blocks)
    .sort((left, right) => left.index - right.index)
    .map(block => {
      if (block.type === 'text') return { type: 'text', text: block.text }
      return {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.parsedInput
      }
    })
}

export function validateToolInput(name, input) {
  const errors = []
  if (name !== TOOL_NAME) errors.push(`Unknown client tool: ${name}`)
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    errors.push('Tool input must be an object')
    return { valid: false, errors }
  }
  const keys = Object.keys(input)
  for (const required of TOOL_SCHEMA.required) {
    if (!keys.includes(required)) errors.push(`Missing required field: ${required}`)
  }
  if (typeof input.account_id !== 'string' || input.account_id.length === 0) {
    errors.push('account_id must be a non-empty string')
  }
  if (!Array.isArray(input.fields) || input.fields.length === 0 || input.fields.some(field => typeof field !== 'string')) {
    errors.push('fields must be a non-empty array of strings')
  }
  for (const key of keys) {
    if (!Object.hasOwn(TOOL_SCHEMA.properties, key)) errors.push(`Unexpected field: ${key}`)
  }
  return { valid: errors.length === 0, errors }
}

export function authorizeAccountTool(toolCall, applicationContext) {
  const accountId = toolCall?.input?.account_id
  const allowed = applicationContext?.authorized_account_ids || []
  const authorized = typeof accountId === 'string' && allowed.includes(accountId)
  return {
    authorized,
    accountId: accountId || null,
    reason: authorized
      ? 'Account is present in the application allowlist.'
      : 'Account is absent from the application allowlist.'
  }
}

export function createTraceState(scenarioValue = STREAMING_LAB_SCENARIOS[0]) {
  const scenario = scenarioFor(scenarioValue)
  return {
    scenarioId: scenario.id,
    initialRequest: clone(scenario.initialRequest),
    applicationContext: clone(scenario.applicationContext),
    completedSteps: 0,
    rawEvent: null,
    currentMessage: null,
    blocks: {},
    completedMessages: [],
    accumulatedText: '',
    lastTextDelta: '',
    heartbeatCount: 0,
    toolCall: null,
    authorization: null,
    execution: {
      started: false,
      confirmed: false,
      timedOut: false,
      toolUseId: null,
      receiptId: null,
      simulated: true
    },
    toolResult: null,
    nextRequest: null,
    matchingToolIds: null,
    stopReason: null,
    httpAccepted: false,
    streamComplete: false,
    generationComplete: false,
    businessComplete: false,
    sourceCheckPassed: false,
    terminal: false,
    status: 'proposed',
    error: null,
    notices: []
  }
}

function setProtocolError(state, message) {
  state.error = message
  state.status = 'partial-error'
  state.terminal = true
  state.generationComplete = false
}

function applyRawEvent(state, raw) {
  state.rawEvent = clone(raw)
  switch (raw.type) {
    case 'message_start': {
      if (state.currentMessage) state.completedMessages.push(state.currentMessage)
      state.currentMessage = clone(raw.message)
      state.blocks = {}
      state.accumulatedText = ''
      state.lastTextDelta = ''
      state.stopReason = null
      state.streamComplete = false
      state.httpAccepted = true
      if (!state.error) state.status = 'running'
      break
    }
    case 'content_block_start': {
      const block = raw.content_block || {}
      if (block.type === 'text') {
        state.blocks[raw.index] = { index: raw.index, type: 'text', text: block.text || '', stopped: false }
      } else if (block.type === 'tool_use') {
        state.blocks[raw.index] = {
          index: raw.index,
          type: 'tool_use',
          id: block.id,
          name: block.name,
          partialJson: '',
          parsedInput: null,
          parseAttempted: false,
          schemaValid: null,
          validationErrors: [],
          stopped: false
        }
      } else {
        state.blocks[raw.index] = { index: raw.index, type: block.type || 'unknown', stopped: false }
      }
      state.status = block.type === 'tool_use' ? 'assembling' : 'running'
      break
    }
    case 'content_block_delta': {
      const block = state.blocks[raw.index]
      if (!block) {
        setProtocolError(state, `Delta arrived before block start at index ${raw.index}.`)
        break
      }
      if (raw.delta?.type === 'text_delta') {
        if (block.type !== 'text') {
          setProtocolError(state, `Text delta does not match block ${raw.index}.`)
          break
        }
        block.text += raw.delta.text || ''
        state.lastTextDelta = raw.delta.text || ''
        state.accumulatedText = Object.values(state.blocks)
          .filter(item => item.type === 'text')
          .sort((left, right) => left.index - right.index)
          .map(item => item.text)
          .join('')
        state.status = 'running'
      } else if (raw.delta?.type === 'input_json_delta') {
        if (block.type !== 'tool_use') {
          setProtocolError(state, `Tool input delta does not match block ${raw.index}.`)
          break
        }
        block.partialJson += raw.delta.partial_json || ''
        block.parseAttempted = false
        block.parsedInput = null
        block.schemaValid = null
        state.status = 'assembling'
      } else {
        state.notices.push(`Unknown delta type ignored: ${raw.delta?.type || 'missing'}`)
      }
      break
    }
    case 'content_block_stop': {
      const block = state.blocks[raw.index]
      if (!block) {
        setProtocolError(state, `Block stop arrived before block start at index ${raw.index}.`)
        break
      }
      block.stopped = true
      if (block.type === 'tool_use') {
        block.parseAttempted = true
        try {
          block.parsedInput = JSON.parse(block.partialJson)
        } catch (error) {
          block.validationErrors = [`Tool input is not complete JSON: ${error.message}`]
          block.schemaValid = false
          setProtocolError(state, block.validationErrors[0])
          break
        }
        const validation = validateToolInput(block.name, block.parsedInput)
        block.schemaValid = validation.valid
        block.validationErrors = validation.errors
        state.toolCall = {
          id: block.id,
          name: block.name,
          input: clone(block.parsedInput),
          blockIndex: block.index,
          schemaValid: validation.valid
        }
        if (!validation.valid) {
          setProtocolError(state, validation.errors.join(' '))
          break
        }
        state.status = 'proposed'
      }
      break
    }
    case 'message_delta': {
      if (raw.delta && Object.hasOwn(raw.delta, 'stop_reason')) state.stopReason = raw.delta.stop_reason
      if (state.currentMessage) {
        state.currentMessage.stop_reason = state.stopReason
        state.currentMessage.content = orderedBlocks(state)
        if (raw.usage) state.currentMessage.usage = clone(raw.usage)
      }
      if (state.stopReason === 'max_tokens' || state.stopReason === 'model_context_window_exceeded') {
        state.status = 'partial-error'
        state.terminal = true
        state.generationComplete = false
        state.error = `Response stopped with ${state.stopReason}.`
      } else if (state.stopReason === 'tool_use') {
        state.status = state.error ? 'partial-error' : 'proposed'
      } else if (state.stopReason === 'end_turn') {
        state.status = state.error ? 'partial-error' : 'awaiting-confirmation'
      }
      break
    }
    case 'message_stop': {
      state.streamComplete = true
      if (state.currentMessage) {
        state.currentMessage.content = orderedBlocks(state)
        state.completedMessages.push(clone(state.currentMessage))
        state.currentMessage = null
      }
      if (state.stopReason === 'end_turn') {
        state.generationComplete = true
        state.status = state.error ? 'partial-error' : 'awaiting-confirmation'
      } else if (state.stopReason === 'max_tokens' || state.stopReason === 'model_context_window_exceeded') {
        state.status = 'partial-error'
        state.terminal = true
      }
      break
    }
    case 'ping':
      state.heartbeatCount += 1
      break
    case 'error':
      state.error = raw.error?.message || raw.error?.type || 'Streaming error'
      state.status = 'partial-error'
      state.terminal = true
      state.streamComplete = false
      state.generationComplete = false
      break
    default:
      state.notices.push(`Unknown event type ignored: ${raw.type || 'missing'}`)
  }
}

function findToolBlock(state) {
  return Object.values(state.blocks).find(block => block.type === 'tool_use') || null
}

function applyAction(state, action) {
  state.rawEvent = clone(action)
  const toolBlock = findToolBlock(state)
  switch (action.type) {
    case 'authorize_account': {
      if (!state.toolCall || state.toolCall.id !== action.tool_use_id || !state.toolCall.schemaValid) {
        setProtocolError(state, 'Authorization requires the matching validated tool request.')
        break
      }
      state.authorization = authorizeAccountTool(state.toolCall, state.applicationContext)
      state.status = state.authorization.authorized ? 'proposed' : 'partial-error'
      if (!state.authorization.authorized) state.error = state.authorization.reason
      break
    }
    case 'execute_tool': {
      if (!state.authorization?.authorized || state.toolCall?.id !== action.tool_use_id) {
        setProtocolError(state, 'Tool execution was blocked because authorization did not pass.')
        break
      }
      state.execution.started = true
      state.execution.toolUseId = action.tool_use_id
      state.status = 'running'
      break
    }
    case 'backend_receipt': {
      if (!state.execution.started || state.execution.toolUseId !== action.tool_use_id) {
        setProtocolError(state, 'A backend receipt must match a started tool execution.')
        break
      }
      state.execution.confirmed = true
      state.execution.receiptId = action.receipt_id || null
      state.execution.simulated = action.simulated === true
      state.toolResult = {
        type: 'tool_result',
        tool_use_id: action.tool_use_id,
        content: action.content
      }
      state.status = 'awaiting-confirmation'
      break
    }
    case 'prepare_tool_error': {
      if (!state.toolCall || state.toolCall.id !== action.tool_use_id || state.authorization?.authorized !== false) {
        setProtocolError(state, 'An authorization error result requires the matching rejected tool request.')
        break
      }
      state.toolResult = {
        type: 'tool_result',
        tool_use_id: action.tool_use_id,
        content: action.content,
        is_error: true
      }
      state.status = 'partial-error'
      break
    }
    case 'build_next_request': {
      const callId = state.toolCall?.id
      const resultId = state.toolResult?.tool_use_id
      state.matchingToolIds = Boolean(callId && resultId && callId === resultId && callId === action.tool_use_id)
      if (!state.matchingToolIds) {
        setProtocolError(state, 'The tool_result ID does not match the tool_use ID.')
        break
      }
      const assistantContent = state.completedMessages.at(-1)?.content || orderedBlocks(state)
      state.nextRequest = {
        ...clone(state.initialRequest),
        messages: [
          ...clone(state.initialRequest.messages),
          { role: 'assistant', content: clone(assistantContent) },
          { role: 'user', content: [clone(state.toolResult)] }
        ]
      }
      state.status = state.error ? 'partial-error' : 'awaiting-confirmation'
      break
    }
    case 'execution_timeout': {
      if (!state.execution.started || state.execution.confirmed || state.execution.toolUseId !== action.tool_use_id) {
        setProtocolError(state, 'The timeout example requires a started, unconfirmed matching tool call.')
        break
      }
      state.execution.timedOut = true
      state.status = 'outcome-unknown'
      state.terminal = true
      state.generationComplete = false
      state.error = 'Tool started, but no backend confirmation was received.'
      break
    }
    case 'human_source_review': {
      state.sourceCheckPassed = action.sourceCheckPassed === true
      state.businessComplete = Boolean(
        action.businessComplete &&
        state.sourceCheckPassed &&
        state.generationComplete
      )
      state.terminal = true
      if (state.businessComplete) {
        state.status = 'complete'
        state.error = null
      } else {
        state.status = 'partial-error'
        if (!state.error) state.error = 'The requested business task is incomplete after source review.'
      }
      break
    }
    default:
      state.notices.push(`Unknown application action ignored: ${action.type || 'missing'}`)
  }
  if (toolBlock && state.toolCall && toolBlock.id === state.toolCall.id) {
    toolBlock.authorization = state.authorization ? clone(state.authorization) : null
  }
}

export function applyTraceStep(previousState, step) {
  const state = clone(previousState)
  if (step?.raw) applyRawEvent(state, step.raw)
  else if (step?.action) applyAction(state, step.action)
  else state.notices.push('Trace step has no protocol event or application action.')
  state.completedSteps += 1
  return state
}

export function replayScenario(scenarioValue, throughStep) {
  const scenario = scenarioFor(scenarioValue)
  const count = Math.max(0, Math.min(
    Number.isFinite(throughStep) ? Math.trunc(throughStep) : scenario.steps.length,
    scenario.steps.length
  ))
  let state = createTraceState(scenario)
  for (let index = 0; index < count; index += 1) state = applyTraceStep(state, scenario.steps[index])
  return state
}

function node(documentRef, tag, text = '', className = '') {
  const result = documentRef.createElement(tag)
  result.textContent = text
  if (className) result.className = className
  return result
}

function definition(documentRef, label, value) {
  const fragment = documentRef.createDocumentFragment()
  fragment.append(node(documentRef, 'dt', label), node(documentRef, 'dd', value))
  return fragment
}

function stringify(value) {
  return JSON.stringify(value, null, 2)
}

function savedPredictions(saved) {
  if (!saved || typeof saved !== 'object') return {}
  return saved.predictions && typeof saved.predictions === 'object' ? { ...saved.predictions } : {}
}

/**
 * Mount the prepared streaming lab. This module makes no network requests.
 *
 * saved: { scenarioId, roleId, stepByScenario, predictions, revealed }
 * onSave receives the complete serializable object whenever learner state changes.
 */
export function mountStreamingLab(host, { onSave, saved } = {}) {
  if (!host) return null
  const documentRef = host.ownerDocument || document
  const knownScenario = STREAMING_LAB_SCENARIOS.some(item => item.id === saved?.scenarioId)
  const knownRole = Boolean(ROLE_VIEWS[saved?.roleId])
  let scenarioId = knownScenario ? saved.scenarioId : STREAMING_LAB_SCENARIOS[0].id
  let roleId = knownRole ? saved.roleId : 'engineer'
  const stepByScenario = { ...(saved?.stepByScenario || {}) }
  const predictions = savedPredictions(saved)
  const revealed = { ...(saved?.revealed || {}) }

  host.replaceChildren()
  host.classList.add('streaming-lab')

  const heading = node(documentRef, 'h2', 'Trace a Claude streaming tool cycle')
  const intro = node(
    documentRef,
    'p',
    'Prepared simulation using synthetic Northstar records. It makes no network request and performs no account action. The live API example elsewhere is separate.'
  )
  const scenarioHeading = node(documentRef, 'h3', 'Choose a prepared trace')
  const scenarioButtons = node(documentRef, 'div', '', 'streaming-lab-choices')
  scenarioButtons.setAttribute('role', 'group')
  scenarioButtons.setAttribute('aria-label', 'Prepared trace')
  const roleHeading = node(documentRef, 'h3', 'Choose a role view')
  let renderedRole=''
  const roleButtons = node(documentRef, 'div', '', 'streaming-lab-choices')
  const roleGoal=node(documentRef,'p','','lesson-outcome')
  roleButtons.setAttribute('role', 'group')
  roleButtons.setAttribute('aria-label', 'Role view')
  const status = node(documentRef, 'p', '', 'small muted')
  status.setAttribute('role', 'status')
  const scenarioSummary = node(documentRef, 'p')
  const requestDetails = node(documentRef, 'details', '', 'reference')
  const requestSummary = node(documentRef, 'summary', 'Inspect request context and conversation history')
  const requestPre = node(documentRef, 'pre', '', 'code')
  const contextPre = node(documentRef, 'pre', '', 'code')
  requestDetails.append(
    requestSummary,
    node(documentRef, 'p', 'Typed Messages API request', 'code-label'),
    requestPre,
    node(documentRef, 'p', 'Application authorization context. This object is not sent as an API field.', 'code-label'),
    contextPre
  )

  const position = node(documentRef, 'p', '', 'small muted')
  const stepHeading = node(documentRef, 'h3')
  const stateList = node(documentRef, 'dl', '', 'api-metadata')
  const teaching = node(documentRef, 'section', '', 'reference')
  const familiar = node(documentRef, 'p')
  const explanation = node(documentRef, 'p')
  const businessValue = node(documentRef, 'p')
  const roleQuestion = node(documentRef, 'p')
  teaching.append(
    node(documentRef, 'h3', 'Teaching frame'),
    familiar,
    explanation,
    businessValue,
    roleQuestion
  )

  const traceGrid = node(documentRef, 'div', '', 'streaming-lab-trace')
  const rawPanel = node(documentRef, 'details', '', 'reference')
  const rawLabel = node(documentRef, 'p', '', 'code-label')
  const rawPre = node(documentRef, 'pre', '', 'code')
  rawPanel.append(node(documentRef, 'summary', 'Inspect the raw event or application action'), rawLabel, rawPre)
  const accumulatedPanel = node(documentRef, 'section', '', 'reference')
  const textPre = node(documentRef, 'pre', '', 'answer-text')
  const jsonPre = node(documentRef, 'pre', '', 'code')
  const jsonLabel=node(documentRef,'p','Tool JSON buffer or parsed input','code-label')
  const toolInputDetails=node(documentRef,'details','','reference')
  toolInputDetails.append(node(documentRef,'summary','Inspect the assembled tool input'),jsonLabel,jsonPre)
  accumulatedPanel.append(
    node(documentRef, 'h3', 'Accumulated snapshot'),
    node(documentRef, 'p', 'Text by completed delta', 'code-label'),
    textPre,
    toolInputDetails
  )
  traceGrid.append(rawPanel, accumulatedPanel)

  const evidence = node(documentRef, 'section', '', 'reference')
  const evidenceList = node(documentRef, 'ul')
  evidence.append(node(documentRef, 'h3', 'What each signal proves'), evidenceList)

  const predictionLabel = node(documentRef, 'label', 'Predict the next safe application stage')
  const prediction = node(documentRef, 'textarea')
  prediction.rows = 3
  prediction.maxLength = 2000
  const predictionId = `streaming-lab-prediction-${Math.random().toString(36).slice(2)}`
  prediction.id = predictionId
  predictionLabel.htmlFor = predictionId
  const saveNote = node(documentRef, 'p', 'Your prediction stays in the browser learning record.', 'small muted')
  const referenceButton = node(documentRef, 'button', 'Reveal completed reference', 'button secondary')
  referenceButton.type = 'button'
  const reference = node(documentRef, 'p', '', 'answer-text')
  reference.hidden = true

  const navigation = node(documentRef, 'div', '', 'actions')
  const previousButton = node(documentRef, 'button', 'Previous step', 'button secondary')
  previousButton.type = 'button'
  const nextButton = node(documentRef, 'button', 'Advance one step', 'button')
  nextButton.type = 'button'
  const catchUpButton = node(documentRef, 'button', 'Catch up to step 10: validated tool request', 'button quiet')
  catchUpButton.type = 'button'
  navigation.append(previousButton, nextButton, catchUpButton)

  const terminalDetails = node(documentRef, 'details', '', 'reference')
  terminalDetails.append(node(documentRef, 'summary', 'Compare incomplete terminal states'))
  for (const example of STREAMING_TERMINAL_EXAMPLES) {
    terminalDetails.append(
      node(documentRef, 'h4', `${example.label}: ${example.state}`),
      node(documentRef, 'p', example.explanation),
      node(documentRef, 'pre', stringify(example.raw || example.action), 'code')
    )
  }

  const progressDetails = node(documentRef, 'details', '', 'reference')
  progressDetails.append(
    node(documentRef, 'summary', 'Model progress notes are not execution receipts'),
    node(documentRef, 'p', 'Optional beta example for Claude Opus 5.5. It is separate from the prepared scenario timeline.'),
    node(documentRef, 'p', 'With display updates, a thinking block with text is model progress narration. An empty thinking field keeps reasoning hidden. Neither form proves that application code or a backend tool is running or complete.'),
    node(documentRef, 'p', 'The example signature is an opaque placeholder. It is not live, valid, or replayable. The visible note is not raw chain of thought and supplies no runtime percent.'),
    node(documentRef, 'p', 'Prepared request excerpt', 'code-label'),
    node(documentRef, 'pre', stringify(STREAMING_PROGRESS_REFERENCE.request), 'code'),
    node(documentRef, 'p', 'Prepared progress block. It is distinct from text and tool_use blocks.', 'code-label'),
    node(documentRef, 'pre', stringify(STREAMING_PROGRESS_REFERENCE.progressBlock), 'code'),
    node(documentRef, 'p', 'Prepared SSE thinking_delta at content block index 2', 'code-label'),
    node(documentRef, 'pre', stringify(STREAMING_PROGRESS_REFERENCE.streamingDelta), 'code'),
    node(documentRef, 'a', 'Official guide: progress updates between tool calls')
  )
  const progressLink = progressDetails.lastElementChild
  progressLink.href = 'https://platform.claude.com/docs/en/build-with-claude/thinking#progress-updates-between-tool-calls'
  progressLink.target = '_blank'
  progressLink.rel = 'noopener noreferrer'

  host.append(
    heading,
    intro,
    scenarioHeading,
    scenarioButtons,
    roleHeading,
    roleButtons,
    roleGoal,
    status,
    scenarioSummary,
    requestDetails,
    position,
    stepHeading,
    stateList,
    teaching,
    traceGrid,
    evidence,
    predictionLabel,
    prediction,
    saveNote,
    referenceButton,
    reference,
    navigation,
    progressDetails,
    terminalDetails
  )

  function currentScenario() {
    return scenarioFor(scenarioId)
  }

  function currentStepIndex() {
    const scenario = currentScenario()
    const stored = Number(stepByScenario[scenario.id])
    return Number.isFinite(stored)
      ? Math.max(0, Math.min(Math.trunc(stored), scenario.steps.length - 1))
      : 0
  }

  function predictionKey() {
    return `${scenarioId}:${roleId}:${currentScenario().steps[currentStepIndex()].id}`
  }

  function snapshot() {
    return {
      scenarioId,
      roleId,
      stepByScenario: { ...stepByScenario },
      predictions: { ...predictions },
      revealed: { ...revealed }
    }
  }

  function save() {
    if (typeof onSave === 'function') onSave(snapshot())
  }

  function renderButtons() {
    scenarioButtons.replaceChildren()
    for (const scenario of STREAMING_LAB_SCENARIOS) {
      const button = node(documentRef, 'button', scenario.label, 'button secondary')
      button.type = 'button'
      button.setAttribute('aria-pressed', String(scenario.id === scenarioId))
      button.addEventListener('click', () => {
        scenarioId = scenario.id
        if (!Number.isFinite(Number(stepByScenario[scenarioId]))) stepByScenario[scenarioId] = 0
        save()
        render()
      })
      scenarioButtons.append(button)
    }
    roleButtons.replaceChildren()
    for (const role of Object.values(ROLE_VIEWS)) {
      const button = node(documentRef, 'button', role.label, 'button secondary')
      button.type = 'button'
      button.setAttribute('aria-pressed', String(role.id === roleId))
      button.addEventListener('click', () => {
        roleId = role.id
        save()
        render()
      })
      roleButtons.append(button)
    }
  }

  function renderState(state) {
    stateList.replaceChildren()
    stateList.append(
      definition(documentRef, 'Application stage', state.status),
      definition(documentRef, 'Stop reason', state.stopReason || 'Not received'),
      definition(documentRef, 'Stream complete', state.streamComplete ? 'Yes' : 'No'),
      definition(documentRef, 'Business complete', state.businessComplete ? 'Yes, after source review' : 'No'),
      definition(documentRef, 'Tool receipt', state.execution.confirmed
        ? `${state.execution.receiptId} (prepared simulation)`
        : state.execution.started ? 'Not confirmed' : 'Tool has not started')
    )
  }

  function renderEvidence(state) {
    evidenceList.replaceChildren()
    const statements = [
      `Streamed text: ${state.accumulatedText ? 'model text is visible' : 'no current text'}. It is not execution proof.`,
      `Ping heartbeat: ${state.heartbeatCount} received. A ping carries no model text.`,
      `Model-authored progress: ${state.accumulatedText.startsWith('I will') ? 'present as a text delta' : 'not present in this current Message'}. It is not a protocol progress event.`,
      `Backend tool receipt: ${state.execution.confirmed ? 'confirmed in this prepared simulation' : 'not confirmed'}.`,
      `Business complete: ${state.businessComplete ? 'human source review passed' : 'required source review has not passed'}.`
    ]
    for (const statement of statements) evidenceList.append(node(documentRef, 'li', statement))
  }

  function renderAccumulated(state) {
    textPre.textContent = state.accumulatedText || 'No accumulated text in the current Message.'
    const block = findToolBlock(state)
    toolInputDetails.hidden=!block
    if (!block) jsonPre.textContent = ''
    else if (!block.parseAttempted) {jsonLabel.textContent='Incomplete tool input. Wait for content_block_stop before parsing.';jsonPre.textContent=block.partialJson||''}
    else if (block.schemaValid) {jsonLabel.textContent='Parsed and schema-valid at content_block_stop';jsonPre.textContent=stringify(block.parsedInput)}
    else {jsonLabel.textContent='Input rejected: '+block.validationErrors.join(' ');jsonPre.textContent=block.partialJson||''}
  }

  function render() {
    const scenario = currentScenario()
    const index = currentStepIndex()
    stepByScenario[scenario.id] = index
    const step = scenario.steps[index]
    const state = replayScenario(scenario, index + 1)
    const role = ROLE_VIEWS[roleId]
    roleGoal.textContent='Your goal: '+(roleId==='engineer'?'Explain how a streamed request becomes validated, authorized tool input and a reviewed draft.':roleId==='sales'?'Decide which customer claims are usable, which remain unknown, and who must check them.':'Define truthful product states and the evidence required to move between them.')
    host.dataset.role=roleId
    if(renderedRole!==roleId){rawPanel.open=roleId==='engineer';toolInputDetails.open=roleId==='engineer';renderedRole=roleId}
    const key = predictionKey()

    renderButtons()
    status.textContent = state.terminal
      ? `Terminal teaching state: ${state.status}. No automatic retry occurs.`
      : `Current application stage: ${state.status}.`
    scenarioSummary.textContent = scenario.summary
    requestPre.textContent = stringify(scenario.initialRequest)
    contextPre.textContent = stringify(scenario.applicationContext)
    position.textContent = `Step ${index + 1} of ${scenario.steps.length}. This number shows trace position, not runtime progress.`
    stepHeading.textContent = step.title
    renderState(state)
    familiar.textContent = `Familiar task: ${step.familiarTask}`
    familiar.hidden=index!==0
    explanation.textContent = `Plain explanation: ${step.explanation}`
    businessValue.textContent = `Business value: ${step.businessValue}`
    roleQuestion.textContent = `Learning check for ${role.label}: ${role.question} ${role.evidence}`
    rawLabel.textContent = step.kind === 'protocol'
      ? 'Prepared SSE event shaped from the official protocol. This is not a live event.'
      : 'Prepared application action. This is not a Claude protocol event or real execution.'
    rawPre.textContent = stringify(step.raw || step.action)
    renderAccumulated(state)
    renderEvidence(state)
    prediction.value = predictions[key] || ''
    reference.hidden = !revealed[key]
    reference.textContent = step.reference
    referenceButton.textContent = revealed[key] ? 'Hide completed reference' : 'Reveal completed reference'
    previousButton.disabled = index === 0
    nextButton.disabled = index === scenario.steps.length - 1
    catchUpButton.disabled = index + 1 === scenario.catchUpStep
  }

  prediction.addEventListener('input', () => {
    predictions[predictionKey()] = prediction.value
    save()
  })
  referenceButton.addEventListener('click', () => {
    const key = predictionKey()
    revealed[key] = !revealed[key]
    save()
    render()
  })
  previousButton.addEventListener('click', () => {
    stepByScenario[scenarioId] = Math.max(0, currentStepIndex() - 1)
    save()
    render()
  })
  nextButton.addEventListener('click', () => {
    stepByScenario[scenarioId] = Math.min(currentScenario().steps.length - 1, currentStepIndex() + 1)
    save()
    render()
  })
  catchUpButton.addEventListener('click', () => {
    stepByScenario[scenarioId] = currentScenario().catchUpStep - 1
    save()
    render()
  })

  if (!Number.isFinite(Number(stepByScenario[scenarioId]))) stepByScenario[scenarioId] = 0
  render()

  return {
    getSavedState: snapshot,
    destroy() {
      host.replaceChildren()
      host.classList.remove('streaming-lab')
    }
  }
}
