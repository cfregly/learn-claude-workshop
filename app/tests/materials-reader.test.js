import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  closeMaterialReader, installMaterialReaderLinks, materialIdForHref, openMaterialReader, readableText, renderMarkdown, renderMaterial
} from '../public/materials-viewer.js'

class TestNode {
  constructor(document, tagName = '', text = '') {
    this.ownerDocument = document
    this.tagName = tagName.toUpperCase()
    this.nodeType = tagName ? 1 : 3
    this.data = text
    this.childNodes = []
    this.dataset = {}
    this.attributes = new Map()
    this.listeners = new Map()
    this.className = ''
    this.scrollTop = 0
    this.open = false
  }
  get children() { return this.childNodes.filter(child => child.nodeType === 1) }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(child => child.textContent).join('') }
  set textContent(text) { this.replaceChildren(this.ownerDocument.createTextNode(String(text))) }
  get isConnected() { return this.ownerDocument.contains(this) }
  append(...children) {
    for (const child of children) { child.parentNode = this; this.childNodes.push(child) }
  }
  replaceChildren(...children) {
    this.childNodes.forEach(child => { child.parentNode = null })
    this.childNodes = []
    this.append(...children)
  }
  remove() {
    if (!this.parentNode) return
    this.parentNode.childNodes = this.parentNode.childNodes.filter(child => child !== this)
    this.parentNode = null
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) ?? (name === 'href' ? this.href : null) }
  hasAttribute(name) { return this.attributes.has(name) || (name === 'download' && this.download !== undefined) }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name).add(listener)
  }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener) }
  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)) }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1)
    if (selector === 'a[href]') return this.tagName === 'A' && Boolean(this.href)
    if (selector.startsWith('[data-')) {
      const key = selector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      return this.dataset[key] !== undefined
    }
    return this.tagName.toLowerCase() === selector
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) }
  querySelector(selector) {
    for (const child of this.childNodes) {
      if (child.matches(selector)) return child
      const nested = child.querySelector(selector)
      if (nested) return nested
    }
    return null
  }
  querySelectorAll(selector) {
    return this.childNodes.flatMap(child => [ ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector) ])
  }
  focus() { this.ownerDocument.activeElement = this }
  showModal() { this.open = true }
  close() { this.open = false; this.emit('close') }
  emit(type, overrides = {}) {
    const event = { target: this, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...overrides }
    for (let node = this; node; node = node.parentNode) {
      for (const listener of node.listeners.get(type) || []) listener(event)
    }
    return event
  }
  click() { return this.emit('click') }
}

function setup(t, fetcher = async () => new Response('# Prepared reference\n\nA source-backed example.')) {
  const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch }
  const document = new TestNode(null, 'document')
  document.ownerDocument = document
  document.createElement = tag => new TestNode(document, tag)
  document.createTextNode = text => new TestNode(document, '', text)
  document.body = document.createElement('body')
  document.append(document.body)
  document.title = 'My working lesson'
  const trigger = document.createElement('a')
  trigger.href = '#material/source-pack'
  document.body.append(trigger)
  document.activeElement = trigger
  const window = {
    location: { href: 'https://workshop.test/#path/account-executive/2', origin: 'https://workshop.test', hash: '#path/account-executive/2' },
    scrollX: 3, scrollY: 730,
    scrollTo(x, y) { this.scrollX = x; this.scrollY = y },
    getSelection: () => null
  }
  globalThis.document = document
  globalThis.window = window
  globalThis.fetch = fetcher
  t.after(() => {
    closeMaterialReader()
    Object.assign(globalThis, previous)
  })
  return { document, window, trigger }
}

function find(root, predicate) {
  if (predicate(root)) return root
  for (const child of root.childNodes) {
    const match = find(child, predicate)
    if (match) return match
  }
  return null
}

