import { createSseDecoder } from './live-workflow.js?v=20261026-native-integration'

const CAPABILITY_ENDPOINT = '/api/demo'
const RUN_ENDPOINT = '/api/native-integration'
const TOOL_NAME = 'lookup_northstar_account'
const MAX_BRIEF_ENTRIES = 24
const MAX_TEXT_CHARACTERS = 2_000
const MAX_ID_CHARACTERS = 300

const ROLE_VIEWS = Object.freeze({
  'software-engineer-api': Object.freeze({
    id: 'software-engineer-api',
    key: 'engineer',
    label: 'Engineer',
    goal: 'Confirm the actual MCP receipt, exact Skill pin, native execution proof, and terminal evidence before trusting the brief.'
  }),
  'account-executive': Object.freeze({
    id: 'account-executive',
    key: 'sales',
    label: 'Account Executive',
    goal: 'Review the confirmed facts, unknowns, and owned next actions. The native execution evidence remains available in the receipt.'
  })
})

const STAGES = Object.freeze([
  Object.freeze({ id: 'mcp', label: 'Actual MCP read observed', waiting: 'Waiting for an actual read receipt.' }),
  Object.freeze({ id: 'skill', label: 'Skill pinned', waiting: 'Waiting. A pin alone is not execution.' }),
  Object.freeze({ id: 'native', label: 'Native Skill execution observed', waiting: 'Waiting for native execution proof.' }),
  Object.freeze({ id: 'complete', label: 'Complete', waiting: 'Waiting for validated terminal evidence.' })
])

const BRIEF_SECTIONS = Object.freeze([
  Object.freeze({ id: 'confirmed_facts', label: 'Confirmed facts' }),
  Object.freeze({ id: 'interpretation', label: 'Interpretation' }),
  Object.freeze({ id: 'open_questions', label: 'Open questions' }),
  Object.freeze({ id: 'proposed_next_actions', label: 'Proposed next actions', actions: true })
])

const REASON_COPY = Object.freeze({
  ready: 'Ready.',
  not_configured: 'The native integration is not configured.',
  model_not_allowed: 'The required model is not allowed.',
  runtime_dependencies_missing: 'The native runtime dependencies are unavailable.',
  bundle_invalid: 'The reviewed Skill bundle did not pass inspection.',
  pin_invalid: 'The saved Skill pin is invalid.',
  budget_unavailable: 'The provider call budget is unavailable.',
  insufficient_remaining_calls: 'The remaining provider call budget is too small for this run.',
  native_skill_busy: 'Another Skill pin update is already running.'
})

function node(documentRef, tag, text = '', className = '') {
  const result = documentRef.createElement(tag)
  if (text) result.textContent = text
  if (className) result.className = className
  return result
}

function jsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function protocolError(message) {
  const error = new Error(message)
  error.name = 'NativeIntegrationProtocolError'
  return error
}

function cleanText(value, label, maximum = MAX_TEXT_CHARACTERS) {
  if (typeof value !== 'string') throw protocolError(`${label} was missing.`)
  const clean = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (!clean || clean.length > maximum) throw protocolError(`${label} was missing or too long.`)
  return clean
}

function optionalText(value, maximum = MAX_ID_CHARACTERS) {
  if (typeof value !== 'string') return ''
  const clean = value.replace(/[\r\n\t]+/g, ' ').trim()
  return clean.slice(0, maximum)
}

function safeHref(value, fallback) {
  const clean = optionalText(value, 2_048)
  if (clean.startsWith('#') || (clean.startsWith('/') && !clean.startsWith('//')) || clean.startsWith('https://')) return clean
  return fallback
}

function stringList(value, label, { allowEmpty = false, maximum = 24 } = {}) {
  if (!Array.isArray(value) || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw protocolError(`${label} was invalid.`)
  }
  return value.map((entry, index) => cleanText(entry, `${label} item ${index + 1}`, MAX_ID_CHARACTERS))
}

function sha256(value, label) {
  const hash = cleanText(value, label, 64)
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw protocolError(`${label} was not a SHA-256 value.`)
  return hash.toLowerCase()
}

function sanitizeUsage(value) {
  const usage = jsonObject(value)
  if (!usage) return {}
  const result = {}
  for (const key of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) {
    if (Number.isSafeInteger(usage[key]) && usage[key] >= 0) result[key] = usage[key]
  }
  return result
}

