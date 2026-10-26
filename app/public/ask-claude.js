import { renderMarkdown } from './materials-viewer.js?v=20261025-rename'

function node(tag, text = '', className = '') {
  const element = document.createElement(tag)
  element.textContent = text
  if (className) element.className = className
  return element
}

export function initAskClaude({ getContext }) {
  const threads = new Map()
  let activeKey = ''
  let busy = false
  let current
  const launcher = node('button', 'Ask anything', 'ask-launcher button secondary')
  launcher.type = 'button'
  launcher.setAttribute('aria-haspopup', 'dialog')
  launcher.setAttribute('aria-controls', 'ask-claude')
  const panel = node('dialog', '', 'ask-panel')
  panel.id = 'ask-claude'
  panel.setAttribute('aria-labelledby', 'ask-heading')
  const header = node('div', '', 'ask-header')
  const heading = node('h2', 'Ask anything')
  heading.id = 'ask-heading'
  const close = node('button', 'Close', 'button quiet small')
  close.type = 'button'
  close.setAttribute('aria-label', 'Close questions')
  header.append(heading, close)
  const contextLabel = node('p', '', 'ask-context small')
  const conversation = node('div', '', 'ask-conversation')
  const suggestions = node('div', '', 'ask-suggestions')
  const form = node('form', '', 'ask-form')
  const label = node('label', 'Your question', 'exercise-label')
  label.htmlFor = 'ask-question'
  const input = node('textarea')
  input.id = 'ask-question'
  input.name = 'question'
  input.rows = 3
  input.maxLength = 1200
  input.required = true
  input.placeholder = 'Ask for clarity, an example, or a deeper explanation…'
  const actions = node('div', '', 'actions')
  const submit = node('button', 'Ask Claude', 'button')
  submit.type = 'submit'
  const clear = node('button', 'Start fresh', 'button quiet small')
  clear.type = 'button'
  actions.append(submit, clear)
  const status = node('p', '', 'small ask-status')
  status.setAttribute('role', 'status')
  form.append(label, input, actions, status)
  const privacy = node('p', 'Your question and this lesson’s context go to Claude. Your working draft is not included. Questions do not change your progress.', 'small muted ask-privacy')
  panel.append(header, contextLabel, conversation, suggestions, form, privacy)
  document.body.append(launcher, panel)

  function render() {
    const thread = threads.get(activeKey) || []
    conversation.replaceChildren()
    if (!thread.length) conversation.append(node('p', 'Stay with the activity. Ask when a concept, choice, or result needs another explanation.', 'muted'))
    for (const message of thread) {
      const entry = node('section', '', `ask-message ask-${message.role}`)
      entry.append(node('h3', message.role === 'user' ? 'You' : 'Claude'))
      const body = node('div')
      if (message.role === 'assistant') renderMarkdown(body, message.content)
      else body.append(node('p', message.content))
      entry.append(body)
      if (message.incomplete) entry.append(node('p', 'This answer stopped early. It is incomplete. Ask for a shorter explanation or use the lesson reference.', 'small'))
      conversation.append(entry)
    }
    suggestions.replaceChildren()
    const asked = new Set(thread.filter(message=>message.role==='user').map(message=>message.content.trim().toLowerCase()))
    const followUps = thread.length ? [...new Set([
      ...suggestedFollowUps(thread.at(-1).content,current.context),
      'Which evidence would change this conclusion?',
      'Show a changed case that would test this assumption.',
      ...current.suggestions,
      'What is the next useful check for my activity?'
    ])].filter(question=>!asked.has(question.trim().toLowerCase())).slice(0,2) : null
    if(followUps) suggestions.append(node('p','Suggested follow-ups','small muted'))
    for (const text of followUps || current.suggestions || ['Explain this in simpler terms', 'Walk me through one example', 'What would change in a real application?']) {
      const suggestion = node('button', text, 'button secondary small')
      suggestion.type = 'button'
      suggestion.addEventListener('click', () => { input.value = text; input.focus();if(followUps)form.requestSubmit() })
      suggestions.append(suggestion)
    }
    clear.hidden = !thread.length
  }

  launcher.addEventListener('click', () => {
    current = getContext()
    activeKey = JSON.stringify([current.context,current.threadKey||null])
    contextLabel.textContent = current.label
    status.textContent = busy ? 'Claude is finishing the previous question. You can continue the lesson while it runs.' : ''
    render()
    panel.showModal()
    input.focus()
  })
  close.addEventListener('click', () => panel.close())
  panel.addEventListener('click', event => {
    if (event.target !== panel) return
    const bounds = panel.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) panel.close()
  })
  panel.addEventListener('close', () => { launcher.focus({ preventScroll: true }) })
  clear.addEventListener('click', () => {
    if (busy) return
    threads.delete(activeKey)
    input.value = ''
    status.textContent = 'A fresh question starts here.'
    render()
    input.focus()
  })

  form.addEventListener('submit', async event => {
    event.preventDefault()
    const question = input.value.trim()
    if (busy || !question) return
    const key = activeKey
    const context = current.context
    const previous = threads.get(key) || []
    busy = true
    input.disabled = true
    submit.disabled = true
    clear.disabled = true
    for (const suggestion of suggestions.children) suggestion.disabled = true
    submit.textContent = 'Thinking…'
    status.textContent = 'Claude is using the current lesson and your question.'
    status.setAttribute('aria-busy', 'true')
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question, context, history: previous.slice(-4).map(({role, content}) => ({role, content: content.slice(0,2000)}))}),
        signal: AbortSignal.timeout(30000)
      })
      const data = await response.json()
      if (!response.ok) {
        status.textContent = data.message || 'Claude could not answer right now. Your question is still here. Use the lesson reference or try again later.'
        return
      }
      const answer = data.answer_text || data.output_text
      if (!answer) {
        status.textContent = 'No explanation was returned. Try a shorter question or use the lesson reference.'
        return
      }
      previous.push({role:'user', content:question}, {role:'assistant', content:answer, incomplete:data.stop_reason!=='end_turn'||data.response_limited})
      threads.set(key, previous.slice(-12))
      if (key === activeKey) {
        input.value = ''
        render()
        status.textContent = data.stop_reason === 'end_turn'&&!data.response_limited ? 'Ask a follow-up, or close this panel to continue the activity.' : 'This answer is incomplete. Use the reference or ask for a shorter explanation.'
        if(panel.open) conversation.lastElementChild?.scrollIntoView({block:'nearest',behavior:'instant'})
      }
    } catch {
      status.textContent = 'The answer did not finish. Your question is still here. Try again later or continue with the reference.'
    } finally {
      busy = false
      input.disabled = false
      submit.disabled = false
      clear.disabled = false
      for (const suggestion of suggestions.children) suggestion.disabled = false
      submit.textContent = 'Ask Claude'
      status.removeAttribute('aria-busy')
      if (panel.open) input.focus({preventScroll:true})
    }
  })
  return { refreshContext() { if (panel.open && !busy) { current=getContext();activeKey=JSON.stringify([current.context,current.threadKey||null]);contextLabel.textContent=current.label;render() } } }
}