test('procedure fences produce copyable Bash blocks and preserve numbered steps', t => {
  const { document } = setup(t)
  const content = document.createElement('section')
  renderMarkdown(content, [
    '1. Read the Skill.', '',
    '   ```bash',
    '   cat /skills/renewal-brief/SKILL.md',
    '   ```', '',
    '2. Run the script.', '',
    '   ```bash',
    '   python /skills/renewal-brief/scripts/render_brief.py --records-file /tmp/renewal-records.json --output /tmp/renewal-brief.json',
    '   ```', '',
    '3. Check the result.'
  ].join('\n'))
  assert.deepEqual(content.querySelectorAll('ol').map(list => list.getAttribute('start')), ['1', '2', '3'])
  const blocks = content.querySelectorAll('pre')
  assert.deepEqual(blocks.map(block => block.dataset.language), ['bash', 'bash'])
  assert.deepEqual(blocks.map(block => block.className), ['code', 'code'])
  assert.deepEqual(blocks.map(block => block.textContent), [
    'cat /skills/renewal-brief/SKILL.md',
    'python /skills/renewal-brief/scripts/render_brief.py --records-file /tmp/renewal-records.json --output /tmp/renewal-brief.json'
  ])
  assert.doesNotMatch(content.textContent, /```/)
})

test('fences accept up to three leading spaces while preserving inner code indentation', t => {
  const { document } = setup(t)
  for (const indent of [0, 1, 2, 3]) {
    const prefix = ' '.repeat(indent)
    const content = document.createElement('section')
    renderMarkdown(content, [
      'A command follows.',
      prefix + '```bash',
      prefix + 'if test -f /tmp/record.json; then',
      prefix + '  cat /tmp/record.json',
      prefix + 'fi',
      ' '.repeat(3 - indent) + '```'
    ].join('\n'))
    assert.equal(content.querySelector('pre').textContent, 'if test -f /tmp/record.json; then\n  cat /tmp/record.json\nfi')
    assert.equal(content.querySelector('pre').dataset.language, 'bash')
  }
})

test('shorter backtick runs inside a fenced block do not close it', t => {
  const { document } = setup(t)
  const content = document.createElement('section')
  renderMarkdown(content, '  ````text\n  ```bash\n  echo sample\n  ```\n ````\n\nA paragraph after the block.')
  assert.equal(content.querySelector('pre').textContent, '```bash\necho sample\n```')
  assert.match(content.textContent, /A paragraph after the block\./)
})

test('bundled native Skill procedure renders its exact three Bash commands and list numbers', async t => {
  const { document } = setup(t)
  const content = document.createElement('section')
  const skill = await readFile(new URL('../public/materials/native-renewal-brief/SKILL.md', import.meta.url), 'utf8')
  renderMarkdown(content, skill)
  assert.deepEqual(content.querySelectorAll('pre').map(block => block.textContent), [
    'cat /skills/renewal-brief/SKILL.md',
    'sha256sum /skills/renewal-brief/scripts/contract.py /skills/renewal-brief/scripts/render_brief.py',
    'python /skills/renewal-brief/scripts/render_brief.py --records-file /tmp/renewal-records.json --output /tmp/renewal-brief.json'
  ])
  assert.deepEqual(content.querySelectorAll('ol').map(list => list.getAttribute('start')), ['1', '2', '4', '5'])
  assert.deepEqual(content.querySelectorAll('ol').map(list => list.querySelectorAll('li').length), [1, 2, 1, 2])
})

test('reader keeps lesson DOM, route, title, scroll, and exact return focus', async t => {
  const { document, window, trigger } = setup(t)
  const lesson = document.createElement('main')
  const input = document.createElement('textarea')
  input.value = 'My unsaved answer'
  lesson.append(input)
  document.body.append(lesson)
  assert.equal(await openMaterialReader('source-pack', { trigger, contextLabel: 'Northstar practice' }), true)
  const dialog = document.querySelector('dialog')
  assert.equal(dialog.open, true)
  assert.equal(document.title, 'My working lesson')
  assert.equal(window.location.hash, '#path/account-executive/2')
  assert.equal(lesson.childNodes[0], input)
  assert.equal(input.value, 'My unsaved answer')
  assert.equal(document.activeElement.id, 'material-reader-title')
  window.scrollY = 999
  find(dialog, node => node.tagName === 'BUTTON' && node.textContent === 'Close reference').click()
  assert.equal(document.querySelector('dialog'), null)
  assert.equal(document.activeElement, trigger)
  assert.equal(window.scrollY, 730)
  assert.equal(window.scrollX, 3)
})