function sanitizeProof(value) {
  const proof = jsonObject(value)
  const keys = [
    'passed',
    'skill_instruction_file_hash_matched',
    'mounted_code_hash_matched',
    'bundled_script_invocation_succeeded',
    'marker_matched',
    'deterministic_output_matched'
  ]
  if (!proof || keys.some(key => proof[key] !== true)) throw protocolError('Native Skill proof was incomplete.')
  const result = Object.fromEntries(keys.map(key => [key, true]))
  for (const key of ['source_record_validated', 'canonical_output_hash_matched']) {
    if (Object.hasOwn(proof, key)) {
      if (proof[key] !== true) throw protocolError('Native Skill proof hardening did not pass.')
      result[key] = true
    }
  }
  for (const key of ['expected_output_sha256', 'returned_output_sha256']) {
    if (Object.hasOwn(proof, key)) result[key] = sha256(proof[key], `Native proof ${key}`)
  }
  const hasExpectedHash = Object.hasOwn(result, 'expected_output_sha256')
  const hasReturnedHash = Object.hasOwn(result, 'returned_output_sha256')
  if (hasExpectedHash !== hasReturnedHash) throw protocolError('Native Skill proof returned only one output hash.')
  if (hasExpectedHash && result.expected_output_sha256 !== result.returned_output_sha256) {
    throw protocolError('Native Skill proof output hashes did not match.')
  }
  return result
}

function sanitizePartialProof(value) {
  const proof = jsonObject(value)
  if (!proof) return null
  const result = {}
  for (const key of [
    'passed',
    'skill_instruction_file_hash_matched',
    'mounted_code_hash_matched',
    'bundled_script_invocation_succeeded',
    'marker_matched',
    'deterministic_output_matched',
    'source_record_validated',
    'canonical_output_hash_matched'
  ]) {
    if (typeof proof[key] === 'boolean') result[key] = proof[key]
  }
  for (const key of ['expected_output_sha256', 'returned_output_sha256']) {
    if (typeof proof[key] === 'string' && /^[a-f0-9]{64}$/i.test(proof[key])) result[key] = proof[key].toLowerCase()
  }
  return Object.keys(result).length ? result : null
}

function sanitizeBriefEntry(value, label, actions = false) {
  const entry = jsonObject(value)
  if (!entry) throw protocolError(`${label} was invalid.`)
  const result = {
    text: cleanText(entry.text, `${label} text`),
    source_ids: stringList(entry.source_ids, `${label} source IDs`, { allowEmpty: true })
  }
  if (actions) {
    result.owner = cleanText(entry.owner, `${label} owner`, 240)
    result.status = cleanText(entry.status, `${label} status`, 240)
  }
  return result
}

function sanitizeBrief(value) {
  const brief = jsonObject(value)
  if (!brief) throw protocolError('The native output did not include a brief.')
  const result = {}
  for (const section of BRIEF_SECTIONS) {
    const entries = brief[section.id]
    if (!Array.isArray(entries) || entries.length > MAX_BRIEF_ENTRIES) {
      throw protocolError(`The ${section.label.toLowerCase()} section was invalid.`)
    }
    result[section.id] = entries.map((entry, index) => sanitizeBriefEntry(
      entry,
      `${section.label} item ${index + 1}`,
      section.actions === true
    ))
  }
  return result
}

function sanitizeMcp(value) {
  const data = jsonObject(value)
  if (!data || data.evidence_state !== 'mcp_observed') throw protocolError('The MCP observation was invalid.')
  const toolName = cleanText(data.tool_name, 'MCP tool name')
  if (toolName !== TOOL_NAME) throw protocolError('The MCP observation used an unexpected tool.')
  return {
    trace_id: cleanText(data.trace_id, 'MCP trace ID'),
    evidence_state: 'mcp_observed',
    account_id: cleanText(data.account_id, 'MCP account ID'),
    tool_name: toolName,
    actor_id: cleanText(data.actor_id, 'MCP actor ID'),
    server_name: cleanText(data.server_name, 'MCP server name'),
    server_version: cleanText(data.server_version, 'MCP server version'),
    protocol_version: cleanText(data.protocol_version, 'MCP protocol version'),
    source_ids: stringList(data.source_ids, 'MCP source IDs'),
    fixture_sha256: sha256(data.fixture_sha256, 'MCP fixture hash'),
    record_sha256: sha256(data.record_sha256, 'MCP record hash'),
    receipt_sha256: sha256(data.receipt_sha256, 'MCP receipt hash')
  }
}

