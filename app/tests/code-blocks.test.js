import test from 'node:test'
import assert from 'node:assert/strict'

import { enhanceCodeBlocks, formatCode, observeCodeBlocks, tokenizeCode } from '../public/code-blocks.js'

class TestNode {
  constructor(documentRef, tagName = '', nodeType = 1) {
    this.ownerDocument = documentRef
    this.tagName = tagName.toUpperCase()
    this.nodeType = nodeType
    this.parentNode = null
    this.childNodes = []
    this.dataset = {}
    this.attributes = new Map()
    this.listeners = new Map()
    this.className = ''
    this._text = ''
    this.replaceCount = 0
    this.classList = {
      add: (...names) => {
        const values = new Set(this.className.split(/\s+/).filter(Boolean))
        for (const name of names) values.add(name)
        this.className = [...values].join(' ')
      },
      contains: name => this.className.split(/\s+/).includes(name)
    }
  }

  get parentElement() {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null
  }

  get children() {
    return this.childNodes.filter(child => child.nodeType === 1)
  }

  get firstElementChild() {
    return this.children[0] || null
  }

  get previousElementSibling() {
    if (!this.parentNode) return null
    const siblings = this.parentNode.children
    const index = siblings.indexOf(this)
    return index > 0 ? siblings[index - 1] : null
  }

  removeFromParent(node) {
    if (!node.parentNode) return
    node.parentNode.childNodes = node.parentNode.childNodes.filter(child => child !== node)
    node.parentNode = null
  }

  append(...nodes) {
    for (const node of nodes) {
      this.removeFromParent(node)
      node.parentNode = this
      this.childNodes.push(node)
    }
  }

  insertBefore(node, reference) {
    this.removeFromParent(node)
    const index = this.childNodes.indexOf(reference)
    node.parentNode = this
    if (index < 0) this.childNodes.push(node)
    else this.childNodes.splice(index, 0, node)
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null
    this.childNodes = []
    this._text = ''
    this.replaceCount += 1
    this.append(...nodes)
  }

  set textContent(value) {
    for (const child of this.childNodes) child.parentNode = null
    this.childNodes = []
    this._text = String(value)
  }

  get textContent() {
    if (this.nodeType === 3) return this._text
    return this.childNodes.length ? this.childNodes.map(child => child.textContent).join('') : this._text
  }

  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1))
    return this.tagName.toLowerCase() === selector.toLowerCase()
  }

  closest(selector) {
    let current = this
    while (current) {
      if (current.nodeType === 1 && current.matches(selector)) return current
      current = current.parentElement
    }
    return null
  }

  querySelectorAll(selector) {
    const result = []
    for (const child of this.children) {
      if (child.matches(selector)) result.push(child)
      result.push(...child.querySelectorAll(selector))
    }
    return result
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value))
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener)
  }

  click() {
    return this.listeners.get('click')?.()
  }
}

class TestMutationObserver {
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.options = null
    TestMutationObserver.instances.push(this)
  }

  observe(_root, options) {
    this.options = options
  }

  trigger(records) {
    this.callback(records)
  }
}

class TestDocument {
  constructor() {
    this.defaultView = { MutationObserver: TestMutationObserver }
  }

  createElement(tagName) {
    return new TestNode(this, tagName)
  }

  createTextNode(text) {
    const result = new TestNode(this, '', 3)
    result.textContent = text
    return result
  }
}

test('formatCode pretty prints JSON objects and arrays with two spaces', () => {
  assert.equal(
    formatCode('{"account":"Northstar","facts":[{"approved":false}]}'),
    '{\n  "account": "Northstar",\n  "facts": [\n    {\n      "approved": false\n    }\n  ]\n}'
  )
  assert.equal(formatCode('[{"id":1},{"id":2}]'), '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  }\n]')
})

test('formatCode preserves invalid JSON exactly', () => {
  const source = '  {"account":"Northstar", trailing: true}\n'
  assert.equal(formatCode(source), source)
})

