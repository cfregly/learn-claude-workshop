const results = new Map()
const cases = [
  ['baseline', 'Original records'],
  ['conflicting-date', 'Conflicting renewal date'],
  ['unsupported-sso', 'Unsupported SSO claim'],
  ['injected-source', 'Instruction inside a source']
]

function element(tag, text = '', className = '') {
  const node = document.createElement(tag)
  node.textContent = text
  if (className) node.className = className
  return node
}

export function mountLiveDemo(host, path) {
  if (!host) return
  let selected = 'baseline'
  let available = false
  let pending = false
  host.className = 'live-demo'
  const heading = element('h2', 'Try the workflow with Claude')
  const intro = element('p', 'Generate a text-only draft from the synthetic Northstar records, then inspect its sources. Streaming and tool use are prepared simulations in the labs.')
  const status = element('p', 'Checking live example availability…', 'small muted')
  status.setAttribute('role', 'status')
  const variations = element('details', '', 'reference')
  variations.append(element('summary', 'Test a changed source'))
  const choices = element('div', '', 'demo-cases')
  choices.setAttribute('role', 'group')
  choices.setAttribute('aria-label', 'Source variation')
  const button = element('button', 'Generate with Claude', 'button')
  button.type = 'button'
  button.disabled = true
  const output = element('div')
  output.setAttribute('aria-live', 'polite')
  const review = element('p', 'Learning check: which statement is supported, what remains unknown, and who owns the next action?', 'small')

  function showResult(data) {
    output.replaceChildren()
    if (!data) return
    const incomplete = data.status === 'incomplete' || data.stop_reason !== 'end_turn'
    output.append(element('h3', incomplete ? 'Incomplete Claude response' : 'Fresh Claude response'))
    output.append(element('p', incomplete
      ? (data.response_limited ? 'The workshop shortened this response at its display limit. Treat it as incomplete. Use the reference or generate a shorter draft.' : 'Generation stopped before a complete answer. Use the prepared reference and inspect the stop reason.')
      : 'Live generated draft. Review it against the source records.', 'small muted'))
    const draft = element('div', '', 'live-output')
    renderMarkdown(draft, data.output_text || 'No text was returned. Use the prepared reference.')
    output.append(draft)
    const trace = element('details', '', 'reference')
    trace.append(element('summary', 'Inspect the API request and response'))
    trace.append(element('p', 'The backend selects approved context and calls the Messages API. API authentication stays on the server. The returned text still needs human review.', 'small'))
    const identifiers = element('dl', '', 'api-metadata')
    for (const [label, value] of [
      ['Model', data.model], ['Stop reason', data.stop_reason],
      ['Input tokens', data.usage?.input_tokens], ['Output tokens', data.usage?.output_tokens],
      ['Elapsed', `${(data.latency_ms / 1000).toFixed(1)} seconds`],
      ['Application trace', data.trace_id], ['Provider request', data.provider_request_id || 'Not supplied']
    ]) {
      identifiers.append(element('dt', label), element('dd', String(value ?? 'Not supplied')))
    }
    trace.append(identifiers, element('h3', 'Request sent by the backend'))
    const request = element('pre', '', 'code')
    request.append(element('code', JSON.stringify(data.request, null, 2)))
    trace.append(request)
    trace.append(element('h3','Response summary'))
    const response = element('pre','','code')
    response.dataset.language='json'
    response.append(element('code',JSON.stringify({model:data.model,content:[{type:'text',text:data.output_text}],stop_reason:data.stop_reason,usage:data.usage,status:data.status,response_limited:data.response_limited,review_required:data.review_required},null,2)))
    trace.append(response)
    output.append(trace, review)
  }

  for (const [id, label] of cases) {
    const choice = element('button', label, 'button secondary small')
    choice.type = 'button'
    choice.setAttribute('aria-pressed', String(id === selected))
    choice.addEventListener('click', () => {
      if (pending) return
      selected = id
      for (const item of choices.children) item.setAttribute('aria-pressed', String(item === choice))
      showResult(results.get(`${path.id}:${selected}`))
    })
    choices.append(choice)
  }
  variations.append(choices)
  host.append(heading, intro, variations, button, status, output)
  showResult(results.get(`${path.id}:${selected}`))

  fetch('/api/demo', {headers: {'Accept': 'application/json'}, cache: 'no-store'})
    .then(response => response.json())
    .then(data => {
      if (!host.isConnected) return
      available = Boolean(data.available)
      button.disabled = !available
      status.textContent = available
        ? 'Uses the direct Claude Messages API with synthetic records only. Your working artifact is never sent.'
        : 'The live example is unavailable. Continue with the prepared demonstration above.'
    })
    .catch(() => { if (host.isConnected) status.textContent = 'The live example is unavailable. Continue with the prepared demonstration above.' })

  button.addEventListener('click', async () => {
    if (pending || !available) return
    pending = true
    button.disabled = true
    for (const choice of choices.children) choice.disabled = true
    button.textContent = 'Claude is drafting…'
    status.textContent = 'Sending the selected synthetic records. The prepared reference remains available above.'
    host.setAttribute('aria-busy', 'true')
    try {
      const response = await fetch('/api/demo', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({role_id: path.id, case_id: selected}),
        signal: AbortSignal.timeout(30000)
      })
      const data = await response.json()
      if (!host.isConnected) return
      if (!response.ok) {
        status.textContent = data.message || 'The live request could not finish. Use the prepared reference and try again later.'
        return
      }
      results.set(`${path.id}:${selected}`, data)
      showResult(data)
      status.textContent = data.status === 'incomplete' ? 'Incomplete draft received. Check the limit and use the reference before continuing.' : 'Draft received. Check the evidence before deciding what to use.'
    } catch {
      if (host.isConnected) status.textContent = 'The live request did not finish. Use the prepared reference. No retry was made automatically.'
    } finally {
      pending = false
      button.disabled = !available
      button.textContent = 'Generate with Claude'
      for (const choice of choices.children) choice.disabled = false
      host.removeAttribute('aria-busy')
    }
  })
}
import { renderMarkdown } from './materials-viewer.js?v=20261025-rename'

