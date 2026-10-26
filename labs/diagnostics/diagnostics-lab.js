const PACKETS_URL = '/materials/diagnostic-reference-packets.json'
const DEFAULT_CASE = 'healthy_text_renewal'

const PERSONAS = Object.freeze({
  engineer: Object.freeze({
    label: 'Engineer',
    goal: 'Locate the last confirmed boundary, then choose one check that separates the next plausible causes.',
    check: 'Name the component boundary, the evidence already present, and the single check that would change your diagnosis.',
    boundaryLabel: 'Last confirmed boundary and component',
    nextLabel: 'One discriminating check',
    repairLabel: 'Repair and customer-visible verification',
    rejoin: 'Rejoin when you can locate the first unconfirmed boundary and explain the check that distinguishes it.'
  }),
  architect: Object.freeze({
    label: 'Architect',
    goal: 'Assign ownership at the failing boundary, set a bounded deadline, and preserve a recovery path.',
    check: 'Name the owner, deadline, recovery state, and evidence required before the workflow may advance.',
    boundaryLabel: 'Last confirmed boundary and owner',
    nextLabel: 'One discriminating check and its deadline',
    repairLabel: 'Recovery plan and customer-visible verification',
    rejoin: 'Rejoin when ownership, deadline, recovery, and verification are explicit.'
  }),
  business: Object.freeze({
    label: 'Business',
    goal: 'State whether the team is waiting, has a draft to review, or has a confirmed account action.',
    check: 'State what a customer may be told now, what remains unconfirmed, and which receipt would change that status.',
    boundaryLabel: 'What can the account team say now?',
    nextLabel: 'What evidence is still needed, and who should check it?',
    repairLabel: 'Next action and how you would confirm the result',
    rejoin: 'Rejoin when the status and customer-facing statement match the available evidence.'
  })
})

const CASE_LABELS = Object.freeze({
  healthy_text_renewal: 'Healthy text',
  pings_only_no_progress: 'Pings only',
  backend_delta_browser_gap: 'Relay gap',
  browser_delta_ui_filter: 'UI filter',
  duplicated_cumulative_snapshots: 'Duplicate snapshots',
  sse_error_after_http_200: 'SSE error',
  partial_tool_json_max_tokens: 'Partial tool JSON',
  tool_write_confirmed_final_stream_lost: 'Write confirmed'
})

const PLAIN_EXPLANATIONS = Object.freeze({
  healthy_text_renewal: 'Treat streaming as a custody chain. Each component must preserve event order, content, and terminal evidence.',
  pings_only_no_progress: 'Connection activity and answer progress are different signals. A heartbeat carries no answer content.',
  backend_delta_browser_gap: 'Compare adjacent custody points before changing downstream code. Find the first handoff without matching evidence.',
  browser_delta_ui_filter: 'Browser delivery and visible UI state are separate checkpoints. Preserve event type, delta type, and block index between them.',
  duplicated_cumulative_snapshots: 'A relay field must mean either an incremental delta or a replacement snapshot. Producer and consumer must share that contract.',
  sse_error_after_http_200: 'An initial HTTP success can begin a stream that later fails. Classify the attempt from its terminal stream evidence.',
  partial_tool_json_max_tokens: 'Buffer tool input fragments until the block closes. Parse, validate, authorize, and inspect the stop reason before dispatch.',
  tool_write_confirmed_final_stream_lost: 'A business side effect and its final explanation have separate receipts. Reconcile the write before deciding whether a retry is safe.'
})

