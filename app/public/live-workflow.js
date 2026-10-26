import { renderMarkdown } from './materials-viewer.js?v=20261026-live-workflow'

const WORKFLOW_ENDPOINT = '/api/workflow'
const TOOL_NAME = 'lookup_northstar_account'
const MAX_EVENT_CHARACTERS = 262_144
const MAX_OUTPUT_CHARACTERS = 80_000
const MAX_TRACE_EVENTS = 100

const ROLE_VIEWS = Object.freeze({
  engineer: Object.freeze({
    id: 'engineer',
    label: 'Engineer',
    roleId: 'software-engineer-api',
    goal: 'Inspect the event order, account boundary, tool ID, and terminal evidence before the draft can move to review.',
    running: 'Follow the tool ID and terminal event. Visible text alone is not completion.',
    complete: 'The tool request and result match. The terminal event permits review, not external use.'
  }),
  sales: Object.freeze({
    id: 'sales',
    label: 'Account executive',
    roleId: 'account-executive',
    goal: 'Check the source-linked conclusion, keep unsupported claims unresolved, and review the draft before use.',
    running: 'The fixed Northstar record is being read. No CRM or customer system can be changed.',
    complete: 'A source-linked draft arrived. Check every customer claim before using it.'
  }),
  product: Object.freeze({
    id: 'product',
    label: 'Product',
    roleId: 'product-manager',
    goal: 'Use explicit events to distinguish waiting, tool activity, incomplete output, and a draft ready for review.',
    running: 'The interface advances only when a named event supplies the required evidence.',
    complete: 'The terminal event moves the product to ready for review, not approved or sent.'
  })
})

function node(documentRef, tag, text = '', className = '') {
  const result = documentRef.createElement(tag)
  if (text) result.textContent = text
  if (className) result.className = className
  return result
}

function firstLine(value, fallback, maximum = 240) {
  if (typeof value !== 'string') return fallback
  const clean = value.replace(/[\r\n\t]+/g, ' ').trim()
  return clean ? clean.slice(0, maximum) : fallback
}

function jsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value
}

function eventError(message) {
  const error = new Error(message)
  error.name = 'WorkflowProtocolError'
  return error
}

/**
 * Decode named SSE events from byte chunks. UTF-8 sequences and CRLF pairs may
 * be split across chunks. Data lines are joined with a newline per the SSE spec.
 */
export function createSseDecoder(onEvent, { maxEventCharacters = MAX_EVENT_CHARACTERS } = {}) {
  if (typeof onEvent !== 'function') throw new TypeError('onEvent must be a function')
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let dataLines = []
  let dataCharacters = 0
  let closed = false

  function resetEvent() {
    eventName = ''
    dataLines = []
    dataCharacters = 0
  }

  function dispatch() {
    if (!dataLines.length) {
      resetEvent()
      return
    }
    const event = { event: eventName || 'message', data: dataLines.join('\n') }
    resetEvent()
    onEvent(event)
  }

  function processLine(line) {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    let value = colon < 0 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') eventName = value
    if (field === 'data') {
      dataCharacters += value.length
      if (dataCharacters > maxEventCharacters) throw eventError('An event exceeded the live workflow display limit.')
      dataLines.push(value)
    }
  }

  function drain(flush = false) {
    while (buffer.length) {
      const lineFeed = buffer.indexOf('\n')
      const carriageReturn = buffer.indexOf('\r')
      let index = -1
      if (lineFeed >= 0 && carriageReturn >= 0) index = Math.min(lineFeed, carriageReturn)
      else index = Math.max(lineFeed, carriageReturn)
      if (index < 0) break
      if (!flush && buffer[index] === '\r' && index === buffer.length - 1) break
      const separatorLength = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + separatorLength)
      processLine(line)
    }
  }

  return {
    push(chunk) {
      if (closed) throw new Error('The SSE decoder is closed.')
      buffer += decoder.decode(chunk, { stream: true })
      drain()
    },
    finish() {
      if (closed) return { incomplete: false }
      buffer += decoder.decode()
      drain(true)
      closed = true
      return { incomplete: Boolean(buffer.length || dataLines.length || eventName) }
    }
  }
}