function sanitizeRunStart(value, role) {
  const data = jsonObject(value)
  if (!data || data.evidence_state !== 'prepared_unrun') throw protocolError('The native run start was invalid.')
  if (data.role_id !== role.id || data.account_id !== 'northstar-freight' || data.review_required !== true) {
    throw protocolError('The native run start did not match this role and review boundary.')
  }
  if (typeof data.upload_required !== 'boolean' || ![1, 2].includes(data.calls_required)) {
    throw protocolError('The native run start did not include its provider call plan.')
  }
  if ((data.upload_required && data.calls_required !== 2) || (!data.upload_required && data.calls_required !== 1)) {
    throw protocolError('The native run start provider call plan was inconsistent.')
  }
  return {
    trace_id: cleanText(data.trace_id, 'Run trace ID'),
    role_id: role.id,
    account_id: 'northstar-freight',
    evidence_state: 'prepared_unrun',
    upload_required: data.upload_required,
    calls_required: data.calls_required,
    review_required: true
  }
}

function sanitizeSkill(value) {
  const data = jsonObject(value)
  if (!data || data.evidence_state !== 'skill_pinned') throw protocolError('The Skill pin observation was invalid.')
  if (!['create_skill', 'create_version', 'reuse_pin'].includes(data.operation)) {
    throw protocolError('The Skill pin operation was invalid.')
  }
  if (typeof data.upload_required !== 'boolean' || typeof data.reused !== 'boolean') {
    throw protocolError('The Skill pin state was invalid.')
  }
  const providerRequestId = data.provider_request_id === null
    ? null
    : cleanText(data.provider_request_id, 'Skill provider request ID')
  if (data.reused && (data.operation !== 'reuse_pin' || data.upload_required || providerRequestId !== null)) {
    throw protocolError('The reused Skill pin evidence was inconsistent.')
  }
  if (!data.reused && (data.operation === 'reuse_pin' || !data.upload_required || !providerRequestId)) {
    throw protocolError('The uploaded Skill pin evidence was inconsistent.')
  }
  return {
    trace_id: cleanText(data.trace_id, 'Skill trace ID'),
    evidence_state: 'skill_pinned',
    operation: data.operation,
    upload_required: data.upload_required,
    reused: data.reused,
    skill_id: cleanText(data.skill_id, 'Skill ID'),
    version: cleanText(data.version, 'Skill version'),
    bundle_sha256: sha256(data.bundle_sha256, 'Skill bundle hash'),
    provider_request_id: providerRequestId
  }
}

