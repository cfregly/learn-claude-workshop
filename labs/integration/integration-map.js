const GITHUB_ROOT = 'https://github.com/cfregly/learn-claude-workshop'

const envelope = {
  method: 'POST',
  url: 'https://api.anthropic.com/v1/messages',
  headers: {
    Authorization: 'Bearer SERVER_KEY_PLACEHOLDER',
    'anthropic-version': '2026-10-21',
    'content-type': 'application/json'
  },
  body: {
    model: 'ACCOUNT_ENABLED_MODEL',
    max_tokens: 350,
    system: 'Use only the supplied synthetic records. Preserve source labels. Keep unsupported claims unknown.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Prepare the reviewed Northstar renewal brief.',
              '',
              '[CRM] Northstar Freight renews on January 31, 2027. Maya Chen is the account owner.',
              '[CALL] SSO entitlement is unknown. A 12 percent discount was discussed but not approved.',
              '[SUPPORT CASE 4821] Delayed shipment-alert emails remain open.',
              '[USAGE] Weekly active users are 64, down from 78 in the prior period.'
            ].join('\n')
          }
        ]
      }
    ]
  }
}

const steps = [
  {
    id: 'identity',
    label: '1 Access',
    title: 'Check caller and account access before context',
    engineer: 'The CLI caller is a synthetic identity fixture. A production backend derives identity from its authenticated session, then runs check_account_access before reading Northstar records.',
    business: 'Confirm who is asking and whether that person may see Northstar before loading account facts.',
    artifacts: [
      ['Source pack', '#material/source-pack'],
      ['Runnable client', '#material/api-client']
    ],
    failure: 'The backend loads account context before it proves that the caller may read Northstar.',
    check: 'Use the no-access synthetic caller and confirm records_selected stays at zero before any context is attached.',
    expected: 'Only an authenticated application caller with Northstar access can select the approved records.'
  },
  {
    id: 'credential',
    label: '2 Credential',
    title: 'Load the credential in the backend environment',
    engineer: 'make_live_call reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL only in the learner backend process. The request timeout is 30 seconds.',
    business: 'The server owns the credential and model choice. The browser never receives the secret.',
    artifacts: [
      ['Runnable client', '#material/api-client'],
      ['Client source', 'github:labs/claude_api_demo.py']
    ],
    failure: 'A key reaches browser state, page text, request examples, or logs, or the backend starts without the required environment values.',
    check: 'Inspect the backend environment lookup and confirm the DOM and placeholder envelope contain no real key.',
    expected: 'The backend supplies the account-enabled model and credential while the browser sees neither secret.'
  },
  {
    id: 'request',
    label: '3 Request',
    title: 'Build the bounded Messages request',
    engineer: 'POST one typed text request to the Messages endpoint with the current version header, approved records, and max_tokens 350.',
    business: 'Send only the approved Northstar records in a small request with a clear output limit.',
    artifacts: [
      ['Runnable client', '#material/api-client'],
      ['Client source', 'github:labs/claude_api_demo.py']
    ],
    failure: 'The endpoint, version, model, output limit, or typed content no longer matches the runnable client.',
    check: 'Compare the envelope with API_URL, API_VERSION, MAX_TOKENS, and build_payload in the pinned client source.',
    expected: 'The backend sends one bounded typed-text request with source labels and no browser-held credential.',
    envelope: true
  },
  {
    id: 'response',
    label: '4 Response',
    title: 'Parse typed response, errors, and completion',
    engineer: 'Iterate every content block with type text, classify HTTP, network, and JSON failures, and keep stop_reason separate from source review.',
    business: 'Keep all returned text, show failures plainly, and review the draft before anyone uses it.',
    artifacts: [
      ['Notebook', '#material/notebook'],
      ['Notebook source', 'github:labs/api-trace.ipynb'],
      ['Failure lab', '#diagnose']
    ],
    failure: 'The handler reads only the first block, treats HTTP 200 as completion, or presents a finished response as an approved business brief.',
    check: 'Inspect typed_text_blocks, error output, request ID, stop reason, and the required source-review state.',
    expected: 'Typed text is preserved, failures remain visible, and protocol completion does not bypass human review.'
  },
  {
    id: 'tools',
    label: '5 Tool loop',
    title: 'Validate the allowed tool loop',
    engineer: 'Treat tool_use as a request. Validate complete input, caller and account permission, the allowed tool list, and the matching tool_use.id before returning tool_result.',
    business: 'A proposed action is not an executed action. The application checks permission before it runs anything.',
    artifacts: [
      ['Prepared trace', '#streaming'],
      ['Notebook', '#material/notebook']
    ],
    failure: 'Partial input or a proposed tool call runs automatically, or a result is paired with a block index instead of the actual tool ID.',
    check: 'Trace one prepared tool request through validation, execution, preserved assistant blocks, and a result with the matching ID.',
    expected: 'Only an application-approved tool runs. The runnable Python text client itself executes no tools.'
  },
  {
    id: 'visible',
    label: '6 Visible UI',
    title: 'Trace relay, browser, state, and visible UI',
    engineer: 'Compare parsed events at the backend relay, browser receipt, reducer state, and visible output under one application trace.',
    business: 'Follow the answer from the server to the screen and stop at the first place where the evidence changes.',
    artifacts: [
      ['Streaming trace', '#streaming/engineer'],
      ['Failure lab', '#diagnose'],
      ['Reducer source', 'github:labs/diagnostics/diagnostics-lab.js']
    ],
    failure: 'A backend-to-browser gap is confused with a browser-to-UI fault, or a cumulative snapshot is appended as though it were a delta.',
    check: 'Compare relay events, browser events, block state, visible text, and the terminal state without skipping a boundary.',
    expected: 'Text appears once in the right block, and interrupted or failed attempts remain visibly incomplete.'
  },
  {
    id: 'review',
    label: '7 Review',
    title: 'Complete source review and the account decision',
    engineer: 'Pass the draft, source labels, completion state, and safe diagnostics into the shared review bridge without triggering an account action.',
    business: 'Check the draft against CRM, call, support, and usage records. Decide whether it is ready or who must resolve each unknown.',
    artifacts: [
      ['Source pack', '#material/source-pack'],
      ['Failure lab', '#diagnose']
    ],
    failure: 'The unapproved discount or unknown SSO entitlement becomes a fact, or response completion is treated as an Account Executive decision.',
    check: 'Verify required fields and sources, keep unsupported claims unknown, and name the owner and next action for every gap.',
    expected: 'Maya Chen or the designated Account Executive either approves the source-checked draft for planning or holds it with a named next step.'
  }
]