const BUSINESS_VALUES = Object.freeze({
  healthy_text_renewal: 'A complete custody trail supports a truthful draft-ready state without implying that a customer action occurred.',
  pings_only_no_progress: 'The interface can say waiting without inventing percent complete or telling a customer that work finished.',
  backend_delta_browser_gap: 'A precise relay diagnosis shortens recovery while keeping the customer-facing state honest.',
  browser_delta_ui_filter: 'The team can repair presentation without repeating model work or changing approved source content.',
  duplicated_cumulative_snapshots: 'A clear relay contract prevents duplicated text from reaching a renewal brief or customer message.',
  sse_error_after_http_200: 'Partial output stays visibly incomplete, so a fragment is not mistaken for a reviewed draft.',
  partial_tool_json_max_tokens: 'Incomplete arguments cannot trigger an account action. Authorization and dispatch remain separate proof points.',
  tool_write_confirmed_final_stream_lost: 'The team avoids a duplicate write while reporting the action as confirmed and the final explanation as incomplete.'
})

function node(documentRef, tagName, { className = '', text = '', attributes = {} } = {}) {
  const element = documentRef.createElement(tagName)
  if (className) element.className = className
  if (text !== '') element.textContent = text
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) element.setAttribute(name, String(value))
  }
  return element
}

function heading(documentRef, parent, level, text) {
  parent.append(node(documentRef, `h${level}`, { text }))
}

function paragraph(documentRef, parent, text, className = '') {
  parent.append(node(documentRef, 'p', { text, className }))
}

function stringValue(value) {
  return typeof value === 'string' ? value : ''
}

function normalizeAnswers(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const answers = {}
  for (const [caseId, answer] of Object.entries(value)) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) continue
    answers[caseId] = {
      lastConfirmedBoundary: stringValue(answer.lastConfirmedBoundary),
      discriminatingCheck: stringValue(answer.discriminatingCheck),
      repairAndVerification: stringValue(answer.repairAndVerification)
    }
  }
  return answers
}

function normalizeRevealed(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, revealed]) => revealed === true))
}

function snapshot(state) {
  return {
    caseId: state.caseId,
    answers: Object.fromEntries(
      Object.entries(state.answers).map(([caseId, answer]) => [caseId, { ...answer }])
    ),
    revealed: { ...state.revealed }
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.artifact) throw new Error('Diagnostic artifact metadata is missing.')
  if (!Array.isArray(payload.packets) || payload.packets.length !== 8) throw new Error('Expected eight diagnostic packets.')
  const fields = [
    'id', 'title', 'learner_prompt', 'observed_evidence', 'last_confirmed_boundary',
    'next_discriminating_check', 'expected_reference_result', 'recovery', 'verification'
  ]
  for (const packet of payload.packets) {
    if (!packet || typeof packet !== 'object') throw new Error('A diagnostic packet is invalid.')
    for (const field of fields) {
      if (!(field in packet)) throw new Error(`Diagnostic packet is missing ${field}.`)
    }
    if (!Array.isArray(packet.observed_evidence)) throw new Error('Diagnostic evidence must be a list.')
  }
  return payload
}

function renderHelp(documentRef, host, profile) {
  const intro = node(documentRef, 'section', { className: 'diagnostic-intro' })
  const goal=node(documentRef,'p',{className:'lesson-outcome'})
  goal.append(node(documentRef,'strong',{text:'Your goal'}),documentRef.createTextNode(' '+profile.goal))
  intro.append(goal)

  const details = node(documentRef, 'details', { className: 'reference' })
  details.append(node(documentRef, 'summary', { text: 'Streaming evidence reminders' }))
  const list = node(documentRef, 'ul')
  const reminders = [
    'SSE event frames are not network reads. Preserve TextDecoder state and every unparsed tail across reads.',
    'Track first byte, first complete event, delta, relay, browser receipt, state update, UI render, message_stop, and EOF separately.',
    'Keep application trace labels, API request IDs, tool_use IDs, and operation or idempotency keys separate.',
    'Pings prove connection activity. They do not prove answer or business progress.',
    'After a tool write, reconcile the authoritative receipt before retrying. A confirmed action and a lost final explanation are different states.'
  ]
  for (const reminder of reminders) list.append(node(documentRef, 'li', { text: reminder }))
  details.append(list)
  details.append(node(documentRef,'a',{text:'Compare hooks with application tool dispatch',attributes:{href:'#material/hooks-lab'}}))
  intro.append(details)
  host.append(intro)
}