test('nested reference links stay in reader and Previous reference restores reading position', async t => {
  const { document, window } = setup(t, async url => new Response(url.includes('source-pack')
    ? '# Source\n\n[Use the client](https://learn.fluxcapacitor.dev/#material/api-client)' : 'print("client")'))
  await openMaterialReader('source-pack')
  const dialog = document.querySelector('dialog')
  const content = find(dialog, node => node.className === 'material-reader-content')
  content.scrollTop = 245
  const sourceLink = find(content, node => node.tagName === 'A' && node.href === '#material/api-client')
  assert.equal(sourceLink.click().defaultPrevented, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.match(content.textContent, /Direct Claude API client/)
  find(dialog, node => node.tagName === 'BUTTON' && node.textContent === 'Previous reference').click()
  await new Promise(resolve => setImmediate(resolve))
  assert.match(content.textContent, /Northstar source pack/)
  assert.equal(content.scrollTop, 245)
  assert.equal(window.location.hash, '#path/account-executive/2')
})

test('Escape aborts loading and stale responses cannot revive a closed reader', async t => {
  let resolve
  let signal
  const { document, trigger } = setup(t, (_url, options) => {
    signal = options.signal
    return new Promise(done => { resolve = done })
  })
  const opening = openMaterialReader('source-pack')
  const dialog = document.querySelector('dialog')
  assert.equal(dialog.emit('cancel').defaultPrevented, true)
  assert.equal(signal.aborted, true)
  resolve(new Response('# Too late'))
  assert.equal(await opening, false)
  assert.equal(document.querySelector('dialog'), null)
  assert.equal(document.activeElement, trigger)
})

test('a later reader navigation wins over an earlier pending response', async t => {
  let resolveFirst
  const { document } = setup(t, async url => url.includes('source-pack')
    ? new Promise(resolve => { resolveFirst = resolve }) : new Response('# Latest material'))
  const first = openMaterialReader('source-pack')
  await openMaterialReader('hooks-lab')
  resolveFirst(new Response('# Stale material'))
  assert.equal(await first, false)
  assert.match(document.querySelector('dialog').textContent, /Latest material/)
  assert.doesNotMatch(document.querySelector('dialog').textContent, /Stale material/)
})

test('allowlisted delegated links preserve browser modifier and download behavior', async t => {
  const { document, trigger } = setup(t)
  const uninstall = installMaterialReaderLinks(document)
  assert.equal(trigger.emit('click', { metaKey: true }).defaultPrevented, false)
  assert.equal(document.querySelector('dialog'), null)
  trigger.download = ''
  assert.equal(trigger.click().defaultPrevented, false)
  delete trigger.download
  assert.equal(trigger.click().defaultPrevented, true)
  await new Promise(resolve => setImmediate(resolve))
  closeMaterialReader()
  uninstall()
  assert.equal(trigger.click().defaultPrevented, false)
  for (const href of ['javascript:alert(1)', '#material/private-file', 'https://other.test/#material/source-pack', '/materials/not-allowed.md']) {
    assert.equal(materialIdForHref(href), null)
  }
  assert.equal(materialIdForHref('/materials/northstar-source-pack.md'), 'source-pack')
  assert.equal(materialIdForHref('https://learn.fluxcapacitor.dev/#material/native-integration'), 'native-integration')
})

test('Ask prefers reader selection and otherwise uses visible material content', async t => {
  const { document, window } = setup(t, async () => new Response('# Reference\n\nThe exact source fact.\n\n[Open a guide](https://example.com/)'))
  const requests = []
  await openMaterialReader('source-pack', { onAsk: request => requests.push(request) })
  const dialog = document.querySelector('dialog')
  const ask = find(dialog, node => node.tagName === 'BUTTON' && node.textContent === 'Ask about this reference')
  const materialBody = dialog.querySelector('[data-material-body]')
  window.getSelection = () => ({ rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: materialBody }), toString: () => 'The exact source fact.' })
  ask.emit('pointerdown')
  window.getSelection = () => null
  ask.click()
  assert.equal(requests[0].text, 'The exact source fact.')
  assert.equal(requests[0].materialId, 'source-pack')
  assert.equal(requests[0].trigger, ask)
  ask.click()
  assert.match(requests[1].text, /The exact source fact/)
  assert.doesNotMatch(requests[1].text, /View original on GitHub|Close reference|Ask about/)
})

