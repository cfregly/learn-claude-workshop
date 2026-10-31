import test from 'node:test'
import assert from 'node:assert/strict'

import { enhanceCodeBlocks, formatCode, observeCodeBlocks, tokenizeCode } from '../public/code-blocks.js'

const LOSSY_JSON_SOURCES = [
  '{"id":9007199254740993}',
  '{"value":1e400}',
  '{"a":1,"a":2}',
  '{"b":1,"10":2,"2":3}',
  '{"value":1.0,"negativeZero":-0}',
  '{"count":-12.5e+2}',
  String.raw`{"text":"\u00e9","path":"\/"}`
]

async function copyFrom(root) {
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
  return copied
}

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

test('formatCode preserves JSON values, duplicate keys, order, and lexical spellings', () => {
  for (const source of LOSSY_JSON_SOURCES) {
    assert.equal(formatCode(source, 'json'), source)
    assert.equal(formatCode(source), source)
  }
})

test('formatCode ignores only whitespace outside JSON strings when checking losslessness', () => {
  const source = ' \n{\t"message": "keep  spaces",\n"ready": true}\r\n'
  assert.equal(formatCode(source, 'json'), '{\n  "message": "keep  spaces",\n  "ready": true\n}')
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
    'punctuation', 'operator', 'key', 'string', 'number', 'boolean', 'null'
  ]))
  assert.equal(tokens.find(token => token.type === 'key')?.text, '"account"')
  assert.equal(tokens.find(token => token.type === 'string')?.text, '"Northstar <script>"')
  assert.equal(tokens.find(token => token.type === 'number')?.text, '-12.5e+2')
})

