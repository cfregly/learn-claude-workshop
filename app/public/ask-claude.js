import { renderMarkdown, readableText } from './materials-viewer.js?v=learning-context-3'

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
  let excerpt = null
  let returnFocus = null
  let selectedBeforeOpen = null
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
  const excerptPanel = node('section', '', 'ask-excerpt')
  excerptPanel.hidden = true
  const excerptHeader = node('div', '', 'ask-excerpt-header')
  const excerptLabel = node('strong', '', 'small')
  excerptLabel.id = 'ask-excerpt-label'
  const removeExcerpt = node('button', 'Remove', 'button quiet small')
  removeExcerpt.type = 'button'
  removeExcerpt.setAttribute('aria-label', 'Remove selected context')
  const excerptText = node('div', '', 'ask-excerpt-text small')
  excerptText.tabIndex = 0
  excerptText.setAttribute('role', 'region')
  excerptText.setAttribute('aria-labelledby', 'ask-excerpt-label')
  const excerptNote = node('p', '', 'small muted')
  excerptHeader.append(excerptLabel, removeExcerpt)
  excerptPanel.append(excerptHeader, excerptText, excerptNote)
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
  const body = node('div', '', 'ask-body')
  body.append(excerptPanel, conversation, suggestions)
  panel.append(header, contextLabel, body, form, privacy)
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
      suggestion.addEventListener('click', () => { input.value = text; input.focus() })
      suggestions.append(suggestion)
    }
    clear.hidden = !thread.length
  }

  function syncExcerpt() {
    excerptPanel.hidden = !excerpt
    excerptLabel.textContent = excerpt?.label || ''
    excerptText.textContent = excerpt?.text || ''
    excerptNote.textContent = excerpt?.truncated
      ? `First 6,000 of ${excerpt.originalLength.toLocaleString()} characters. Select a smaller passage for a more focused question.`
      : 'Included only when you press Ask Claude.'
    privacy.textContent = excerpt
      ? 'Your question, the shown excerpt, and this lesson’s context go to Claude. Questions do not change your progress.'
      : 'Your question and this lesson’s context go to Claude. Your working draft is not included. Questions do not change your progress.'
  }
  function setThread() {
    activeKey = JSON.stringify([current.context, current.threadKey || null, excerpt ? [excerpt.label, excerpt.text] : null])
  }
  function open(options = {}) {
    current = getContext()
    returnFocus = options.trigger || document.activeElement
    excerpt = prepareSelectedContent(options.text, options.label)
    setThread()
    contextLabel.textContent = current.label
    status.textContent = busy ? 'Claude is finishing the previous question. You can continue the lesson while it runs.' : excerpt ? 'Passage attached. Edit your question, then press Ask Claude.' : ''
    syncExcerpt()
    render()
    if (!panel.open) panel.showModal()
    input.focus()
  }
  launcher.addEventListener('pointerdown', () => { selectedBeforeOpen = readLearnerSelection(panel) })
  launcher.addEventListener('click', () => {
    const selection = selectedBeforeOpen || readLearnerSelection(panel)
    selectedBeforeOpen = null
    open(selection ? { ...selection, trigger: launcher } : { trigger: launcher })
  })
  removeExcerpt.addEventListener('click', () => {
    if (busy) return
    excerpt = null
    setThread()
    syncExcerpt()
    render()
    status.textContent = 'Selected context removed. Earlier questions about it are set aside.'
    input.focus()
  })
  close.addEventListener('click', () => panel.close())
  panel.addEventListener('click', event => {
    if (event.target !== panel) return
    const bounds = panel.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) panel.close()
  })
  panel.addEventListener('close', () => { (returnFocus?.isConnected && !returnFocus.hidden ? returnFocus : launcher).focus({ preventScroll: true }) })
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
    const selectedContent = excerpt ? {label: excerpt.label, text: excerpt.text} : undefined
    const previous = threads.get(key) || []
    busy = true
    input.disabled = true
    submit.disabled = true
    clear.disabled = true
    removeExcerpt.disabled = true
    for (const suggestion of suggestions.children) suggestion.disabled = true
    submit.textContent = 'Thinking…'
    status.textContent = 'Claude is using the current lesson and your question.'
    status.setAttribute('aria-busy', 'true')
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question, context, ...(selectedContent ? {selected_content: selectedContent} : {}), history: previous.slice(-4).map(({role, content}) => ({role, content: content.slice(0,2000)}))}),
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
      removeExcerpt.disabled = false
      for (const suggestion of suggestions.children) suggestion.disabled = false
      submit.textContent = 'Ask Claude'
      status.removeAttribute('aria-busy')
      if (panel.open) input.focus({preventScroll:true})
    }
  })
  installContextActions({open, panel})
  return { open, refreshContext() { if (panel.open && !busy) { current=getContext();setThread();contextLabel.textContent=current.label;render() } } }
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