function businessEvidence(documentRef, parent, packet) {
  const facts={
    healthy_text_renewal: 'The application and browser received Ren, then ewal. The screen displayed Renewal once. A normal response ending was recorded.',
    pings_only_no_progress: 'The connection opened and three connection signals arrived. This excerpt contains no answer text or final response ending.',
    backend_delta_browser_gap: 'The application received Renewal and attempted to relay it. The browser received response headers but no stream events. The relay flush outcome was not recorded.',
    browser_delta_ui_filter: 'The browser received Ren and ewal. The visible text stayed empty. The event adapter recorded that it discarded both updates.',
    duplicated_cumulative_snapshots: 'The browser received cumulative updates Ren and Renewal. The screen displayed RenRenewal.',
    sse_error_after_http_200: 'The service accepted the request and began a partial answer. It then reported an overloaded error. A final response ending was not recorded.',
    partial_tool_json_max_tokens: 'The proposed account action has incomplete input. The dispatcher rejected it and recorded zero actions.',
    tool_write_confirmed_final_stream_lost: 'The account system confirms one saved change at revision 17. Its receipt was returned. The final explanation connection ended without a confirmed response ending.'
  }
  heading(documentRef,parent,4,'Evidence for the account team')
  paragraph(documentRef,parent,facts[packet.id]||packet.learner_prompt)
  const details=node(documentRef,'details',{className:'reference'})
  details.append(node(documentRef,'summary',{text:'Inspect the technical timeline (optional)'}))
  renderEvidence(documentRef,details,packet)
  parent.append(details)
}

function renderEvidence(documentRef, parent, packet) {
  const section = node(documentRef, 'section')
  heading(documentRef, section, 4, 'Evidence demonstration')
  paragraph(documentRef, section, 'Synthetic timeline. Every timestamp and identifier is a fictional teaching label.', 'small muted')
  const timeline = node(documentRef, 'ol', { className: 'diagnostic-timeline' })
  for (const evidence of packet.observed_evidence) {
    const item = node(documentRef, 'li', { className: 'diagnostic-event' })
    item.append(node(documentRef, 'time', { text: stringValue(evidence.timestamp) }))
    item.append(node(documentRef, 'strong', { text: stringValue(evidence.component) }))
    paragraph(documentRef, item, stringValue(evidence.event))
    if (stringValue(evidence.excerpt_status)) {
      paragraph(documentRef, item, `Excerpt status: ${evidence.excerpt_status}`, 'small muted')
    }
    timeline.append(item)
  }
  section.append(timeline)
  parent.append(section)
}

function renderDisplayRepair(documentRef, parent, packet) {
  const fixtures = {
    healthy_text_renewal: { label: 'incremental deltas', payloads: ['Ren', 'ewal'] },
    duplicated_cumulative_snapshots: { label: 'cumulative snapshots', payloads: ['Ren', 'Renewal'] }
  }
  const fixture = fixtures[packet.id]
  if (!fixture) return
  const section = node(documentRef, 'section', { className: 'reference' })
  heading(documentRef, section, 4, 'Test a display repair')
  paragraph(documentRef, section, `Prepared parsed ${fixture.label}: ${JSON.stringify(fixture.payloads)}. These are not network chunks.`)
  const fieldset = node(documentRef, 'fieldset')
  fieldset.append(node(documentRef, 'legend', { text: 'Display handler' }))
  const name = `diagnostic-display-${packet.id}`
  for (const [value, label] of [['append', 'Append each payload'], ['replace', 'Replace with each payload']]) {
    const id = `${name}-${value}`
    const input = node(documentRef, 'input', { attributes: { id, name, type: 'radio', value } })
    if (value === 'append') input.checked = true
    fieldset.append(input, node(documentRef, 'label', { text: label, attributes: { for: id } }))
  }
  const result = node(documentRef, 'p', { className: 'small', attributes: { role: 'status' } })
  const test = node(documentRef, 'button', { className: 'button quiet', text: 'Test this display handler', attributes: { type: 'button' } })
  test.addEventListener('click', () => {
    const selected = fieldset.querySelector('input:checked')
    const actual = selected && selected.value === 'replace'
      ? fixture.payloads[fixture.payloads.length - 1]
      : fixture.payloads.join('')
    result.textContent = `Actual visible text: ${actual}. Expected visible text: Renewal.`
  })
  section.append(fieldset, test, result)
  parent.append(section)
}