export function validateWorkflowComplete(payload, state) {
  const missing = []
  if (payload?.stop_reason !== 'end_turn') missing.push('end_turn stop reason')
  if (payload?.message_stop !== true) missing.push('message_stop')
  if (payload?.tool_used !== true) missing.push('tool_used')
  if (payload?.review_required !== true) missing.push('review_required')
  if (!state?.started) missing.push('run_start')
  if (!state?.traceId) missing.push('run trace ID')
  if (!state?.toolRequest?.id) missing.push('tool_request')
  if (!state?.toolResult?.tool_use_id) missing.push('tool_result')
  if (state?.toolRequest?.id && state?.toolResult?.tool_use_id !== state.toolRequest.id) missing.push('matching tool ID')
  if (state?.traceId && payload?.trace_id !== state.traceId) missing.push('matching trace ID')
  if (!state?.outputText?.trim()) missing.push('final draft text')
  if (typeof payload?.model !== 'string' || !payload.model) missing.push('model')
  const providerIds = payload?.provider_request_ids
  if (!Array.isArray(providerIds) || providerIds.length !== 2 || providerIds.some(id => typeof id !== 'string' || !id)) {
    missing.push('two provider request IDs')
  }
  return { valid: missing.length === 0, missing }
}

function normalizeRole(roleId) {
  return ROLE_VIEWS[roleId] || ROLE_VIEWS.engineer
}

function capabilityReady(data, role) {
  const workflow = jsonObject(data?.workflow)
  const roleIds = workflow?.role_ids || data?.role_ids
  return Boolean(
    workflow?.available === true &&
    workflow?.endpoint === WORKFLOW_ENDPOINT &&
    workflow?.tool_name === TOOL_NAME &&
    workflow?.data_kind === 'synthetic' &&
    workflow?.max_provider_calls === 2 &&
    (!Array.isArray(roleIds) || roleIds.includes(role.roleId))
  )
}