test('non-JSON enhancement preserves existing code markup and bare child nodes', () => {
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')

  const annotatedPre = documentRef.createElement('pre')
  annotatedPre.dataset.language = 'python'
  const existingCode = documentRef.createElement('code')
  existingCode.className = 'language-python annotated-source'
  existingCode.setAttribute('data-annotation', 'keep')
  const strong = documentRef.createElement('strong')
  strong.textContent = 'northstar'
  const mark = documentRef.createElement('mark')
  mark.textContent = 'approved'
  existingCode.append(
    documentRef.createTextNode('account = "'),
    strong,
    documentRef.createTextNode('"\nstatus = "'),
    mark,
    documentRef.createTextNode('"')
  )
  annotatedPre.append(existingCode)

  const barePre = documentRef.createElement('pre')
  barePre.dataset.language = 'python'
  const bareText = documentRef.createTextNode('print(')
  const bareMark = documentRef.createElement('mark')
  bareMark.textContent = '"review"'
  const bareClose = documentRef.createTextNode(')')
  barePre.append(bareText, bareMark, bareClose)
  root.append(annotatedPre, barePre)

  assert.equal(enhanceCodeBlocks(root), 2)
  assert.equal(annotatedPre.firstElementChild, existingCode)
  assert.equal(existingCode.className, 'language-python annotated-source')
  assert.equal(existingCode.attributes.get('data-annotation'), 'keep')
  assert.equal(existingCode.children[0], strong)
  assert.equal(existingCode.children[1], mark)
  assert.equal(annotatedPre.textContent, 'account = "northstar"\nstatus = "approved"')

  const wrappedCode = barePre.firstElementChild
  assert.equal(wrappedCode.tagName, 'CODE')
  assert.equal(wrappedCode.childNodes[0], bareText)
  assert.equal(wrappedCode.childNodes[1], bareMark)
  assert.equal(wrappedCode.childNodes[2], bareClose)
  assert.equal(barePre.textContent, 'print("review")')

  assert.equal(enhanceCodeBlocks(root), 0)
  assert.equal(annotatedPre.firstElementChild, existingCode)
  assert.equal(barePre.firstElementChild, wrappedCode)
  assert.equal(root.querySelectorAll('.code-copy-button').length, 2)
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

test('lossy JSON stays verbatim through highlighting, token reconstruction, and copy', async () => {
  for (const source of LOSSY_JSON_SOURCES) {
    const documentRef = new TestDocument()
    const root = documentRef.createElement('main')
    const pre = documentRef.createElement('pre')
    pre.dataset.language = 'json'
    pre.textContent = source
    root.append(pre)

    enhanceCodeBlocks(root)
    assert.equal(pre.textContent, source)
    assert.equal(tokenizeCode(pre.textContent, 'json').map(token => token.text).join(''), source)
    assert.deepEqual(await copyFrom(root), [source])
  }
})

test('observer restores highlighting after a same-text rewrite and then stays idle', () => {
  TestMutationObserver.instances = []
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'python'
  pre.textContent = 'print("Northstar")'
  root.append(pre)
  const observer = observeCodeBlocks(root)
  const code = pre.firstElementChild
  assert.ok(code.querySelectorAll('.code-token').length > 0)

  const source = code.textContent
  code.textContent = source
  assert.equal(code.querySelectorAll('.code-token').length, 0)
  observer.trigger([{ target: code, addedNodes: Array.from(code.childNodes) }])
  assert.equal(pre.firstElementChild, code)
  assert.equal(code.textContent, source)
  assert.ok(code.querySelectorAll('.code-token').length > 0)

  const renders = code.replaceCount
  observer.trigger([{ target: code, addedNodes: Array.from(code.childNodes) }])
  assert.equal(code.replaceCount, renders)
})

test('enhancement preserves authored siblings and markup beside an existing code node', async () => {
  for (const annotatedCode of [false, true]) {
    const documentRef = new TestDocument()
    const root = documentRef.createElement('main')
    const pre = documentRef.createElement('pre')
    pre.dataset.language = 'python'
    const prompt = documentRef.createElement('span')
    prompt.setAttribute('data-annotation', 'keep-prompt')
    prompt.textContent = '>>> '
    const code = documentRef.createElement('code')
    const mark = documentRef.createElement('mark')
    mark.textContent = 'Northstar'
    if (annotatedCode) code.append(documentRef.createTextNode('print("'), mark, documentRef.createTextNode('")'))
    else code.textContent = 'print("Northstar")'
    const note = documentRef.createTextNode(' # keep note')
    pre.append(prompt, code, note)
    root.append(pre)
    const source = pre.textContent

    enhanceCodeBlocks(root)
    assert.deepEqual(pre.childNodes, [prompt, code, note])
    assert.equal(prompt.attributes.get('data-annotation'), 'keep-prompt')
    if (annotatedCode) assert.equal(code.children[0], mark)
    assert.equal(pre.textContent, source)
    assert.equal(pre.replaceCount, 0)
    assert.equal(code.replaceCount, 0)
    assert.deepEqual(await copyFrom(root), [source])
  }

  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'json'
  const code = documentRef.createElement('code')
  code.textContent = '{"ready":true}'
  const annotation = documentRef.createElement('span')
  annotation.setAttribute('data-annotation', 'keep-empty')
  pre.append(code, annotation)
  root.append(pre)
  enhanceCodeBlocks(root)
  assert.deepEqual(pre.childNodes, [code, annotation])
  assert.equal(annotation.attributes.get('data-annotation'), 'keep-empty')
  assert.equal(pre.textContent, '{"ready":true}')
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

test('observer preserves an external JSON code reference across updates and exact copy', async () => {
  TestMutationObserver.instances = []
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'json'
  const code = documentRef.createElement('code')
  code.className = 'receipt-output'
  code.setAttribute('data-receipt-owner', 'native-integration')
  code.textContent = '{"evidence_state":"prepared_unrun"}'
  pre.append(code)
  root.append(pre)

  const observer = observeCodeBlocks(root)
  assert.equal(pre.firstElementChild, code)
  assert.equal(code.classList.contains('receipt-output'), true)
  assert.equal(code.classList.contains('code-highlight'), true)
  assert.equal(code.classList.contains('language-json'), true)
  assert.equal(code.attributes.get('data-receipt-owner'), 'native-integration')

  const nextSource = '{"evidence_state":"mcp_observed","trace_id":"native_trace_123"}'
  const visible = formatCode(nextSource, 'json')
  code.textContent = nextSource
  observer.trigger([{ target: code, addedNodes: [] }])

  assert.equal(pre.firstElementChild, code)
  assert.equal(code.textContent, visible)
  assert.equal(code.classList.contains('receipt-output'), true)
  assert.equal(code.attributes.get('data-receipt-owner'), 'native-integration')
  assert.ok(code.querySelectorAll('.code-token-key').some(node => node.textContent === '"evidence_state"'))
  assert.equal(root.querySelectorAll('.code-block-wrap').length, 1)
  assert.equal(root.querySelectorAll('.code-copy-button').length, 1)

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

test('Python highlighting identifies comments, keywords, functions, and builtins without changing source', () => {
  const source = '# approved records only\ndef build_brief(account, limit=2):\n    return len(account["facts"]) if account else limit\n'
  const tokens = tokenizeCode(source, 'python')
  assert.equal(tokens.map(token => token.text).join(''), source)
  const types = new Set(tokens.map(token => token.type))
  for (const type of ['comment', 'keyword', 'function', 'builtin', 'string', 'number', 'operator', 'punctuation']) {
    assert.equal(types.has(type), true, `missing Python token type: ${type}`)
  }
})

test('JavaScript aliases highlight an existing code node while preserving its identity and attributes', () => {
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'js'
  const code = documentRef.createElement('code')
  code.className = 'lesson-source language-js'
  code.setAttribute('data-annotation', 'keep')
  const source = 'const review = facts => facts.filter(item => item.approved === true)\n'
  code.textContent = source
  pre.append(code)
  root.append(pre)

  assert.equal(enhanceCodeBlocks(root), 1)
  assert.equal(pre.firstElementChild, code)
  assert.equal(code.textContent, source)
  assert.equal(code.classList.contains('lesson-source'), true)
  assert.equal(code.classList.contains('language-javascript'), true)
  assert.equal(code.attributes.get('data-annotation'), 'keep')
  assert.ok(code.querySelectorAll('.code-token-keyword').length > 0)
  assert.ok(code.querySelectorAll('.code-token-function').length > 0)
})

test('every supported lesson grammar reconstructs its exact input', () => {
  const samples = new Map([
    ['json', '{"ready":true,"count":2}'],
    ['python', 'print("ready")\n'],
    ['javascript', 'console.log("ready")\n'],
    ['typescript', 'const ready: boolean = true\n'],
    ['bash', 'printf "%s\\n" "$STATUS"\n'],
    ['sql', 'SELECT status FROM accounts WHERE id = 2;\n']
  ])
  for (const [language, source] of samples) {
    const tokens = tokenizeCode(source, language)
    assert.equal(tokens.map(token => token.text).join(''), source, language)
    assert.ok(tokens.some(token => token.type !== 'plain'), `${language} should have semantic tokens`)
  }
})

test('non-JSON highlighting keeps unsafe HTML literal and exact clipboard text', async () => {
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.dataset.language = 'python'
  const code = documentRef.createElement('code')
  const source = 'message = "</span><img src=x onerror=alert(1)>"\n'
  code.textContent = source
  pre.append(code)
  root.append(pre)

  enhanceCodeBlocks(root)
  assert.equal(pre.firstElementChild, code)
  assert.equal(pre.textContent, source)
  assert.equal(root.querySelectorAll('img').length, 0)
  assert.ok(code.querySelectorAll('.code-token-string').some(node => node.textContent.includes('<img src=x')))

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
  assert.deepEqual(copied, [source])
})

test('unlabeled valid JSON wins over Python-looking string values', () => {
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const pre = documentRef.createElement('pre')
  pre.textContent = '{"state":"None","ready":true}'
  root.append(pre)

  enhanceCodeBlocks(root)
  const code = pre.firstElementChild
  assert.equal(code.classList.contains('language-json'), true)
  assert.ok(code.querySelectorAll('.code-token-key').some(node => node.textContent === '"state"'))
  assert.ok(code.querySelectorAll('.code-token-string').some(node => node.textContent === '"None"'))
  assert.equal(code.querySelectorAll('.code-token-keyword').length, 0)
  assert.equal(pre.textContent, '{\n  "state": "None",\n  "ready": true\n}')
})

test('unlabeled source and reference prose skip language heuristics', () => {
  const documentRef = new TestDocument()
  const root = documentRef.createElement('main')
  const source = documentRef.createElement('pre')
  source.className = 'source-record'
  const sourceCode = documentRef.createElement('code')
  sourceCode.textContent = 'Let the owner import the record and export only facts marked True.'
  source.append(sourceCode)
  const reference = documentRef.createElement('pre')
  reference.className = 'answer-text'
  const referenceCode = documentRef.createElement('code')
  referenceCode.textContent = 'const and let are words here. import and export are not instructions.'
  reference.append(referenceCode)
  root.append(source, reference)

  enhanceCodeBlocks(root)
  for (const [pre, code] of [[source, sourceCode], [reference, referenceCode]]) {
    assert.equal(pre.firstElementChild, code)
    assert.equal(pre.firstElementChild.classList.contains('code-highlight'), false)
    assert.equal(pre.querySelectorAll('.code-token').length, 0)
  }
  assert.equal(source.textContent, 'Let the owner import the record and export only facts marked True.')
  assert.equal(reference.textContent, 'const and let are words here. import and export are not instructions.')
})