export function prepareSelectedContent(text, label = 'Selected passage') {
  const value = String(text || '')
  if (!value.trim()) return null
  return {
    label: String(label || 'Selected passage').trim().slice(0, 160),
    text: value.slice(0, 6000).replace(/[\uD800-\uDBFF]$/, ''),
    truncated: value.length > 6000,
    originalLength: value.length
  }
}

function readLearnerSelection(panel) {
  const active = document.activeElement
  if (panel.contains(active)) return null
  if (active?.matches('textarea,input[type="text"],input:not([type])')) {
    const text = active.value.slice(active.selectionStart || 0, active.selectionEnd || 0)
    return text.trim() ? {text, label: 'Selected text from your work'} : null
  }
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return null
  const anchor = selection.anchorNode?.parentElement
  if (anchor?.closest('#ask-claude,.material-reader,header,footer,nav')) return null
  return {text: selection.toString(), label: 'Selected passage'}
}

export function widgetContent(widget) {
  if (widget.matches('.source-fact')) return Array.from(widget.children).map(readableText).filter(Boolean).join('\n')
  return readableText(widget).trim()
}

function widgetLabel(widget) {
  const heading = widget.querySelector('h2,h3,h4,summary,.code-label,.source-tag,.code-language')
  return (heading?.textContent || (widget.classList.contains('code-block-wrap') ? 'Code example' : 'This activity')).trim().slice(0, 160)
}

function installContextActions({open, panel}) {
  const selectionAction = node('button', 'Ask about selection', 'ask-selection button secondary small')
  selectionAction.type = 'button'
  selectionAction.hidden = true
  document.body.append(selectionAction)
  let selection = null
  function updateSelection() {
    if (panel.open) { selectionAction.hidden = true; return }
    selection = readLearnerSelection(panel)
    selectionAction.hidden = !selection
  }
  document.addEventListener('selectionchange', updateSelection)
  selectionAction.addEventListener('pointerdown', event => event.preventDefault())
  selectionAction.addEventListener('click', () => {
    if (!selection) return
    open({...selection,trigger:selectionAction})
    selectionAction.hidden = true
  })
  panel.addEventListener('close', updateSelection)
  const selector = '.code-block-wrap,.source-fact,.workflow,.draft,.integration-map-host,.route-content,.quiz,.live-workflow-output,.diagnostic-case,.streaming-lab-trace > section,details.reference'
  function enhance(root) {
    const widgets = [...(root.matches?.(selector) ? [root] : []), ...(root.querySelectorAll?.(selector) || [])]
    for (const widget of widgets) {
      if (widget.closest('#ask-claude') || widget.dataset.askReady) continue
      // A code block owns its action even when it sits inside a reference.
      if (widget.matches('details.reference') && widget.querySelector('.code-block-wrap,pre')) continue
      widget.dataset.askReady = 'true'
      const action = node('button', 'Ask', 'ask-widget-button button quiet small')
      action.type = 'button'
      const label = widgetLabel(widget)
      action.setAttribute('aria-label', `Ask about ${label}`)
      action.addEventListener('click', () => open({text:widgetContent(widget),label,trigger:action}))
      const toolbar = widget.matches('.code-block-wrap') ? widget.querySelector('.code-toolbar') : null
      if (toolbar) toolbar.append(action)
      else if (widget.matches('details')) widget.querySelector('summary')?.after(action)
      else widget.prepend(action)
    }
  }
  enhance(document.body)
  new MutationObserver(records => {
    for (const record of records) for (const added of record.addedNodes) if (added.nodeType === 1) enhance(added)
  }).observe(document.body,{childList:true,subtree:true})
}