test('Ask passes the full material excerpt so the caller can disclose truncation', async t => {
  const passage = 'A'.repeat(7000)
  const { document } = setup(t, async () => new Response(passage))
  let request
  await openMaterialReader('source-pack', { onAsk: value => { request = value } })
  find(document.querySelector('dialog'), node => node.tagName === 'BUTTON' && node.textContent === 'Ask about this reference').click()
  assert.equal(request.text, passage)
})

test('Ask preserves highlighted code text without inserting newlines between tokens', async t => {
  const { document } = setup(t)
  let request
  await openMaterialReader('api-client', { onAsk: value => { request = value } })
  const dialog = document.querySelector('dialog')
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  const expected = '{"model":"claude-sonnet-4-6","max_tokens":100}'
  for (const token of ['{', '"model"', ':', '"claude-sonnet-4-6"', ',', '"max_tokens"', ':', '100', '}']) {
    const span = document.createElement('span')
    span.textContent = token
    code.append(span)
  }
  pre.append(code)
  dialog.querySelector('[data-material-body]').replaceChildren(pre)
  find(dialog, node => node.tagName === 'BUTTON' && node.textContent === 'Ask about this reference').click()
  assert.equal(request.text, expected)
})

test('readableText keeps inline code, strong text, and links in the paragraph text run', t => {
  const { document } = setup(t)
  const content = document.createElement('section')
  renderMarkdown(content, [
    '# Request fields', '',
    'Set `max_tokens` to **100** and read [the guide](https://example.com/guide) before sending.', '',
    'Keep the source record nearby.'
  ].join('\n'))
  assert.equal(readableText(content.querySelector('p')), 'Set max_tokens to 100 and read the guide before sending.')
  assert.equal(readableText(content), 'Request fields\nSet max_tokens to 100 and read the guide before sending.\nKeep the source record nearby.')
})

test('readableText separates table cells with pipes and keeps each row on its own line', t => {
  const { document } = setup(t)
  const content = document.createElement('section')
  renderMarkdown(content, [
    'Read the request contract.', '',
    '| Field | Meaning |',
    '| --- | --- |',
    '| `model` | **Model** identifier |',
    '| `max_tokens` | [Response limit](https://example.com/limit) |', '',
    'Then run the example.'
  ].join('\n'))
  assert.equal(readableText(content.querySelector('table')), 'Field | Meaning\nmodel | Model identifier\nmax_tokens | Response limit')
  assert.equal(readableText(content), 'Read the request contract.\nField | Meaning\nmodel | Model identifier\nmax_tokens | Response limit\nThen run the example.')
})

test('readableText excludes controls, hidden content, actions, toolbars, and status UI', t => {
  const { document } = setup(t)
  const content = document.createElement('section')
  const paragraph = document.createElement('p')
  paragraph.textContent = 'The visible source fact.'
  content.append(paragraph)
  for (const tag of ['button', 'input', 'textarea', 'select']) {
    const control = document.createElement(tag)
    control.textContent = 'Private input or control text'
    content.append(control)
  }
  for (const [attribute, value] of [['hidden', ''], ['aria-hidden', 'true'], ['role', 'status']]) {
    const hidden = document.createElement('div')
    hidden.textContent = 'Unrelated hidden or status text'
    hidden.setAttribute(attribute, value)
    content.append(hidden)
  }
  for (const className of ['actions', 'code-toolbar', 'status']) {
    const toolbar = document.createElement('div')
    toolbar.className = className
    toolbar.textContent = 'Toolbar or status text'
    content.append(toolbar)
  }
  assert.equal(readableText(content), 'The visible source fact.')
})

