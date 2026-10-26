import test from 'node:test'
import assert from 'node:assert/strict'

import { initAskClaude } from '../public/ask-claude.js'

class TestNode {
  constructor(documentRef, tagName = '', text = '') {
    this.ownerDocument = documentRef
    this.tagName = tagName.toUpperCase()
    this.nodeType = tagName ? 1 : 3
    this.data = text
    this.childNodes = []
    this.dataset = {}
    this.attributes = new Map()
    this.listeners = new Map()
    this.className = ''
    this.hidden = false
    this.disabled = false
    this.open = false
    this.value = ''
    this.classList = {
      contains: name => this.className.split(/\s+/).filter(Boolean).includes(name),
      add: (...names) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean))
        for (const name of names) classes.add(name)
        this.className = [...classes].join(' ')
      }
    }
  }

  get children() { return this.childNodes.filter(child => child.nodeType === 1) }
  get firstElementChild() { return this.children[0] || null }
  get lastElementChild() { return this.children.at(-1) || null }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(child => child.textContent).join('') }
  set textContent(value) {
    const text = String(value)
    this.replaceChildren(...(text ? [this.ownerDocument.createTextNode(text)] : []))
  }
  get isConnected() { return this.ownerDocument?.contains(this) || false }

  append(...children) {
    for (const child of children) {
      child.remove?.()
      child.parentNode = this
      this.childNodes.push(child)
    }
  }

  prepend(...children) {
    for (const child of [...children].reverse()) {
      child.remove?.()
      child.parentNode = this
      this.childNodes.unshift(child)
    }
  }

  replaceChildren(...children) {
    for (const child of this.childNodes) child.parentNode = null
    this.childNodes = []
    this.append(...children)
  }

  remove() {
    if (!this.parentNode) return
    this.parentNode.childNodes = this.parentNode.childNodes.filter(child => child !== this)
    this.parentNode = null
  }

  after(...nodes) {
    if (!this.parentNode) return
    const siblings = this.parentNode.childNodes
    let index = siblings.indexOf(this) + 1
    for (const node of nodes) {
      node.remove?.()
      node.parentNode = this.parentNode
      siblings.splice(index++, 0, node)
    }
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  removeAttribute(name) { this.attributes.delete(name) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name).add(listener)
  }

  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)) }

  matches(selector) {
    return String(selector).split(',').some(raw => {
      const part = raw.trim()
      if (!part || part.includes('>')) return false
      if (part.startsWith('#')) return this.id === part.slice(1)
      if (part.startsWith('.')) return part.slice(1).split('.').every(name => this.classList.contains(name))
      if (part === '[data-material-body]') return this.dataset.materialBody !== undefined
      if (part === 'textarea') return this.tagName === 'TEXTAREA'
      if (part.startsWith('input')) return this.tagName === 'INPUT'
      const tagAndClass = part.match(/^([a-z0-9-]+)\.([a-z0-9_-]+)$/i)
      if (tagAndClass) return this.tagName === tagAndClass[1].toUpperCase() && this.classList.contains(tagAndClass[2])
      return this.tagName === part.toUpperCase()
    })
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node
    return null
  }

  querySelectorAll(selector) {
    return this.childNodes.flatMap(child => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector)
    ])
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
  focus() { this.ownerDocument.activeElement = this }
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 100, right: 500, top: 100, bottom: 500 } }
  showModal() { this.open = true }
  close() {
    if (!this.open) return
    this.open = false
    this.emit('close')
  }

  emit(type, overrides = {}) {
    const event = {
      target: this,
      button: 0,
      clientX: 200,
      clientY: 200,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true },
      ...overrides
    }
    const results = []
    for (let node = this; node; node = node.parentNode) {
      for (const listener of node.listeners.get(type) || []) results.push(listener(event))
    }
    return Promise.all(results)
  }

  click(overrides = {}) { return this.emit('click', overrides) }
}

class TestMutationObserver {
  static instances = []
  constructor(callback) {
    this.callback = callback
    this.options = null
    TestMutationObserver.instances.push(this)
  }
  observe(_root, options) { this.options = options }
  disconnect() {}
  trigger(records) { this.callback(records) }
}

function setup(t, fetcher) {
  TestMutationObserver.instances = []
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
    MutationObserver: globalThis.MutationObserver
  }
  const document = new TestNode(null, 'document')
  document.ownerDocument = document
  document.createElement = tag => new TestNode(document, tag)
  document.createTextNode = text => new TestNode(document, '', String(text))
  document.body = document.createElement('body')
  document.append(document.body)
  document.activeElement = document.body
  const window = {
    location: { href: 'https://workshop.test/#path/software-engineer-api/2', origin: 'https://workshop.test' },
    getSelection: () => null
  }
  globalThis.document = document
  globalThis.window = window
  globalThis.fetch = fetcher
  globalThis.MutationObserver = TestMutationObserver
  t.after(() => Object.assign(globalThis, previous))
  return { document }
}