export function mountLiveWorkflow(host, { roleId = 'engineer', showRoleLinks = true, showRoleGoal = true, fallbackLabel = 'Replay' } = {}) {
  if (!host) return null
  const documentRef = host.ownerDocument || document
  const role = normalizeRole(roleId)
  const fallback = firstLine(fallbackLabel, 'Replay', 60)
  let destroyed = false
  let available = false
  let running = false
  let activeController = null
  let abortReason = ''
  let runSettled = false
  let runNumber = 0
  let runTimeout = null
  const capabilityController = new AbortController()

  host.replaceChildren()
  host.className = 'live-workflow'
  host.dataset.role = role.id

  const roleLinks = node(documentRef, 'nav', '', 'live-workflow-roles')
  roleLinks.setAttribute('aria-label', 'Live workflow role')
  for (const view of Object.values(ROLE_VIEWS)) {
    const link = node(documentRef, 'a', view.label)
    link.href = `#streaming/${view.id}/live`
    if (view.id === role.id) link.setAttribute('aria-current', 'page')
    roleLinks.append(link)
  }

  const heading = node(documentRef, 'h2', 'Run the live tool workflow')
  const intro = node(
    documentRef,
    'p',
    'Claude requests one fixed, read-only Northstar lookup. The server executes it locally, returns the synthetic record, and streams the final draft.'
  )
  const goal = node(documentRef, 'p', '', 'lesson-outcome')
  const goalLabel = node(documentRef, 'strong', 'Your goal')
  goal.append(goalLabel, documentRef.createTextNode(` ${role.goal}`))

  const boundary = node(documentRef, 'p', '', 'live-workflow-boundary')
  boundary.append(
    node(documentRef, 'strong', 'Fixed scope'),
    documentRef.createTextNode(` Synthetic Northstar record · ${TOOL_NAME} · read only · review required`)
  )

  const controls = node(documentRef, 'div', '', 'live-workflow-controls')
  const runButton = node(documentRef, 'button', 'Run live workflow', 'button')
  runButton.type = 'button'
  runButton.disabled = true
  const runStatus = node(documentRef, 'p', 'Checking live availability…', 'small muted')
  runStatus.setAttribute('role', 'status')
  runStatus.setAttribute('aria-live', 'polite')
  controls.append(runButton, runStatus)

  const activity = node(documentRef, 'div', '', 'live-tool-activity')
  activity.dataset.state = 'idle'
  const activityMarker = node(documentRef, 'span', '', 'live-tool-marker')
  activityMarker.setAttribute('aria-hidden', 'true')
  const activityCopy = node(documentRef, 'div')
  const activityTitle = node(documentRef, 'strong', 'Waiting to run')
  const activityDetail = node(documentRef, 'span', 'The read-only tool has not run.')
  activityCopy.append(activityTitle, activityDetail)
  activity.append(activityMarker, activityCopy)
  activity.setAttribute('role', 'status')
  activity.setAttribute('aria-live', 'polite')
  activity.setAttribute('aria-atomic', 'true')

  const outputSection = node(documentRef, 'section', '', 'live-workflow-output')
  const outputHeading = node(documentRef, 'div', '', 'live-workflow-output-heading')
  const outputTitle = node(documentRef, 'h3', 'Draft')
  const readiness = node(documentRef, 'span', 'Not ready', 'live-workflow-readiness')
  readiness.dataset.state = 'idle'
  outputHeading.append(outputTitle, readiness)
  const output = node(documentRef, 'div', 'Run the live workflow to stream a draft here.', 'live-workflow-draft')
  output.dataset.state = 'empty'
  output.setAttribute('aria-live', 'polite')
  const sourceNotes = node(documentRef, 'a', 'Review source notes (new tab)', 'button quiet small')
  sourceNotes.href = '#material/source-pack'
  sourceNotes.target = '_blank'
  sourceNotes.rel = 'noopener noreferrer'
  outputSection.append(outputHeading, output, sourceNotes)

  const traceDetails = node(documentRef, 'details', '', 'reference live-workflow-trace')
  traceDetails.open = role.id === 'engineer'
  traceDetails.append(node(documentRef, 'summary', role.id === 'engineer' ? 'Inspect events, permission scope, and tool IDs' : 'Inspect the event trace'))
  const traceMeta = node(documentRef, 'dl', '', 'api-metadata')
  const traceValues = {}
  for (const [key, label] of [
    ['trace', 'Application trace'],
    ['tool', 'Tool request'],
    ['sources', 'Source IDs'],
    ['stop', 'Stop reason'],
    ['model', 'Model'],
    ['provider', 'Provider requests']
  ]) {
    traceValues[key] = node(documentRef, 'dd', 'Not received')
    traceMeta.append(node(documentRef, 'dt', label), traceValues[key])
  }
  const traceLabel = node(documentRef, 'p', 'Named SSE events', 'code-label')
  const tracePre = node(documentRef, 'pre', '', 'code')
  tracePre.dataset.language = 'json'
  tracePre.append(node(documentRef, 'code', '[]'))
  traceDetails.append(traceMeta, traceLabel, tracePre)

  const resources = node(documentRef, 'div', '', 'actions live-workflow-resources')
  const guideLink = node(documentRef, 'a', 'Read the live workflow guide', 'button secondary')
  guideLink.href = '#material/live-stream-tool'
  const codeLink = node(documentRef, 'a', 'Inspect the reference code', 'button quiet')
  codeLink.href = '#material/live-stream-tool-code'
  resources.append(guideLink, codeLink)

  if (showRoleLinks) host.append(roleLinks)
  host.append(heading, intro)
  if (showRoleGoal) host.append(goal)
  host.append(boundary, controls, activity, outputSection, traceDetails, resources)

  function current(number) {
    return !destroyed && number === runNumber && host.isConnected
  }

  function setActivity(title, detail, state = 'active') {
    activity.dataset.state = state
    activityTitle.textContent = title
    activityDetail.textContent = detail
  }

  function setReadiness(label, state) {
    readiness.textContent = label
    readiness.dataset.state = state
  }

  function showPartial(text) {
    output.replaceChildren()
    output.className = 'live-workflow-draft live-workflow-plain-output'
    output.dataset.state = text ? 'partial' : 'empty'
    output.setAttribute('aria-live', 'off')
    output.textContent = text || 'No draft text was received.'
  }

  function resetRun() {
    runSettled = false
    traceValues.trace.textContent = 'Not received'
    traceValues.tool.textContent = 'Not received'
    traceValues.sources.textContent = 'Not received'
    traceValues.stop.textContent = 'Not received'
    traceValues.model.textContent = 'Not received'
    traceValues.provider.textContent = 'Not received'
    tracePre.textContent = '[]'
    output.className = 'live-workflow-draft live-workflow-plain-output'
    output.dataset.state = 'empty'
    output.textContent = ''
    setReadiness('Generating', 'active')
    setActivity('Request accepted by this page', role.running, 'active')
  }

  function finishControls() {
    running = false
    activeController = null
    abortReason = ''
    clearTimeout(runTimeout)
    runTimeout = null
    host.removeAttribute('aria-busy')
    runButton.disabled = !available
    runButton.textContent = 'Run live workflow'
  }

  async function admissionMessage(response) {
    try {
      const data = await response.json()
      return firstLine(data?.message, `The live workflow could not start (${response.status}).`)
    } catch {
      return `The live workflow could not start (${response.status}).`
    }
  }

  async function runWorkflow() {
    if (destroyed || running || !available) return
    const number = ++runNumber
    running = true
    abortReason = ''
    activeController = new AbortController()
    host.setAttribute('aria-busy', 'true')
    runButton.disabled = false
    runButton.textContent = 'Cancel run'
    runStatus.textContent = 'Starting one bounded live run. You can cancel at any time.'
    resetRun()

    const trace = []
    const state = {
      started: false,
      traceId: '',
      outputText: '',
      toolRequest: null,
      toolResult: null,
      terminal: ''
    }

    function updateTrace() {
      tracePre.textContent = JSON.stringify(trace, null, 2)
    }

    function recordEvent(name, data) {
      if (trace.length === MAX_TRACE_EVENTS) trace.shift()
      trace.push({ event: name, data })
      updateTrace()
    }

    function incomplete(message) {
      state.terminal = 'incomplete'
      runSettled = true
      showPartial(state.outputText)
      setReadiness(state.outputText ? 'Incomplete draft' : 'Not ready', 'incomplete')
      setActivity('Workflow incomplete', message, 'error')
      runStatus.textContent = `Review is blocked. ${fallback} remains available.`
    }

    function handleEvent(name, payload) {
      if (!current(number)) return
      if (state.terminal) return
      const data = jsonObject(payload)
      if (!data) throw eventError(`The ${name} event did not contain a JSON object.`)
      recordEvent(name, data)

      if (name === 'run_start') {
        if (state.started || data.role_id !== role.roleId || data.review_required !== true || typeof data.trace_id !== 'string' || !data.trace_id || typeof data.account_id !== 'string' || !data.account_id) {
          throw eventError('The run_start event did not match this role and review boundary.')
        }
        state.started = true
        state.traceId = firstLine(data.trace_id, '')
        traceValues.trace.textContent = state.traceId || 'Not supplied'
        setActivity('Workflow started', 'Waiting for the fixed read-only tool request.', 'active')
        return
      }

      if (name === 'tool_request') {
        if (!state.started || state.toolRequest || data.name !== TOOL_NAME || typeof data.id !== 'string' || !jsonObject(data.input)) {
          throw eventError('The tool request was missing its fixed name, ID, or input.')
        }
        state.toolRequest = data
        traceValues.tool.textContent = `${data.name} · ${data.id}`
        setActivity('Read-only tool requested', role.id === 'engineer' ? `${data.name} · ${data.id}` : 'Reading the fixed synthetic Northstar record.', 'active')
        return
      }

      if (name === 'tool_result') {
        if (!state.toolRequest || state.toolResult || data.name !== TOOL_NAME || data.tool_use_id !== state.toolRequest.id || !Object.hasOwn(data, 'result') || !Array.isArray(data.source_ids)) {
          throw eventError('The tool result did not match the requested read-only lookup.')
        }
        state.toolResult = data
        traceValues.sources.textContent = data.source_ids.length ? data.source_ids.join(', ') : 'None supplied'
        setActivity('Northstar record returned', role.id === 'engineer' ? `Matched tool ID ${data.tool_use_id}. Waiting for final text.` : 'Source IDs received. Waiting for the final draft.', 'active')
        return
      }

      if (name === 'text_delta') {
        if (!state.toolResult || typeof data.text !== 'string') throw eventError('Final text arrived before the read-only tool result.')
        if (state.outputText.length + data.text.length > MAX_OUTPUT_CHARACTERS) throw eventError('The draft exceeded the live workflow display limit.')
        state.outputText += data.text
        showPartial(state.outputText)
        setActivity('Streaming final draft', role.running, 'active')
        return
      }

      if (name === 'status') {
        setActivity(firstLine(data.stage, 'Workflow update', 80), firstLine(data.message, role.running), 'active')
        return
      }

      if (name === 'trace') return

      if (name === 'error') {
        const message = firstLine(data.message, 'The live stream reported an error.')
        incomplete(message)
        return
      }

      if (name === 'complete') {
        const validation = validateWorkflowComplete(data, state)
        traceValues.stop.textContent = firstLine(data.stop_reason, 'Not supplied')
        traceValues.model.textContent = firstLine(data.model, 'Not supplied')
        traceValues.provider.textContent = Array.isArray(data.provider_request_ids) ? data.provider_request_ids.join(', ') : 'Not received'
        if (!validation.valid) {
          incomplete(`Terminal evidence was missing: ${validation.missing.join(', ')}.`)
          return
        }
        state.terminal = 'complete'
        runSettled = true
        output.replaceChildren()
        output.className = 'live-workflow-draft live-workflow-markdown-output'
        output.dataset.state = 'complete'
        output.setAttribute('aria-live', 'polite')
        renderMarkdown(output, state.outputText)
        setReadiness('Draft ready for review', 'ready')
        setActivity('Terminal event verified', role.complete, 'ready')
        runStatus.textContent = 'Live run complete. Human review is still required.'
      }
    }

    try {
      runTimeout = setTimeout(() => {
        if (!current(number) || !running) return
        abortReason = 'timeout'
        activeController?.abort()
      }, 65_000)
      const response = await fetch(WORKFLOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: role.roleId }),
        signal: activeController.signal,
        cache: 'no-store'
      })
      if (!current(number)) return
      if (!response.ok) {
        const message = await admissionMessage(response)
        if (!current(number)) return
        setReadiness('Not ready', 'incomplete')
        setActivity('Run did not start', message, 'error')
        runStatus.textContent = `No live draft was created. Use ${fallback} or try again later.`
        return
      }
      if (!response.body || !String(response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream')) {
        throw eventError('The server did not return a live event stream.')
      }

      const decoder = createSseDecoder(({ event, data }) => {
        let payload
        try { payload = JSON.parse(data) }
        catch { throw eventError(`The ${event} event contained invalid JSON.`) }
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
        incomplete(parserState.incomplete
          ? 'The stream ended in the middle of an event. Partial text is preserved.'
          : 'The stream ended before the complete event. Partial text is preserved.')
      }
    } catch (error) {
      if (!current(number)) return
      if (error?.name === 'AbortError') {
        const message = abortReason === 'timeout'
          ? 'The live run exceeded its time limit. Partial text is preserved.'
          : abortReason === 'mode-change'
            ? 'Live demo hidden. Run cancelled. Partial text is preserved.'
            : 'Run cancelled. Partial text is preserved.'
        incomplete(message)
      } else {
        incomplete(firstLine(error?.message, 'The live stream could not be read. Partial text is preserved.'))
      }
    } finally {
      if (current(number)) finishControls()
    }
  }

  function cancel(reason = 'cancelled') {
    if (destroyed || !running || runSettled || !activeController) return false
    abortReason = reason
    runButton.disabled = true
    runButton.textContent = 'Cancelling…'
    runStatus.textContent = 'Cancelling this run. No retry will start.'
    activeController.abort()
    return true
  }

  runButton.addEventListener('click', () => {
    if (!running) {
      runWorkflow()
      return
    }
    cancel()
  })

  fetch('/api/demo', {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
    signal: capabilityController.signal
  }).then(async response => {
    const data = await response.json()
    if (destroyed) return
    available = response.ok && capabilityReady(data, role)
    runButton.disabled = !available
    runStatus.textContent = available
      ? 'Live is available. Each run makes two bounded API calls.'
      : `Live is unavailable. Use ${fallback}.`
  }).catch(() => {
    if (destroyed) return
    available = false
    runButton.disabled = true
    runStatus.textContent = `Live is unavailable. Use ${fallback}.`
  })

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
    }
  }
}