export function suggestedFollowUps(answer,context={}) {
  if(context.route==='resources') return ['Which reference matches my current activity?','What should I check before exporting my record?']
  if(context.route==='home') return ['How do the engineer and business paths differ?','Can I try this without an API key?']
  const text=String(answer).toLowerCase()
  const role=context.stream_role||context.role_id||''
  const engineer=/engineer|architect|security/.test(role)
  const product=/product/.test(role)
  if(/tool_use|tool_result|tool call|tool input|authorization/.test(text)&&!/max_tokens/.test(text)) return engineer
    ? ['Show how the tool_result matches the tool call.','What happens when account access is denied?']
    : product
      ? ['What should users see while the tool runs?','How should we handle a timeout without guessing the outcome?']
      : ['What does the tool result actually prove?','Who checks the customer claim before use?']
  if(/max_tokens|stop_reason|end_turn|http 200|stopped early/.test(text)) return engineer
    ? ['Show the smallest handler that preserves an incomplete draft.','What if generation finishes but the discount claim is unsupported?']
    : product
      ? ['What acceptance check would catch an incomplete response?','Which states should the user see?']
      : ['How should I label this brief for the account team?','What evidence lets us use the finished brief?']
  if(/tool_use|tool_result|tool call|tool input|authorization/.test(text)) return engineer
    ? ['Show how the tool_result matches the tool call.','What happens when account access is denied?']
    : product
      ? ['What should users see while the tool runs?','How should we handle a timeout without guessing the outcome?']
      : ['What does the tool result actually prove?','Who checks the customer claim before use?']
  if(/discount|sso|source|unknown|approval/.test(text)) return engineer
    ? ['Which check belongs in application code?','What changed input would test this assumption?']
    : ['Which source supports that conclusion?','How would I explain the unknown without making a commitment?']
  return engineer
    ? ['Show me a small working example.','How would I test the failure case?']
    : ['Show this with the Northstar example.','What would I check before using it?']
}