test('prepared native bundle reads local files and GitHub originals use normal navigation', async t => {
  const urls = []
  const { document } = setup(t, async url => {
    urls.push(url)
    return new Response('# Skill instructions\n\n[Contract](references/OUTPUT_CONTRACT.md)')
  })
  await openMaterialReader('native-integration-code', { githubRef: 'another-ref' })
  const dialog = document.querySelector('dialog')
  assert.match(urls[0], /\/materials\/native-renewal-brief\/SKILL\.md$/)
  const original = find(dialog, node => node.tagName === 'A' && node.textContent === 'View original on GitHub')
  assert.match(original.href, /\/tree\/c74acd400dbb05243116993ada98f23349616549\/labs\/skills\/renewal-brief$/)
  assert.equal(original.target, undefined)
  assert.equal(original.click().defaultPrevented, false)
  const contractLink = find(dialog, node => node.tagName === 'A' && node.textContent === 'Contract')
  assert.equal(contractLink.dataset.materialFileTarget, 'references/OUTPUT_CONTRACT.md')
  assert.equal(contractLink.click().defaultPrevented, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.match(urls.at(-1), /\/materials\/native-renewal-brief\/references\/OUTPUT_CONTRACT\.md$/)
  find(dialog, node => node.tagName === 'BUTTON' && node.textContent === 'Output contract').click()
  await new Promise(resolve => setImmediate(resolve))
  assert.match(urls.at(-1), /\/materials\/native-renewal-brief\/references\/OUTPUT_CONTRACT\.md$/)
  for (const path of ['SKILL.md', 'references/OUTPUT_CONTRACT.md', 'scripts/contract.py', 'scripts/render_brief.py']) {
    assert.ok((await readFile(new URL(`../public/materials/native-renewal-brief/${path}`, import.meta.url), 'utf8')).length)
  }
})

test('the native Skill README routes to setup before the pinned bundle', t => {
  setup(t)
  const repository = 'https://github.com/cfregly/learn-claude-workshop'
  for (const ref of ['c0ffcb96053c3405fc2b48c1854fe0c331b006de', 'c74acd400dbb05243116993ada98f23349616549']) {
    assert.equal(materialIdForHref(`${repository}/blob/${ref}/labs/skills/renewal-brief/README.md`, { repository: true }), 'native-integration-setup')
    assert.equal(materialIdForHref(`${repository}/tree/${ref}/labs/skills/renewal-brief`, { repository: true }), 'native-integration-code')
    for (const file of ['SKILL.md', 'references/OUTPUT_CONTRACT.md', 'scripts/contract.py', 'scripts/render_brief.py']) {
      assert.equal(materialIdForHref(`${repository}/blob/${ref}/labs/skills/renewal-brief/${file}`, { repository: true }), 'native-integration-code')
    }
  }
  assert.equal(materialIdForHref('/materials/native-renewal-brief-README.md'), 'native-integration-setup')
  assert.equal(materialIdForHref('#material/native-integration-setup'), 'native-integration-setup')
  assert.equal(materialIdForHref('https://github.com/another-owner/learn-claude-workshop/blob/main/labs/skills/renewal-brief/README.md', { repository: true }), null)
})

test('the native guide opens the standalone README inline and keeps the native bundle pinned', async t => {
  const guide = await readFile(new URL('../public/materials/skills-tools-example.md', import.meta.url), 'utf8')
  const urls = []
  const { document } = setup(t, async url => {
    urls.push(url)
    return new Response(url.endsWith('/skills-tools-example.md') ? guide : '')
  })
  await openMaterialReader('native-integration', { githubRef: 'unrelated-material-ref' })
  let dialog = document.querySelector('dialog')
  const setupLink = find(dialog, node => node.tagName === 'A' && node.textContent === 'Skill lab')
  assert.equal(setupLink.href, '#material/native-integration-setup')
  assert.equal(setupLink.dataset.materialFileTarget, undefined)
  assert.equal(setupLink.click().defaultPrevented, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.match(urls.at(-1), /\/materials\/native-renewal-brief-README\.md$/)
  dialog = document.querySelector('dialog')
  assert.equal(find(dialog, node => node.tagName === 'A' && node.textContent === 'View original on GitHub').href,
    'https://github.com/cfregly/learn-claude-workshop/blob/c0ffcb96053c3405fc2b48c1854fe0c331b006de/labs/skills/renewal-brief/README.md')
  await openMaterialReader('native-integration-code')
  assert.match(urls.at(-1), /\/materials\/native-renewal-brief\/SKILL\.md$/)
  assert.equal(find(dialog, node => node.tagName === 'A' && node.textContent === 'View original on GitHub').href,
    'https://github.com/cfregly/learn-claude-workshop/tree/c74acd400dbb05243116993ada98f23349616549/labs/skills/renewal-brief')
})

test('protocol code ref is independent of guide and unrelated material refs', async t => {
  const { document } = setup(t)
  const container = document.createElement('main')
  document.body.append(container)
  for (const [slug, path, tree = false] of [
    ['native-integration', 'docs/skills-tools-example.md'],
    ['native-integration-setup', 'labs/skills/renewal-brief/README.md'],
    ['renewal-skill', 'app/public/materials/renewal-brief/SKILL.md'],
    ['facilitator', 'docs/facilitator-guide.md'],
    ['security', 'docs/security-workshop.md'],
    ['live-stream-tool', 'docs/live-stream-tool-demo.md'],
    ['api-client', 'labs/claude_api_demo.py'],
    ['notebook', 'labs/api-trace.ipynb'],
    ['claude-for-work', 'docs/claude-for-work.md'],
    ['incomplete-response', 'docs/incomplete-response.md'],
    ['renewal-code', 'labs/northstar-renewals/starter', true],
    ['streaming-lab', 'docs/streaming-lab.md']
  ]) {
    await renderMaterial(container, slug, { githubRef: 'unrelated-material-ref' })
    assert.equal(find(container, node => node.tagName === 'A' && node.textContent === 'View original on GitHub').href,
      `https://github.com/cfregly/learn-claude-workshop/${tree ? 'tree' : 'blob'}/c0ffcb96053c3405fc2b48c1854fe0c331b006de/${path}`)
  }
  await renderMaterial(container, 'live-stream-tool-code', { githubRef: 'unrelated-material-ref' })
  assert.equal(find(container, node => node.tagName === 'A' && node.textContent === 'View original on GitHub').href,
    'https://github.com/cfregly/learn-claude-workshop/blob/cf21755b981ed1edebd081d4ec89a128b385a680/labs/live-stream-tool-demo.py')
  assert.equal(materialIdForHref('https://github.com/cfregly/learn-claude-workshop/blob/c0ffcb96053c3405fc2b48c1854fe0c331b006de/app/public/materials/renewal-brief/SKILL.md', { repository: true }), 'renewal-skill')
  await renderMaterial(container, 'source-pack', { githubRef: 'unrelated-material-ref' })
  assert.equal(find(container, node => node.tagName === 'A' && node.textContent === 'View original on GitHub').href,
    'https://github.com/cfregly/learn-claude-workshop/blob/unrelated-material-ref/docs/northstar-source-pack.md')
})

test('direct material routes retain their existing route-bound rendering', async t => {
  const { document } = setup(t)
  const container = document.createElement('main')
  document.body.append(container)
  await renderMaterial(container, 'source-pack')
  assert.equal(document.title, 'Northstar source pack | Learn Claude workshop')
  assert.equal(container.getAttribute('aria-busy'), 'false')
  assert.equal(await openMaterialReader('not-a-material'), false)
})