function textarea(documentRef, parent, { id, label, value, onInput }) {
  const labelNode = node(documentRef, 'label', {
    className: 'exercise-label',
    text: label,
    attributes: { for: id }
  })
  const input = node(documentRef, 'textarea', {
    attributes: { id, name: id, rows: 3, maxlength: 4000, spellcheck: 'true' }
  })
  input.value = value
  input.addEventListener('input', () => onInput(input.value))
  parent.append(labelNode, input)
}

function referenceField(documentRef, list, label, value) {
  list.append(node(documentRef, 'dt', { text: label }))
  list.append(node(documentRef, 'dd', { text: stringValue(value) }))
}

function revealReference(documentRef, container, packet, profile, backHref) {
  const list = node(documentRef, 'dl')
  referenceField(documentRef, list, 'Last confirmed boundary', packet.last_confirmed_boundary)
  referenceField(documentRef, list, 'Next discriminating check', packet.next_discriminating_check)
  referenceField(documentRef, list, 'Expected reference result', packet.expected_reference_result)
  referenceField(documentRef, list, 'Recovery', packet.recovery)
  referenceField(documentRef, list, 'Verification', packet.verification)
  if(packet.id==='duplicated_cumulative_snapshots')referenceField(documentRef,list,'Match the replay to the repair','For cumulative snapshots, replace Ren with Renewal. For incremental deltas, append Ren then ewal. Both contracts should end at Renewal once.')
  container.append(list)
  heading(documentRef, container, 5, 'Exact rejoin point')
  paragraph(documentRef, container, profile.rejoin)
  container.append(node(documentRef, 'a', {
    className: 'button secondary',
    text: 'Return to practice',
    attributes: { href: backHref }
  }))
}

function renderLearningCheck(documentRef, parent, packet, profile, state, emitChange) {
  const section = node(documentRef, 'section')
  heading(documentRef, section, 4, 'Learning check')
  paragraph(documentRef, section, profile.check)
  paragraph(documentRef, section, 'Use your own words. The lab saves responses for review and does not grade them automatically.', 'small muted')
  const form = node(documentRef, 'div', { className: 'diagnostic-form' })
  const answer = state.answers[packet.id] || {
    lastConfirmedBoundary: '',
    discriminatingCheck: '',
    repairAndVerification: ''
  }
  state.answers[packet.id] = answer
  const update = (field, value) => {
    state.answers[packet.id] = { ...state.answers[packet.id], [field]: value }
    emitChange()
  }
  textarea(documentRef, form, {
    id: `diagnostic-${packet.id}-boundary`,
    label: profile.boundaryLabel,
    value: answer.lastConfirmedBoundary,
    onInput: value => update('lastConfirmedBoundary', value)
  })
  textarea(documentRef, form, {
    id: `diagnostic-${packet.id}-check`,
    label: profile.nextLabel,
    value: answer.discriminatingCheck,
    onInput: value => update('discriminatingCheck', value)
  })
  textarea(documentRef, form, {
    id: `diagnostic-${packet.id}-repair`,
    label: profile.repairLabel,
    value: answer.repairAndVerification,
    onInput: value => update('repairAndVerification', value)
  })
  section.append(form)
  parent.append(section)
}