function find(root, predicate) {
  if (predicate(root)) return root
  for (const child of root.childNodes) {
    const match = find(child, predicate)
    if (match) return match
  }
  return null
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('reopening while busy preserves the original excerpt, context, and pending thread', async t => {
  const response = deferred()
  let request
  const { document } = setup(t, async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) }
    return response.promise
  })
  const firstTrigger = document.createElement('button')
  const secondTrigger = document.createElement('button')
  document.body.append(firstTrigger, secondTrigger)
  let contextCalls = 0
  let selectedContext = {
    context: { route: 'lesson', role_id: 'software-engineer-api', step: 2 },
    label: 'Engineer · Demonstration',
    suggestions: ['Explain the trace']
  }
  const ask = initAskClaude({ getContext: () => { contextCalls += 1; return selectedContext } })

  ask.open({ text: 'Original approved record', label: 'Original excerpt', trigger: firstTrigger })
  const panel = find(document.body, node => node.id === 'ask-claude')
  const input = find(panel, node => node.id === 'ask-question')
  const form = find(panel, node => node.tagName === 'FORM')
  const contextLabel = find(panel, node => node.classList?.contains('ask-context'))
  const excerptLabel = find(panel, node => node.id === 'ask-excerpt-label')
  const excerptText = find(panel, node => node.classList?.contains('ask-excerpt-text'))
  const conversation = find(panel, node => node.classList?.contains('ask-conversation'))
  input.value = 'Explain the original evidence.'
  const pendingSubmit = form.emit('submit')
  await Promise.resolve()

  assert.equal(request.url, '/api/ask')
  assert.equal(request.body.context.role_id, 'software-engineer-api')
  assert.deepEqual(request.body.selected_content, { label: 'Original excerpt', text: 'Original approved record' })
  panel.close()
  selectedContext = {
    context: { route: 'lesson', role_id: 'account-executive', step: 2 },
    label: 'Account Executive · Demonstration',
    suggestions: ['Explain the claim']
  }
  ask.open({ text: 'Different customer claim', label: 'Different excerpt', trigger: secondTrigger })

  assert.equal(panel.open, true)
  assert.equal(contextCalls, 1)
  assert.equal(contextLabel.textContent, 'Engineer · Demonstration')
  assert.equal(excerptLabel.textContent, 'Original excerpt')
  assert.equal(excerptText.textContent, 'Original approved record')
  assert.equal(input.value, 'Explain the original evidence.')

  response.resolve({
    ok: true,
    async json() { return { answer_text: 'The original evidence supports the lookup.', stop_reason: 'end_turn', response_limited: false } }
  })
  await pendingSubmit

  assert.equal(panel.open, true)
  assert.match(conversation.textContent, /Explain the original evidence\./)
  assert.match(conversation.textContent, /The original evidence supports the lookup\./)
  assert.doesNotMatch(conversation.textContent, /Different customer claim/)
})

test('backdrop closes only when the pointerdown also started on the backdrop', async t => {
  const { document } = setup(t, async () => { throw new Error('fetch should not run') })
  const trigger = document.createElement('button')
  document.body.append(trigger)
  const ask = initAskClaude({ getContext: () => ({
    context: { route: 'lesson', role_id: 'software-engineer-api', step: 2 },
    label: 'Engineer · Demonstration',
    suggestions: []
  }) })
  ask.open({ trigger })
  const panel = find(document.body, node => node.id === 'ask-claude')
  const input = find(panel, node => node.id === 'ask-question')

  await input.emit('pointerdown', { clientX: 220, clientY: 220 })
  await panel.emit('click', { target: panel, clientX: 20, clientY: 20 })
  assert.equal(panel.open, true)

  await panel.emit('pointerdown', { target: panel, clientX: 20, clientY: 20 })
  await panel.emit('click', { target: panel, clientX: 20, clientY: 20 })
  assert.equal(panel.open, false)
})

test('initialization leaves draft controls and quizzes unchanged', t => {
  const { document } = setup(t, async () => { throw new Error('fetch should not run') })
  const draft = document.createElement('textarea')
  draft.className = 'draft workflow'
  draft.value = 'Unsaved learner work'
  const quiz = document.createElement('section')
  quiz.className = 'quiz'
  const quizPrompt = document.createElement('p')
  quizPrompt.textContent = 'Which claim is supported?'
  quiz.append(quizPrompt)
  document.body.append(draft, quiz)

  initAskClaude({ getContext: () => ({
    context: { route: 'lesson', role_id: 'account-executive', step: 4 },
    label: 'Account Executive · Practice',
    suggestions: []
  }) })

  assert.equal(draft.value, 'Unsaved learner work')
  assert.equal(draft.childNodes.length, 0)
  assert.equal(draft.dataset.askReady, undefined)
  assert.equal(find(quiz, node => node.classList?.contains('ask-widget-button')), null)
  assert.equal(quiz.dataset.askReady, undefined)
  assert.equal(quiz.textContent, 'Which claim is supported?')
})

test('route replacement restores one Ask action with the current passage', async t => {
  const { document } = setup(t, async () => { throw new Error('fetch should not run') })
  const route = document.createElement('section')
  route.className = 'route-content'
  const original = document.createElement('p')
  original.textContent = 'Original route passage.'
  route.append(original)
  document.body.append(route)

  initAskClaude({ getContext: () => ({
    context: { route: 'lesson', role_id: 'software-engineer-api', step: 3 },
    label: 'Engineer · Demonstration',
    suggestions: []
  }) })
  assert.equal(route.children.filter(child => child.classList.contains('ask-widget-button')).length, 1)

  const replacement = document.createElement('p')
  replacement.textContent = 'Replacement passage with current evidence.'
  route.replaceChildren(replacement)
  const observer = TestMutationObserver.instances.at(-1)
  const mutation = { target: route, addedNodes: [replacement] }
  observer.trigger([mutation])
  observer.trigger([mutation])

  const actions = route.children.filter(child => child.classList.contains('ask-widget-button'))
  assert.equal(actions.length, 1)
  await actions[0].click()
  const panel = find(document.body, node => node.id === 'ask-claude')
  const excerptText = find(panel, node => node.classList?.contains('ask-excerpt-text'))
  assert.equal(panel.open, true)
  assert.equal(excerptText.textContent, 'Replacement passage with current evidence.')
  assert.doesNotMatch(excerptText.textContent, /Original route passage/)
})