test('formatCode preserves Python, SSE, and plain source text exactly', () => {
  const python = '{"looks": "json"}\nprint("keep source")\n'
  const sse = 'event: message_delta\ndata: {"stop_reason":"max_tokens"}\n\n'
  const plain = 'Northstar renewal\n  keep indentation\n'
  assert.equal(formatCode(python, 'python'), python)
  assert.equal(formatCode(sse, 'sse'), sse)
  assert.equal(formatCode(plain), plain)
  assert.equal(formatCode('{"valid":"json but labeled JavaScript"}', 'javascript'), '{"valid":"json but labeled JavaScript"}')
})

test('tokenizeCode identifies every JSON role without changing visible text', () => {
  const source = formatCode('{"account":"Northstar <script>","count":-12.5e+2,"ready":false,"missing":null}', 'json')
  const tokens = tokenizeCode(source, 'json')
  assert.equal(tokens.map(token => token.text).join(''), source)
  assert.deepEqual(new Set(tokens.map(token => token.type)), new Set([
    'plain', 'punctuation', 'key', 'string', 'number', 'boolean', 'null'
  ]))
  assert.equal(tokens.find(token => token.type === 'key')?.text, '"account"')
  assert.equal(tokens.find(token => token.type === 'string')?.text, '"Northstar <script>"')
  assert.equal(tokens.find(token => token.type === 'number')?.text, '-1250')
})

test('highlighting keeps unsafe HTML literal, preserves clipboard text, and adds no elements from source', async () => {
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'json'
  const raw = '{"html":"</span><img src=x onerror=alert(1)>","ready":true}'
  const visible = formatCode(raw, 'json')
  pre.textContent = raw
  root.append(pre)

  assert.equal(enhanceCodeBlocks(root), 1)
  assert.equal(pre.textContent, visible)
  assert.equal(root.querySelectorAll('img').length, 0)
  assert.equal(root.querySelectorAll('script').length, 0)
  assert.ok(root.querySelectorAll('.code-token-string').some(node => node.textContent.includes('<img src=x')))

  const copied = []
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { writeText: async value => copied.push(value) } }
  })
  try {
    await root.querySelector('.code-copy-button').click()
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
    else delete globalThis.navigator
  }
  assert.deepEqual(copied, [visible])
})

test('observer rehighlights dynamic JSON once without duplicate wrappers or buttons', () => {
  TestMutationObserver.instances = []
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'json'
  pre.textContent = '{"stage":"lookup"}'
  root.append(pre)

  const observer = observeCodeBlocks(root)
  assert.equal(root.querySelectorAll('.code-block-wrap').length, 1)
  assert.equal(root.querySelectorAll('.code-copy-button').length, 1)
  assert.equal(observer.options.characterData, true)
  const firstCode = pre.firstElementChild
  const firstRenderCount = pre.replaceCount

  observer.trigger([{ target: firstCode, addedNodes: [] }])
  assert.equal(pre.firstElementChild, firstCode)
  assert.equal(pre.replaceCount, firstRenderCount)

  pre.textContent = '{"stage":"draft","complete":false,"result":null}'
  observer.trigger([{ target: pre, addedNodes: [] }])
  const updatedCode = pre.firstElementChild
  assert.notEqual(updatedCode, firstCode)
  assert.equal(pre.textContent, '{\n  "stage": "draft",\n  "complete": false,\n  "result": null\n}')
  assert.equal(root.querySelectorAll('.code-block-wrap').length, 1)
  assert.equal(root.querySelectorAll('.code-copy-button').length, 1)

  const dynamicRenderCount = pre.replaceCount
  observer.trigger([{ target: updatedCode, addedNodes: updatedCode.childNodes }])
  assert.equal(pre.firstElementChild, updatedCode)
  assert.equal(pre.replaceCount, dynamicRenderCount)
})