function renderCase(documentRef, host, packet, profile, state, emitChange, backHref) {
  host.replaceChildren()
  const article = node(documentRef, 'article', { className: 'diagnostic-case' })
  heading(documentRef, article, 3, packet.title)
  paragraph(documentRef, article, 'Prepared synthetic evidence packet.', 'small muted')

  const task = node(documentRef, 'section')
  heading(documentRef, task, 4, 'Task')
  paragraph(documentRef, task, profile.label==='Business'?'Use these signals to decide what the account team can say. Name what remains unconfirmed and who should check it.':packet.learner_prompt)
  article.append(task)

  const explanation = node(documentRef, 'section')
  heading(documentRef, explanation, 4, 'Plain explanation')
  paragraph(documentRef, explanation, profile.label==='Business'?'A draft arriving and an account action completing are separate observations. Match each claim to the evidence you have.':PLAIN_EXPLANATIONS[packet.id] || 'Follow adjacent evidence boundaries and preserve unknowns.')
  article.append(explanation)

  if(profile.label==='Business')businessEvidence(documentRef,article,packet)
  else {renderEvidence(documentRef, article, packet);renderDisplayRepair(documentRef, article, packet)}

  const value = node(documentRef, 'section')
  heading(documentRef, value, 4, 'Business value')
  paragraph(documentRef, value, BUSINESS_VALUES[packet.id] || 'A precise boundary keeps the customer-facing state truthful.')
  article.append(value)

  renderLearningCheck(documentRef, article, packet, profile, state, emitChange)

  const reference = node(documentRef, 'section', { className: 'reference' })
  heading(documentRef, reference, 4, 'Completed reference and rejoin')
  paragraph(documentRef, reference, 'Reveal this after writing your learning-check response.', 'small muted')
  const referenceBody = node(documentRef, 'div', { attributes: { id: `diagnostic-${packet.id}-reference` } })
  const reveal = node(documentRef, 'button', {
    className: 'button quiet',
    text: 'Reveal completed reference',
    attributes: {
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': referenceBody.id
    }
  })
  const showReference = (persist = true) => {
    if (reveal.getAttribute('aria-expanded') === 'true') return
    revealReference(documentRef, referenceBody, packet, profile, backHref)
    reveal.setAttribute('aria-expanded', 'true')
    reveal.textContent = 'Completed reference revealed'
    reveal.disabled = true
    if (persist) {
      state.revealed[packet.id] = true
      emitChange()
    }
  }
  reveal.addEventListener('click', () => showReference(true))
  reference.append(reveal, referenceBody)
  article.append(reference)
  if (state.revealed[packet.id] === true) showReference(false)

  if (stringValue(packet.optional_changed_case)) {
    const changed = node(documentRef, 'section')
    heading(documentRef, changed, 4, 'Changed case')
    paragraph(documentRef, changed, packet.optional_changed_case)
    article.append(changed)
  }
  host.append(article)
}

function renderChooser(documentRef, parent, packets, state, onSelect) {
  const section = node(documentRef, 'section', { className: 'spaced' })
  heading(documentRef, section, 3, 'Choose a case')
  paragraph(documentRef, section, 'Work one evidence chain at a time.', 'small muted')
  const group = node(documentRef, 'div', {
    className: 'diagnostic-cases',
    attributes: { role: 'group', 'aria-label': 'Choose a synthetic diagnostic case' }
  })
  const buttons = new Map()
  for (const packet of packets) {
    const button = node(documentRef, 'button', {
      text: CASE_LABELS[packet.id] || packet.title,
      attributes: { type: 'button', 'aria-pressed': packet.id === state.caseId ? 'true' : 'false' }
    })
    button.addEventListener('click', () => {
      for (const [caseId, caseButton] of buttons) {
        caseButton.setAttribute('aria-pressed', caseId === packet.id ? 'true' : 'false')
      }
      onSelect(packet)
    })
    buttons.set(packet.id, button)
    group.append(button)
  }
  section.append(group)
  parent.append(section)
}