function sanitizeNative(value) {
  const data = jsonObject(value)
  if (!data || data.evidence_state !== 'native_skill_observed') throw protocolError('Native Skill execution was not observed.')
  if (data.review_required !== true || data.stop_reason !== 'end_turn') {
    throw protocolError('Native Skill execution did not reach the review boundary.')
  }
  return {
    trace_id: cleanText(data.trace_id, 'Native execution trace ID'),
    evidence_state: 'native_skill_observed',
    review_required: true,
    stop_reason: 'end_turn',
    model: cleanText(data.model, 'Native execution model'),
    provider_request_id: cleanText(data.provider_request_id, 'Native provider request ID'),
    usage: sanitizeUsage(data.usage),
    container_id: cleanText(data.container_id, 'Native container ID'),
    skill_id: cleanText(data.skill_id, 'Executed Skill ID'),
    skill_version: cleanText(data.skill_version, 'Executed Skill version'),
    proof: sanitizeProof(data.proof),
    brief: sanitizeBrief(jsonObject(data.output)?.brief)
  }
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateNativeComplete(payload, state, { callsRequired = null } = {}) {
  const missing = []
  if (payload?.evidence_state !== 'native_skill_observed') missing.push('native_skill_observed evidence state')
  if (payload?.review_required !== true) missing.push('review_required')
  if (payload?.stop_reason !== 'end_turn') missing.push('end_turn stop reason')
  if (payload?.message_stop !== true) missing.push('message_stop')
  if (typeof payload?.model !== 'string' || !payload.model.trim()) missing.push('model')
  if (!state?.started) missing.push('run_start')
  if (!state?.mcp) missing.push('MCP observation')
  if (!state?.skill) missing.push('Skill pin observation')
  if (!state?.native) missing.push('native Skill observation')
  if (!state?.traceId || payload?.trace_id !== state.traceId) missing.push('matching trace ID')

  let mcp
  let skill
  let proof
  let brief
  try { mcp = sanitizeMcp(payload?.mcp) } catch { missing.push('sanitized MCP receipt') }
  try { skill = sanitizeSkill(payload?.skill) } catch { missing.push('sanitized Skill receipt') }
  try { proof = sanitizeProof(payload?.proof) } catch { missing.push('native proof') }
  try { brief = sanitizeBrief(jsonObject(payload?.output)?.brief) } catch { missing.push('validated brief') }

  if (mcp && state?.mcp && !equalJson(mcp, state.mcp)) missing.push('matching MCP receipt')
  if (skill && state?.skill && !equalJson(skill, state.skill)) missing.push('matching Skill receipt')
  if (proof && state?.native && !equalJson(proof, state.native.proof)) missing.push('matching native proof')
  if (brief && state?.native && !equalJson(brief, state.native.brief)) missing.push('matching native brief')
  if (state?.native && payload?.model !== state.native.model) missing.push('matching model')
  if (state?.skill && state?.native && (
    state.native.skill_id !== state.skill.skill_id || state.native.skill_version !== state.skill.version
  )) missing.push('executed pinned Skill')

  const providerIds = payload?.provider_request_ids
  if (!Array.isArray(providerIds) || providerIds.length === 0 || providerIds.some(id => typeof id !== 'string' || !id.trim())) {
    missing.push('provider request IDs')
  } else {
    if (new Set(providerIds).size !== providerIds.length) missing.push('unique provider request IDs')
    if ([1, 2].includes(callsRequired) && providerIds.length !== callsRequired) missing.push('expected provider request count')
    if (state?.native?.provider_request_id && !providerIds.includes(state.native.provider_request_id)) {
      missing.push('native provider request ID')
    }
    if (state?.skill?.provider_request_id && !providerIds.includes(state.skill.provider_request_id)) {
      missing.push('Skill provider request ID')
    }
  }

  return { valid: missing.length === 0, missing, sanitized: { mcp, skill, proof, brief } }
}

function capabilityPlan(data, role) {
  const native = jsonObject(data?.native_integration)
  const roleIds = native?.role_ids
  const callsRequired = native?.calls_required
  const uploadRequired = native?.upload_required
  const limits = jsonObject(native?.limits)
  const enabled = Boolean(
    native?.enabled === true &&
    native?.endpoint === RUN_ENDPOINT &&
    Array.isArray(roleIds) && roleIds.includes(role.id) &&
    typeof uploadRequired === 'boolean' &&
    [1, 2].includes(callsRequired) &&
    ((uploadRequired && callsRequired === 2) || (!uploadRequired && callsRequired === 1))
  )
  return {
    enabled,
    reason: optionalText(native?.reason, 80) || 'not_configured',
    uploadRequired: typeof uploadRequired === 'boolean' ? uploadRequired : null,
    callsRequired: [1, 2].includes(callsRequired) ? callsRequired : null,
    timeoutMs: Number.isSafeInteger(limits?.total_timeout_ms) && limits.total_timeout_ms > 0
      ? Math.min(limits.total_timeout_ms + 5_000, 60_000)
      : 50_000
  }
}

export function mountNativeIntegration(host, {
  roleId = 'software-engineer-api',
  guideHref = '#material/native-integration',
  sourceHref = '#material/native-integration-code',
  fetchImpl = globalThis.fetch
} = {}) {
  if (!host) return null
  const documentRef = host.ownerDocument || document
  const role = ROLE_VIEWS[roleId] || null
  const request = typeof fetchImpl === 'function' ? fetchImpl : null
  const capabilityController = new AbortController()
  let destroyed = false
  let available = false
  let running = false
  let plan = { enabled: false, reason: 'not_configured', uploadRequired: null, callsRequired: null, timeoutMs: 50_000 }
  let activeController = null
  let runTimeout = null
  let runNumber = 0
  let abortReason = ''

  host.replaceChildren()
  host.className = 'live-workflow native-integration'
  host.dataset.role = role?.key || 'unsupported'

  const heading = node(documentRef, 'h2', 'Run the native MCP and Skill integration')
  const intro = node(
    documentRef,
    'p',
    'Optional. Loading this panel checks availability only. A provider request starts only after you press the run button.'
  )
  const goal = node(documentRef, 'p', '', 'lesson-outcome')
  goal.append(
    node(documentRef, 'strong', 'Your goal'),
    documentRef.createTextNode(` ${role?.goal || 'Choose the Engineer or Account Executive view before running this integration.'}`)
  )
  const boundary = node(documentRef, 'p', '', 'live-workflow-boundary')
  boundary.append(
    node(documentRef, 'strong', 'Fixed scope'),
    documentRef.createTextNode(' Read-only Northstar MCP · reviewed Skill bundle · native code execution · human review required')
  )

  const controls = node(documentRef, 'div', '', 'live-workflow-controls')
  const runButton = node(documentRef, 'button', 'Run pinned Skill', 'button')
  runButton.type = 'button'
  runButton.disabled = true
  const runStatus = node(documentRef, 'p', 'Checking availability. No provider call has started.', 'small muted')
  runStatus.setAttribute('role', 'status')
  runStatus.setAttribute('aria-live', 'polite')
  controls.append(runButton, runStatus)

  const stageList = node(documentRef, 'ol', '', 'checklist native-integration-stages')
  stageList.setAttribute('aria-label', 'Native integration evidence stages')
  const stageNodes = {}
  for (const stage of STAGES) {
    const item = node(documentRef, 'li')
    item.dataset.stage = stage.id
    item.dataset.state = 'waiting'
    const label = node(documentRef, 'strong', stage.label)
    const detail = node(documentRef, 'span', stage.waiting, 'small muted')
    item.append(label, documentRef.createTextNode(' '), detail)
    stageNodes[stage.id] = { item, detail }
    stageList.append(item)
  }

  const outputSection = node(documentRef, 'section', '', 'live-workflow-output native-integration-output')
  const outputHeading = node(documentRef, 'div', '', 'live-workflow-output-heading')
  const outputTitle = node(documentRef, 'h3', 'Renewal brief')
  const readiness = node(documentRef, 'span', 'Not ready', 'live-workflow-readiness')
  readiness.dataset.state = 'idle'
  outputHeading.append(outputTitle, readiness)
  const output = node(documentRef, 'div', 'No native brief yet. Loading availability does not run the Skill.', 'live-workflow-draft')
  output.dataset.state = 'empty'
  output.setAttribute('aria-live', 'polite')
  outputSection.append(outputHeading, output)

  const receiptDetails = node(documentRef, 'details', '', 'reference native-integration-receipt')
  receiptDetails.open = role?.key === 'engineer'
  receiptDetails.append(node(documentRef, 'summary', 'Inspect the sanitized evidence receipt'))
  const receiptLabel = node(documentRef, 'p', 'MCP, Skill pin, proof, and terminal identifiers', 'code-label')
  const receiptPre = node(documentRef, 'pre', '', 'code')
  receiptPre.dataset.language = 'json'
  const receiptCode = node(documentRef, 'code', JSON.stringify({ evidence_state: 'prepared_unrun' }, null, 2))
  receiptPre.append(receiptCode)
  receiptDetails.append(receiptLabel, receiptPre)

  const resources = node(documentRef, 'div', '', 'actions live-workflow-resources')
  const guideLink = node(documentRef, 'a', 'Read the native integration guide', 'button secondary')
  const safeGuideHref = safeHref(guideHref, '#material/native-integration')
  guideLink.href = safeGuideHref
  if (safeGuideHref.startsWith('https://')) {
    guideLink.rel = 'noopener noreferrer'
  }
  const sourceLink = node(documentRef, 'a', 'Inspect the full Skill bundle', 'button quiet')
  const safeSourceHref = safeHref(sourceHref, '#material/native-integration-code')
  sourceLink.href = safeSourceHref
  if (safeSourceHref.startsWith('https://')) {
    sourceLink.rel = 'noopener noreferrer'
  }
  resources.append(guideLink, sourceLink)

  host.append(heading, intro, goal, boundary, controls, stageList, outputSection, receiptDetails, resources)

  function current(number) {
    return !destroyed && number === runNumber && host.isConnected
  }

  function actionLabel() {
    return plan.uploadRequired === true ? 'Upload Skill and run' : 'Run pinned Skill'
  }

  function setReadiness(label, state) {
    readiness.textContent = label
    readiness.dataset.state = state
  }

  function setStage(id, detail, state = 'observed') {
    const stage = stageNodes[id]
    if (!stage) return
    stage.item.dataset.state = state
    stage.detail.textContent = detail
  }

  function resetStages() {
    for (const stage of STAGES) setStage(stage.id, stage.waiting, 'waiting')
    if (plan.uploadRequired === false) {
      setStage('skill', 'A pin is available. This run has not observed or executed it yet.', 'waiting')
    }
  }

  function renderReceipt(state) {
    const receipt = {
      trace_id: state.traceId || null,
      role_id: role?.id || roleId,
      evidence_state: state.evidenceState,
      run_start: state.runStart,
      mcp: state.mcp,
      skill: state.skill,
      native_execution: state.native ? {
        model: state.native.model,
        provider_request_id: state.native.provider_request_id,
        usage: state.native.usage,
        container_id: state.native.container_id,
        skill_id: state.native.skill_id,
        skill_version: state.native.skill_version,
        proof: state.native.proof
      } : null,
      provider_request_ids: state.providerRequestIds,
      stop_reason: state.stopReason || null,
      review_required: state.reviewRequired,
      error: state.error,
      partial_proof: state.partialProof
    }
    receiptCode.textContent = JSON.stringify(receipt, null, 2)
  }

  function renderBrief(brief, { complete = false } = {}) {
    output.replaceChildren()
    output.className = 'live-workflow-draft native-integration-brief'
    output.dataset.state = complete ? 'complete' : 'partial'
    output.setAttribute('aria-live', complete ? 'polite' : 'off')
    const comparison = node(documentRef, 'div', '', 'comparison')
    for (const section of BRIEF_SECTIONS) {
      const sectionNode = node(documentRef, 'section')
      sectionNode.append(node(documentRef, 'h4', section.label))
      const entries = brief[section.id]
      if (!entries.length) {
        sectionNode.append(node(documentRef, 'p', 'None reported.', 'small muted'))
      } else {
        const list = node(documentRef, 'ul')
        for (const entry of entries) {
          const item = node(documentRef, 'li')
          item.append(node(documentRef, 'p', entry.text))
          const facts = []
          if (section.actions) facts.push(`Owner: ${entry.owner}`, `Status: ${entry.status}`)
          facts.push(`Sources: ${entry.source_ids.length ? entry.source_ids.join(', ') : 'none supplied'}`)
          item.append(node(documentRef, 'p', facts.join(' · '), 'small muted'))
          list.append(item)
        }
        sectionNode.append(list)
      }
      comparison.append(sectionNode)
    }
    output.append(comparison)
  }

  function showEmpty(message) {
    output.replaceChildren()
    output.className = 'live-workflow-draft'
    output.dataset.state = 'empty'
    output.setAttribute('aria-live', 'polite')
    output.textContent = message
  }

  function finishControls() {
    running = false
    activeController = null
    abortReason = ''
    clearTimeout(runTimeout)
    runTimeout = null
    host.removeAttribute('aria-busy')
    runButton.disabled = !available
    runButton.textContent = actionLabel()
  }

  async function admissionMessage(response) {
    try {
      const data = await response.json()
      return optionalText(data?.message, 240) || `The native integration could not start (${response.status}).`
    } catch {
      return `The native integration could not start (${response.status}).`
    }
  }

  async function runIntegration() {
    if (destroyed || running || !available || !request || !role) return
    const number = ++runNumber
    running = true
    abortReason = ''
    activeController = new AbortController()
    host.setAttribute('aria-busy', 'true')
    runButton.disabled = false
    runButton.textContent = 'Cancel'
    runStatus.textContent = 'Starting one native integration run. You can cancel at any time.'
    resetStages()
    setReadiness('Running', 'active')
    showEmpty('Waiting for actual MCP and native Skill evidence.')

    const state = {
      started: false,
      traceId: '',
      runStart: null,
      callsRequired: null,
      evidenceState: 'prepared_unrun',
      mcp: null,
      skill: null,
      native: null,
      providerRequestIds: [],
      stopReason: '',
      reviewRequired: true,
      error: null,
      partialProof: null,
      terminal: ''
    }
    renderReceipt(state)

    function sameTrace(traceId) {
      if (!state.traceId) state.traceId = traceId
      if (traceId !== state.traceId) throw protocolError('An event used a different trace ID.')
    }

    function markIncomplete(message, errorData = null) {
      state.terminal = state.terminal || 'incomplete'
      if (errorData) state.error = errorData
      setReadiness(state.native ? 'Brief incomplete' : 'Not ready', 'incomplete')
      if (state.native?.brief) renderBrief(state.native.brief)
      else showEmpty('No validated native brief was completed. Partial receipt evidence is preserved below.')
      runStatus.textContent = `Review is blocked. ${message}`
      renderReceipt(state)
    }

    function handleEvent(name, payload) {
      if (!current(number) || state.terminal) return
      const data = jsonObject(payload)
      if (!data) throw protocolError(`The ${name} event did not contain a JSON object.`)

      if (name === 'status') {
        if (!state.started) throw protocolError('A status event arrived before run_start.')
        const message = optionalText(data.message, 240)
        if (message) runStatus.textContent = message
        return
      }

      if (name === 'run_start') {
        if (state.started) throw protocolError('The stream repeated run_start.')
        const started = sanitizeRunStart(data, role)
        sameTrace(started.trace_id)
        state.started = true
        state.runStart = started
        state.callsRequired = started.calls_required
        state.evidenceState = 'prepared_unrun'
        plan.uploadRequired = started.upload_required
        plan.callsRequired = started.calls_required
        runStatus.textContent = started.upload_required
          ? 'Run admitted. Waiting for the actual MCP read before the Skill upload.'
          : 'Run admitted. Waiting for the actual MCP read before the pinned Skill is used.'
        renderReceipt(state)
        return
      }

      if (name === 'mcp_observed') {
        if (!state.started || state.mcp) throw protocolError('The MCP observation arrived outside the admitted sequence.')
        const mcp = sanitizeMcp(data)
        sameTrace(mcp.trace_id)
        state.mcp = mcp
        state.evidenceState = 'mcp_observed'
        setStage('mcp', `Observed ${mcp.tool_name} from ${mcp.server_name}.`, 'observed')
        runStatus.textContent = 'Actual MCP read observed. Waiting for the exact Skill pin.'
        renderReceipt(state)
        return
      }

      if (name === 'skill_pinned') {
        if (!state.mcp || state.skill) throw protocolError('The Skill pin arrived outside the observed MCP sequence.')
        const skill = sanitizeSkill(data)
        sameTrace(skill.trace_id)
        state.skill = skill
        state.evidenceState = 'skill_pinned'
        plan.uploadRequired = false
        plan.callsRequired = 1
        if (skill.provider_request_id) state.providerRequestIds.push(skill.provider_request_id)
        setStage('skill', `Pinned ${skill.skill_id} at ${skill.version}.`, 'observed')
        runStatus.textContent = 'Skill pin observed. Waiting for native execution proof.'
        renderReceipt(state)
        return
      }

      if (name === 'native_skill_observed') {
        if (!state.skill || state.native) throw protocolError('Native Skill evidence arrived outside the pinned sequence.')
        const native = sanitizeNative(data)
        sameTrace(native.trace_id)
        if (native.skill_id !== state.skill.skill_id || native.skill_version !== state.skill.version) {
          throw protocolError('Native execution did not use the observed Skill pin.')
        }
        state.native = native
        state.evidenceState = 'native_skill_observed'
        state.stopReason = native.stop_reason
        if (!state.providerRequestIds.includes(native.provider_request_id)) state.providerRequestIds.push(native.provider_request_id)
        setStage('native', `Observed ${native.skill_id} at ${native.skill_version} in the native container.`, 'observed')
        setReadiness('Awaiting complete event', 'active')
        renderBrief(native.brief)
        runStatus.textContent = 'Native Skill execution observed. Waiting for terminal evidence.'
        renderReceipt(state)
        return
      }

      if (name === 'error') {
        if (!state.started) throw protocolError('A stream error arrived before run_start.')
        if (!['prepared_unrun', 'mcp_observed', 'skill_pinned'].includes(data.evidence_state)) {
          throw protocolError('The stream error used an invalid evidence state.')
        }
        if (data.partial !== true || data.review_required !== true) {
          throw protocolError('The stream error did not preserve the review boundary.')
        }
        sameTrace(cleanText(data.trace_id, 'Stream error trace ID'))
        if (!state.mcp && data.mcp) {
          const mcp = sanitizeMcp(data.mcp)
          sameTrace(mcp.trace_id)
          state.mcp = mcp
          setStage('mcp', `Observed ${mcp.tool_name} from ${mcp.server_name}.`, 'observed')
        }
        if (!state.skill && data.skill) {
          const skill = sanitizeSkill(data.skill)
          sameTrace(skill.trace_id)
          state.skill = skill
          plan.uploadRequired = false
          plan.callsRequired = 1
          setStage('skill', `Pinned ${skill.skill_id} at ${skill.version}. Native execution was not observed.`, 'observed')
        }
        if (data.proof) state.partialProof = sanitizePartialProof(data.proof)
        if (data.evidence_state === 'mcp_observed' && !state.mcp) {
          throw protocolError('The stream error claimed MCP evidence without its receipt.')
        }
        if (data.evidence_state === 'skill_pinned' && !state.skill) {
          throw protocolError('The stream error claimed a Skill pin without its receipt.')
        }
        state.evidenceState = data.evidence_state
        state.providerRequestIds = stringList(
          data.provider_request_ids,
          'Error provider request IDs',
          { allowEmpty: true }
        )
        state.terminal = 'error'
        markIncomplete(cleanText(data.message, 'Stream error message', 240), {
          code: cleanText(data.code, 'Stream error code', 120),
          failed_stage: cleanText(data.failed_stage, 'Failed stage', 120),
          message: cleanText(data.message, 'Stream error message', 240)
        })
        return
      }

      if (name === 'complete') {
        if (!state.native) throw protocolError('The complete event arrived before native Skill evidence.')
        sameTrace(cleanText(data.trace_id, 'Complete trace ID'))
        const validation = validateNativeComplete(data, state, { callsRequired: state.callsRequired })
        if (!validation.valid) {
          state.terminal = 'incomplete'
          markIncomplete(`Terminal evidence was missing: ${validation.missing.join(', ')}.`)
          return
        }
        state.terminal = 'complete'
        state.evidenceState = 'native_skill_observed'
        state.providerRequestIds = stringList(data.provider_request_ids, 'Provider request IDs')
        state.stopReason = 'end_turn'
        state.reviewRequired = true
        renderBrief(validation.sanitized.brief, { complete: true })
        setStage('complete', 'Validated end_turn and current-run provider request IDs.', 'observed')
        setReadiness('Brief ready for review', 'ready')
        runStatus.textContent = 'Complete. Native Skill execution was observed. Human review is still required.'
        renderReceipt(state)
        return
      }

      throw protocolError(`Unexpected native integration event: ${name}.`)
    }

    try {
      runTimeout = setTimeout(() => {
        if (!current(number) || !running) return
        abortReason = 'timeout'
        activeController?.abort()
      }, plan.timeoutMs)

      const response = await request(RUN_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: role.id }),
        signal: activeController.signal,
        cache: 'no-store'
      })
      if (!current(number)) return
      if (!response.ok) {
        const message = await admissionMessage(response)
        if (!current(number)) return
        markIncomplete(message)
        return
      }
      if (!response.body || !String(response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream')) {
        throw protocolError('The server did not return a native integration event stream.')
      }

      const decoder = createSseDecoder(({ event, data }) => {
        let payload
        try { payload = JSON.parse(data) }
        catch { throw protocolError(`The ${event} event contained invalid JSON.`) }
        handleEvent(event, payload)
      })
      const reader = response.body.getReader()
      while (current(number)) {
        const { done, value } = await reader.read()
        if (done) break
        decoder.push(value)
        if (state.terminal) {
          await reader.cancel()
          break
        }
      }
      if (!current(number)) return
      const parserState = decoder.finish()
      if (!state.terminal) {
        markIncomplete(parserState.incomplete
          ? 'The stream ended in the middle of an event. Partial receipt evidence is preserved.'
          : 'The stream ended before the complete event. Partial receipt evidence is preserved.')
      }
    } catch (error) {
      if (!current(number)) return
      if (error?.name === 'AbortError') {
        markIncomplete(abortReason === 'timeout'
          ? 'The native run exceeded its time limit. Partial receipt evidence is preserved.'
          : 'Run cancelled. Partial receipt evidence is preserved.')
      } else {
        markIncomplete(optionalText(error?.message, 240) || 'The native integration stream could not be read.')
      }
    } finally {
      if (current(number)) finishControls()
    }
  }

  function cancel() {
    if (destroyed || !running || !activeController) return false
    abortReason = 'cancelled'
    runButton.disabled = true
    runButton.textContent = 'Cancelling…'
    runStatus.textContent = 'Cancelling this run. No retry will start.'
    activeController.abort()
    return true
  }

  runButton.addEventListener('click', () => {
    if (running) {
      cancel()
      return
    }
    runIntegration()
  })

  if (!role) {
    runStatus.textContent = 'Native integration is available only for Engineer and Account Executive views.'
  } else if (!request) {
    runStatus.textContent = 'Native integration availability could not be checked.'
  } else {
    request(CAPABILITY_ENDPOINT, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: capabilityController.signal
    }).then(async response => {
      const data = await response.json()
      if (destroyed) return
      plan = capabilityPlan(data, role)
      available = response.ok && plan.enabled
      runButton.textContent = actionLabel()
      runButton.disabled = !available
      if (available) {
        const calls = `${plan.callsRequired} bounded provider ${plan.callsRequired === 1 ? 'call' : 'calls'}`
        runStatus.textContent = `Ready. Press ${actionLabel()} to start ${calls}.`
        resetStages()
      } else {
        runStatus.textContent = plan.reason === 'ready'
          ? 'The native integration capability was incomplete.'
          : REASON_COPY[plan.reason] || 'The native integration is unavailable.'
      }
    }).catch(() => {
      if (destroyed) return
      available = false
      runButton.disabled = true
      runStatus.textContent = 'Native integration availability could not be checked.'
    })
  }

  return {
    cancel,
    destroy() {
      if (destroyed) return
      destroyed = true
      runNumber += 1
      clearTimeout(runTimeout)
      capabilityController.abort()
      activeController?.abort()
      host.replaceChildren()
      host.classList.remove('live-workflow')
      host.classList.remove('native-integration')
    }
  }
}