function element(documentRef, tag, text = '', className = '') {
  const node = documentRef.createElement(tag)
  node.textContent = text
  if (className) node.className = className
  return node
}

function githubUrl(path, githubRef) {
  const ref = encodeURIComponent(String(githubRef || 'main'))
  const safePath = path.split('/').map(part => encodeURIComponent(part)).join('/')
  return `${GITHUB_ROOT}/blob/${ref}/${safePath}`
}

function appendLink(documentRef, parent, label, href, githubRef) {
  const target = href.startsWith('github:') ? githubUrl(href.slice(7), githubRef) : href
  const link = element(documentRef, 'a', label)
  link.href = target
  if (href.startsWith('github:')) {
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
  }
  parent.append(link)
}

function appendFact(documentRef, parent, label, text) {
  const row = element(documentRef, 'p')
  const name = element(documentRef, 'strong', `${label}: `)
  row.append(name, documentRef.createTextNode(text))
  parent.append(row)
}

function normalizeSelectedStep(selectedStep, fallback) {
  if (typeof selectedStep === 'number' && Number.isInteger(selectedStep)) {
    return steps[selectedStep - 1]?.id || fallback
  }
  if (typeof selectedStep === 'string' && steps.some(step => step.id === selectedStep)) {
    return selectedStep
  }
  return fallback
}

function renderPanel(documentRef, panel, step, role, githubRef) {
  panel.replaceChildren()
  panel.setAttribute('aria-label', step.title)
  const heading = element(documentRef, 'h3', step.title)
  const summary = element(documentRef, 'p', role === 'business' ? step.business : step.engineer)
  const references = element(documentRef, 'p', '', 'reference small')
  references.append(element(documentRef, 'strong', 'Artifact: '))
  step.artifacts.forEach(([label, href], index) => {
    if (index) references.append(documentRef.createTextNode(' · '))
    appendLink(documentRef, references, label, href, githubRef)
  })
  panel.append(heading, summary, references)
  appendFact(documentRef, panel, 'Failure', step.failure)
  appendFact(documentRef, panel, 'Check', step.check)
  appendFact(documentRef, panel, 'Expected result', step.expected)

  if (step.envelope) {
    const details = element(documentRef, 'details', '', 'reference')
    details.append(element(documentRef, 'summary', 'Inspect HTTP envelope'))
    const pre = element(documentRef, 'pre')
    const code = element(documentRef, 'code', JSON.stringify(envelope, null, 2))
    pre.append(code)
    details.append(pre)
    panel.append(details)
  }
}

export function mountIntegrationMap(host, { githubRef, role = 'engineer', selectedStep } = {}) {
  if (!host || typeof host.replaceChildren !== 'function') {
    throw new TypeError('mountIntegrationMap requires a DOM host element.')
  }
  const documentRef = host.ownerDocument
  const viewRole = role === 'business' ? 'business' : 'engineer'
  let activeStep = normalizeSelectedStep(selectedStep, viewRole === 'business' ? 'review' : 'identity')

  host.classList.add('integration-map')
  host.replaceChildren()

  const intro = element(
    documentRef,
    'p',
    'The runnable Python client is a text-only direct Messages API example. It does not stream or execute tools. Streaming and tool steps below use prepared simulations.',
    'small muted'
  )
  const sourceLinks = element(documentRef, 'p', '', 'reference small')
  sourceLinks.append(element(documentRef, 'strong', 'Pinned source: '))
  const pinnedSources = [
    ['client', 'labs/claude_api_demo.py'],
    ['notebook', 'labs/api-trace.ipynb'],
    ['reducer', 'labs/diagnostics/diagnostics-lab.js']
  ]
  pinnedSources.forEach(([label, path], index) => {
    if (index) sourceLinks.append(documentRef.createTextNode(' · '))
    appendLink(documentRef, sourceLinks, label, `github:${path}`, githubRef)
  })

  const controls = element(documentRef, 'div', '', 'integration-map-steps')
  controls.setAttribute('role', 'group')
  controls.setAttribute('aria-label', 'Northstar direct API integration steps')
  const panel = element(documentRef, 'section', '', 'integration-map-panel')
  panel.setAttribute('aria-live', 'polite')
  const buttons = new Map()

  const select = stepId => {
    activeStep = stepId
    for (const [id, button] of buttons) {
      button.setAttribute('aria-pressed', id === activeStep ? 'true' : 'false')
    }
    renderPanel(documentRef, panel, steps.find(step => step.id === activeStep), viewRole, githubRef)
  }

  for (const step of steps) {
    const button = element(documentRef, 'button', step.label, 'button')
    button.type = 'button'
    button.setAttribute('aria-pressed', step.id === activeStep ? 'true' : 'false')
    button.addEventListener('click', () => select(step.id))
    buttons.set(step.id, button)
    controls.append(button)
  }

  host.append(intro, sourceLinks, controls, panel)
  select(activeStep)
}