export function mountDiagnosticsLab(host, {
  persona = 'engineer',
  saved = {},
  onChange = () => {},
  backHref = '#together'
} = {}) {
  if (!host || typeof host.replaceChildren !== 'function') {
    throw new TypeError('mountDiagnosticsLab requires a DOM host element.')
  }
  const documentRef = host.ownerDocument
  const view = documentRef.defaultView || globalThis
  const profileId = Object.prototype.hasOwnProperty.call(PERSONAS, persona) ? persona : 'engineer'
  const profile = PERSONAS[profileId]
  const returnHref = typeof backHref === 'string' && backHref.startsWith('#') ? backHref : '#together'
  const state = {
    caseId: stringValue(saved && saved.caseId) || DEFAULT_CASE,
    answers: normalizeAnswers(saved && saved.answers),
    revealed: normalizeRevealed(saved && saved.revealed)
  }
  let active = true
  const controller = typeof AbortController === 'function' ? new AbortController() : null

  host.className = 'diagnostics-lab'
  host.replaceChildren()
  renderHelp(documentRef, host, profile)
  const status = node(documentRef, 'p', {
    className: 'small muted',
    text: 'Loading eight reviewed synthetic cases...',
    attributes: { role: 'status' }
  })
  const content = node(documentRef, 'div')
  host.append(status, content)

  const emitChange = () => {
    if (typeof onChange === 'function') onChange(snapshot(state))
  }

  const showError = error => {
    if (!active) return
    content.replaceChildren()
    status.textContent = 'The diagnostic cases could not be loaded.'
    const message = node(documentRef, 'p', {
      className: 'notice',
      text: error instanceof Error ? error.message : 'Unknown loading error.'
    })
    const retry = node(documentRef, 'button', {
      className: 'button secondary',
      text: 'Retry loading cases',
      attributes: { type: 'button' }
    })
    retry.addEventListener('click', () => {
      retry.disabled = true
      status.textContent = 'Loading eight reviewed synthetic cases...'
      loadPackets()
    })
    content.append(message, retry)
  }

  const showPackets = payload => {
    if (!active) return
    const packets = payload.packets
    if (!packets.some(packet => packet.id === state.caseId)) state.caseId = DEFAULT_CASE
    status.textContent = ''
    content.replaceChildren()
    content.append(node(documentRef, 'p', {
      className: 'notice',
      text: 'Eight synthetic cases. Times, IDs, results, and failures are teaching examples, not API measurements.'
    }))
    const caseHost = node(documentRef, 'div')
    const select = packet => {
      state.caseId = packet.id
      renderCase(documentRef, caseHost, packet, profile, state, emitChange, returnHref)
      emitChange()
    }
    renderChooser(documentRef, content, packets, state, select)
    content.append(caseHost)
    renderCase(
      documentRef,
      caseHost,
      packets.find(packet => packet.id === state.caseId) || packets[0],
      profile,
      state,
      emitChange,
      returnHref
    )
  }

  const loadPackets = () => {
    const fetchImpl = typeof view.fetch === 'function' ? view.fetch.bind(view) : globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      showError(new Error('This browser cannot load the diagnostic packet file.'))
      return
    }
    const options = { headers: { Accept: 'application/json' } }
    if (controller) options.signal = controller.signal
    fetchImpl(PACKETS_URL, options)
      .then(response => {
        if (!response.ok) throw new Error(`Diagnostic packet request failed with status ${response.status}.`)
        return response.json()
      })
      .then(validatePayload)
      .then(showPackets)
      .catch(error => {
        if (error && error.name === 'AbortError') return
        showError(error)
      })
  }

  loadPackets()
  return {
    destroy() {
      active = false
      if (controller) controller.abort()
      host.replaceChildren()
    }
  }
}
