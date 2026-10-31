const REPO = 'https://github.com/cfregly/learn-claude-workshop'
const NATIVE_REF = 'c74acd400dbb05243116993ada98f23349616549'
const UPDATED_GUIDES_REF = 'c0ffcb96053c3405fc2b48c1854fe0c331b006de'
const renders = new WeakMap()
let readerSession = null

const materials = {
  'native-integration': {
    title: 'MCP context and a runnable Skill',
    description: 'Read the prepared guide alongside the live integration. Keep source records, Skill instructions, and runtime receipts distinct.',
    local: '/materials/skills-tools-example.md', github: 'docs/skills-tools-example.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'native-integration-code': {
    title: 'Renewal brief Skill bundle',
    description: 'Read the instructions, output contract, and Python scripts used by the native integration.',
    local: '/materials/native-renewal-brief/SKILL.md', github: 'labs/skills/renewal-brief', githubRef: NATIVE_REF, kind: 'skill', tree: true
  },
  'native-integration-setup': {
    title: 'Standalone native Skill setup',
    description: 'Install the standalone lab, run its offline checks, and review the separate upload and execution steps.',
    local: '/materials/native-renewal-brief-README.md', github: 'labs/skills/renewal-brief/README.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'live-stream-tool': {
    title: 'Live streaming and a read-only lookup',
    description: 'Run the real Northstar tool round trip, stream the draft, and keep generation separate from source review.',
    local: '/materials/live-stream-tool-demo.md', github: 'docs/live-stream-tool-demo.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'live-stream-tool-code': {
    title: 'Runnable streaming and tool client',
    description: 'A Python SDK exercise with an offline default and an explicit live streaming mode.',
    local: '/materials/live-stream-tool-demo.py', github: 'labs/live-stream-tool-demo.py', githubRef: UPDATED_GUIDES_REF, kind: 'python'
  },
  'hooks-lab': {
    title: 'Before and after an account action',
    description: 'Compare application authorization with hooks, middleware, and asynchronous notifications. Test the synthetic dispatcher.',
    local: '/materials/hooks-lab.md', github: 'docs/hooks-lab.md', kind: 'markdown'
  },
  'hook-dispatcher': {
    title: 'Mock account-action dispatcher',
    description: 'A standard-library Python example. Run its allowed, denied, forged-approval, timeout, and after-action checks offline.',
    local: '/materials/hook_dispatcher.py', github: 'labs/hook_dispatcher.py', kind: 'python'
  },
  'diagnostic-instructor-guide': {
    title: 'Diagnosis instructor key',
    description: 'Eight synthetic evidence cases, completed references, exact rejoins, changed cases, and a diagnosis rubric.',
    local: '/materials/diagnostic-instructor-guide.md', github: 'docs/diagnostic-instructor-guide.md', kind: 'markdown'
  },
  'renewal-skill': {
    title: 'Renewal brief Skill',
    description: 'A reviewed procedure with when-to-use metadata, source checks, a learning check, and a changed case.',
    local: '/materials/renewal-brief/SKILL.md', github: 'app/public/materials/renewal-brief/SKILL.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'supporting-features': {
    title: 'Extend the renewal workflow',
    description: 'Choose one optional extension for your role. Keep the same account, evidence, and review boundary.',
    local: '/materials/supporting-features.md', github: 'docs/supporting-features.md', kind: 'markdown'
  },
  'thinking-lab': {
    title: 'Thinking, display, and budgets',
    description: 'Choose a supported model configuration, distinguish effort from output limits, and preserve the tool-turn contract.',
    local: '/materials/thinking-lab.md', github: 'docs/thinking-lab.md', kind: 'markdown'
  },
  'model-capabilities': {
    title: 'Observed model capabilities',
    description: 'A Models API excerpt. Check the selected model before choosing a configuration.',
    local: '/materials/model-capabilities.json', github: 'docs/model-capabilities.json', kind: 'json'
  },
  'streaming-lab': {
    title: 'Claude API event lab reference',
    description: 'An annotated tool cycle, truthful progress states, failure drills, and checks for engineers, sales, and product.',
    local: '/materials/streaming-lab.md', github: 'docs/streaming-lab.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'claude-for-work': {
    title: 'Claude for Work activity',
    description: 'Set up a private Project, use the synthetic records, and complete the task for your role.',
    local: '/materials/claude-for-work.md', github: 'docs/claude-for-work.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'incomplete-response': {
    title: 'When a draft stops early',
    description: 'One failure taught through an annotated API trace and a source-checked business brief.',
    local: '/materials/incomplete-response.md', github: 'docs/incomplete-response.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'source-pack': {
    title: 'Northstar source pack',
    description: 'Synthetic account records, known facts, open questions, and a source-checked reference brief.',
    local: '/materials/northstar-source-pack.md', github: 'docs/northstar-source-pack.md', kind: 'markdown'
  },
  facilitator: {
    title: 'Facilitator guide',
    description: 'Agendas, recovery options, teach-back prompts, and return points for a working session.',
    local: '/materials/facilitator-guide.md', github: 'docs/facilitator-guide.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  security: {
    title: 'Security and regulated workflows',
    description: 'A prepared review of data boundaries, permissions, retention, failure handling, and cost.',
    local: '/materials/security-workshop.md', github: 'docs/security-workshop.md', githubRef: UPDATED_GUIDES_REF, kind: 'markdown'
  },
  'api-client': {
    title: 'Direct Claude API client',
    description: 'A dry-run-first Python client for use in your own approved environment.',
    local: '/materials/claude_api_demo.py', github: 'labs/claude_api_demo.py', githubRef: UPDATED_GUIDES_REF, kind: 'python'
  },
  fixtures: {
    title: 'Evaluation fixtures',
    description: 'Prepared ordinary, conflicting, unsupported, and untrusted-input cases.',
    local: '/materials/source-fixtures.json', github: 'labs/source-fixtures.json', kind: 'json'
  },
  notebook: {
    title: 'Engineer notebook',
    description: 'Prepared Markdown and code, saved without outputs. Nothing runs in this browser.',
    local: '/materials/api-trace.ipynb', github: 'labs/api-trace.ipynb', githubRef: UPDATED_GUIDES_REF, kind: 'notebook'
  },
  'renewal-code': {
    title: 'Claude Code practice repository',
    description: 'Read the starter files inline, then open the reference notes or solution only when useful.',
    local: '/materials/northstar-renewals.zip', github: 'labs/northstar-renewals/starter', githubRef: UPDATED_GUIDES_REF, kind: 'renewal', tree: true
  }
}

const starterFiles = [
  ['README', 'starter/README.md', 'markdown'],
  ['src/renewals.py', 'starter/src/renewals.py', 'python'],
  ['tests/test_renewals.py', 'starter/tests/test_renewals.py', 'python']
]
const solutionFiles = [
  ['Reference fix notes', 'REFERENCE_FIX.md', 'markdown'],
  ['Solution README', 'solution/README.md', 'markdown'],
  ['Solution renewals.py', 'solution/src/renewals.py', 'python'],
  ['Solution tests', 'solution/tests/test_renewals.py', 'python']
]
const skillFiles = [
  ['SKILL.md', 'SKILL.md', 'markdown'],
  ['Output contract', 'references/OUTPUT_CONTRACT.md', 'markdown'],
  ['contract.py', 'scripts/contract.py', 'python'],
  ['render_brief.py', 'scripts/render_brief.py', 'python']
]

function node(tag, className = '', text = '') {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

function safeHref(value, { sameOrigin = false, base = window.location.href } = {}) {
  try {
    const url = new URL(String(value), base)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (sameOrigin && url.origin !== window.location.origin) return null
    return url.href
  } catch { return null }
}

function githubHref(path, ref, tree = false) {
  const encodedRef = String(ref).split('/').map(encodeURIComponent).join('/')
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${REPO}/${tree ? 'tree' : 'blob'}/${encodedRef}/${encodedPath}`
}

function link(label, href, className = '') {
  const anchor = node('a', className, label)
  anchor.href = href
  return anchor
}

// Only prepared, bundled materials can open in the reader. No remote URL is fetched.
export function materialIdForHref(value, { repository = false } = {}) {
  const href = safeHref(value)
  if (!href) return null
  const url = new URL(href)
  if (repository && url.origin === 'https://github.com' && url.pathname.startsWith('/cfregly/learn-claude-workshop/')) {
    const path = url.pathname.replace(/^\/cfregly\/learn-claude-workshop\/(?:blob|tree)\/[^/]+\//, '')
    if (path === materials['native-integration-setup'].github) return 'native-integration-setup'
    if (/^labs\/skills\/renewal-brief(?:\/|$)/.test(path)) return 'native-integration-code'
    const entry = Object.entries(materials).find(([, material]) => material.github === path)
    return entry?.[0] || null
  }
  if (![window.location.origin, 'https://learn.fluxcapacitor.dev'].includes(url.origin)) return null
  const route = url.hash.match(/^#material\/([a-z0-9-]+)$/)
  if (route && Object.hasOwn(materials, route[1])) return route[1]
  const entry = Object.entries(materials).find(([, material]) => material.local === url.pathname)
  return entry?.[0] || null
}

function appendInline(parent, source, base) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    parent.append(document.createTextNode(source.slice(cursor, match.index)))
    const token = match[0]
    if (token.startsWith('`')) parent.append(node('code', '', token.slice(1, -1)))
    else if (token.startsWith('**')) parent.append(node('strong', '', token.slice(2, -2)))
    else {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      const href = parts && safeHref(parts[2], { base })
      const materialId = href && materialIdForHref(href, { repository: true })
      if (href) {
        const anchor = link(parts[1], materialId ? `#material/${materialId}` : href)
        const file = new URL(href).pathname.split('/labs/skills/renewal-brief/')[1]
        if (materialId === 'native-integration-code' && skillFiles.some(entry => entry[1] === file)) anchor.dataset.materialFileTarget = file
        parent.append(anchor)
      }
      else parent.append(document.createTextNode(parts ? parts[1] : token))
    }
    cursor = match.index + token.length
  }
  parent.append(document.createTextNode(source.slice(cursor)))
}

function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(value => value.trim())
}

function tableDivider(line) {
  const cells = tableCells(line)
  return cells.length > 0 && cells.every(value => /^:?-{3,}:?$/.test(value))
}

function fenceStart(line) {
  return line.match(/^( {0,3})(`{3,})([^`]*)$/)
}

function blockStart(lines, index) {
  const line = lines[index] || ''
  return Boolean(fenceStart(line)) || /^#{1,6}\s+/.test(line) || /^\s*(?:[-+*]|\d+\.)\s+/.test(line)
    || (line.includes('|') && tableDivider(lines[index + 1] || ''))
}

export function renderMarkdown(target, markdown, { base } = {}) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n')
  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }
    const fence = fenceStart(line)
    if (fence) {
      const body = []
      const language = fence[3].trim().split(/\s+/)[0]
      const closing = new RegExp('^ {0,3}`{' + fence[2].length + ',}[ \\t]*$')
      const indentation = new RegExp('^ {0,' + fence[1].length + '}')
      index += 1
      while (index < lines.length && !closing.test(lines[index])) body.push(lines[index++].replace(indentation, ''))
      if (index < lines.length) index += 1
      if (language && language !== 'text') target.append(node('p', 'code-label', `Code · ${language}`))
      const code = node('pre', language === 'text' ? 'source-record' : 'code', body.join('\n'))
      code.dataset.language = language
      target.append(code)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const element = node(`h${Math.min(6, heading[1].length + 1)}`)
      appendInline(element, heading[2], base)
      target.append(element)
      index += 1
      continue
    }
    if (line.includes('|') && tableDivider(lines[index + 1] || '')) {
      const wrap = node('div', 'table-wrap')
      const table = node('table')
      const head = node('thead')
      const headRow = node('tr')
      for (const value of tableCells(line)) {
        const cell = node('th'); appendInline(cell, value, base); headRow.append(cell)
      }
      head.append(headRow); table.append(head)
      const body = node('tbody')
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const row = node('tr')
        for (const value of tableCells(lines[index])) {
          const cell = node('td'); appendInline(cell, value, base); row.append(cell)
        }
        body.append(row); index += 1
      }
      table.append(body); wrap.append(table); target.append(wrap)
      continue
    }
    const item = line.match(/^\s*([-+*]|\d+\.)\s+(.+)$/)
    if (item) {
      const ordered = /\d/.test(item[1])
      const list = node(ordered ? 'ol' : 'ul')
      if (ordered) list.setAttribute('start', item[1].slice(0, -1))
      while (index < lines.length) {
        const current = lines[index].match(/^\s*([-+*]|\d+\.)\s+(.+)$/)
        if (!current || /\d/.test(current[1]) !== ordered) break
        const entry = node('li'); appendInline(entry, current[2], base); list.append(entry); index += 1
      }
      target.append(list)
      continue
    }
    const paragraphLines = [line.trim()]
    index += 1
    while (index < lines.length && lines[index].trim() && !blockStart(lines, index)) paragraphLines.push(lines[index++].trim())
    const paragraph = node('p'); appendInline(paragraph, paragraphLines.join(' '), base); target.append(paragraph)
  }
}

function renderCode(target, text, kind, label = '') {
  let source = text
  if (kind === 'json') {
    try { source = JSON.stringify(JSON.parse(text), null, 2) }
    catch { throw new Error('The prepared JSON file is not valid JSON.') }
  }
  target.append(node('p', 'code-label', label || `Prepared ${kind === 'python' ? 'Python' : 'JSON'} file`))
  target.append(node('pre', 'code', source))
}

function renderNotebook(target, text, options) {
  let notebook
  try { notebook = JSON.parse(text) } catch { throw new Error('The prepared notebook is not valid JSON.') }
  if (!Array.isArray(notebook.cells)) throw new Error('The prepared notebook has no readable cells.')
  notebook.cells.forEach((cell, index) => {
    const section = node('section', 'reference')
    const source = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')
    if (cell.cell_type === 'markdown') {
      section.append(node('p', 'code-label', `Prepared Markdown cell ${index + 1}`))
      renderMarkdown(section, source, options)
    } else if (cell.cell_type === 'code') {
      section.append(node('p', 'code-label', `Prepared code cell ${index + 1} · not executed in this browser`))
      section.append(node('pre', 'code', source))
      const outputs = Array.isArray(cell.outputs) ? cell.outputs : []
      outputs.forEach(output => {
        const saved = output.text ?? output.data?.['text/plain'] ?? output.traceback
        if (saved == null) return
        section.append(node('p', 'code-label', 'Saved prepared output · not executed in this browser'))
        section.append(node('pre', 'answer-text', Array.isArray(saved) ? saved.join('') : String(saved)))
      })
    }
    target.append(section)
  })
}

function current(container, token) {
  return renders.get(container) === token && !token.controller.signal.aborted
    && (!token.routeBound || window.location.hash === token.hash)
}

async function fetchText(path, token) {
  const href = safeHref(path, { sameOrigin: true })
  if (!href) throw new Error('The material path is invalid.')
  const response = await fetch(href, { signal: token.controller.signal, credentials: 'same-origin', cache: 'no-cache' })
  if (!response.ok) throw new Error(`The material is unavailable (${response.status}).`)
  return response.text()
}

function renderContent(target, text, kind, options) {
  if (kind === 'markdown') renderMarkdown(target, text, options)
  else if (kind === 'notebook') renderNotebook(target, text, options)
  else renderCode(target, text, kind)
}

function filePanel(githubRef, token, container, { local = '/materials/renewals', github = 'labs/northstar-renewals' } = {}) {
  const panel = node('div', 'answer-text')
  panel.dataset.materialContent = 'true'
  let request = 0
  const show = async (file, buttons) => {
    const fileRequest = ++request
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.materialFile === file[1])))
    panel.replaceChildren(node('p', 'empty', `Loading ${file[1]}…`))
    try {
      const text = await fetchText(`${local}/${file[1]}`, token)
      if (!current(container, token) || fileRequest !== request) return
      const heading = node('div', 'actions')
      heading.append(node('h2', '', file[1]))
      heading.append(link('View this file on GitHub', githubHref(`${github}/${file[1]}`, githubRef), 'button quiet'))
      panel.replaceChildren(heading)
      renderContent(panel, text, file[2], { base: githubHref(`${github}/${file[1]}`, githubRef) })
    } catch (error) {
      if (!current(container, token) || error.name === 'AbortError' || fileRequest !== request) return
      panel.replaceChildren(node('p', 'empty', error.message || 'This file could not be opened.'))
    }
  }
  return { panel, show }
}

async function renderSkill(body, githubRef, token, container) {
  const files = filePanel(githubRef, token, container, {
    local: '/materials/native-renewal-brief', github: 'labs/skills/renewal-brief'
  })
  const actions = node('div', 'actions')
  actions.setAttribute('aria-label', 'Skill bundle files')
  const buttons = skillFiles.map(file => {
    const button = node('button', 'button secondary', file[0])
    button.type = 'button'
    button.dataset.materialFile = file[1]
    button.addEventListener('click', () => { void files.show(file, buttons) })
    actions.append(button)
    return button
  })
  body.append(actions, files.panel)
  await files.show(skillFiles[0], buttons)
}

async function renderRenewal(body, githubRef, token, container) {
  const intro = node('p', 'lead', 'Start with the README, implementation, and tests. The reference material stays separate so the exercise remains useful.')
  body.append(intro)
  const starter = filePanel(githubRef, token, container)
  const starterActions = node('div', 'actions')
  const starterButtons = starterFiles.map(file => {
    const button = node('button', 'button secondary', file[0])
    button.type = 'button'; button.dataset.materialFile = file[1]
    button.addEventListener('click', () => { void starter.show(file, starterButtons) })
    starterActions.append(button); return button
  })
  body.append(starterActions, starter.panel)

  const reference = node('details', 'reference')
  reference.append(node('summary', '', 'Optional reference notes and solution'))
  reference.append(node('p', 'small muted', 'Open these only after you have inspected or changed the starter.'))
  const solution = filePanel(githubRef, token, container)
  const solutionActions = node('div', 'actions')
  const solutionButtons = solutionFiles.map(file => {
    const button = node('button', 'button quiet', file[0])
    button.type = 'button'; button.dataset.materialFile = file[1]
    button.addEventListener('click', () => { void solution.show(file, solutionButtons) })
    solutionActions.append(button); return button
  })
  reference.append(solutionActions, solution.panel); body.append(reference)
  await starter.show(starterFiles[0], starterButtons)
}

function pageShell(material, slug, githubRef, backHref, reader) {
  const page = node('div', 'page')
  page.dataset.materialSlug = slug
  const safeBack = safeHref(backHref, { sameOrigin: true }) || `${window.location.origin}/#resources`
  if (!reader) page.append(link(backHref.startsWith('#path/') ? '← Back to your lesson' : '← Back to workshop materials', safeBack, 'back-link'))
  const header = node('div', 'resource-header')
  const heading = node(reader ? 'h2' : 'h1', '', material.title)
  if (reader) {
    heading.id = 'material-reader-title'
    heading.tabIndex = -1
  }
  header.append(heading, node('p', 'lead', material.description))
  const actions = node('div', 'actions')
  actions.append(link('View original on GitHub', githubHref(material.github, githubRef, material.tree), 'button quiet'))
  const download = link(material.kind === 'renewal' ? 'Download ZIP' : 'Download file', material.local, 'button quiet')
  download.download = ''
  if (material.kind !== 'skill') actions.append(download)
  header.append(actions); page.append(header)
  const body = node('section', 'answer-text')
  body.dataset.materialBody = 'true'
  page.append(body)
  return { page, body }
}

export async function renderMaterial(container, slug, { githubRef = 'main', backHref = '#resources', reader = false } = {}) {
  const previous = renders.get(container)
  if (previous) previous.controller.abort()
  const token = { controller: new AbortController(), hash: window.location.hash, routeBound: !reader }
  renders.set(container, token)
  const material = materials[slug]
  githubRef = material?.githubRef || githubRef
  if (!reader) document.title=(material?material.title:'Material not found')+' | Learn Claude workshop'
  if (!material) {
    const page = node('div', 'page')
    page.append(node('h1', '', 'Material not found'), link('Back to workshop materials', safeHref(backHref, { sameOrigin: true }) || '#resources', 'button'))
    container.replaceChildren(page)
    return
  }
  const { page, body } = pageShell(material, slug, githubRef, backHref, reader)
  body.append(node('p', 'empty', 'Loading prepared material…'))
  container.replaceChildren(page)
  container.setAttribute('aria-busy', 'true')
  try {
    if (material.kind === 'renewal' || material.kind === 'skill') {
      body.replaceChildren()
      await (material.kind === 'renewal' ? renderRenewal : renderSkill)(body, githubRef, token, container)
    } else {
      const text = await fetchText(material.local, token)
      if (!current(container, token)) return
      body.replaceChildren()
      renderContent(body, text, material.kind, { base: githubHref(material.github, githubRef) })
    }
    if (current(container, token)) container.setAttribute('aria-busy', 'false')
  } catch (error) {
    if (!current(container, token) || error.name === 'AbortError') return
    body.replaceChildren(node('h2', '', 'This material could not be opened'), node('p', 'empty', error.message || 'Try again from the materials page.'))
    container.setAttribute('aria-busy', 'false')
  }
}

function selectedReaderText(session) {
  const selection = window.getSelection?.()
  if (!selection?.rangeCount || !session.content.contains(selection.getRangeAt(0).commonAncestorContainer)) return ''
  return selection.toString().trim()
}

const textBlocks = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE',
  'TBODY', 'TFOOT', 'THEAD', 'TR', 'UL'
])

export function readableText(element) {
  if (!element) return ''
  if (element.nodeType === 3) return element.textContent
  if (/^(BUTTON|INPUT|TEXTAREA|SELECT|OPTION|OPTGROUP|SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(element.tagName)
    || element.hidden || element.hasAttribute?.('hidden') || element.getAttribute?.('aria-hidden') === 'true'
    || element.getAttribute?.('role') === 'status'
    || /(?:^|\s)(?:actions|code-toolbar|status)(?:\s|$)/.test(element.className || '')) return ''
  if (element.tagName === 'PRE') return element.textContent
  if (element.tagName === 'BR') return '\n'
  if (element.tagName === 'DETAILS' && !element.open) return readableText(element.querySelector('summary'))
  if (element.tagName === 'TR') {
    return Array.from(element.children || []).filter(child => /^(TH|TD)$/.test(child.tagName)).map(readableText).join(' | ')
  }
  const children = Array.from(element.childNodes || [])
  const hasBlocks = children.some(child => textBlocks.has(child.tagName))
  let result = ''
  let previousBlock = false
  for (const child of children) {
    if (hasBlocks && child.nodeType === 3 && !child.textContent.trim()) continue
    const text = readableText(child)
    if (!text) continue
    const block = textBlocks.has(child.tagName)
    if (result && (block || previousBlock) && !result.endsWith('\n') && !text.startsWith('\n')) result += '\n'
    result += text
    previousBlock = block
  }
  return result
}

function finishReader(session) {
  if (!session.active) return
  session.active = false
  renders.get(session.content)?.controller.abort()
  renders.delete(session.content)
  session.uninstallLinks()
  session.dialog.remove()
  if (readerSession === session) readerSession = null
  if (session.trigger?.isConnected) session.trigger.focus({ preventScroll: true })
  window.scrollTo(session.scrollX, session.scrollY)
}

export function closeMaterialReader() {
  const session = readerSession
  if (!session) return
  if (session.dialog.open) session.dialog.close()
  finishReader(session)
}

function selectReaderFile(session, file) {
  if (!file || !skillFiles.some(entry => entry[1] === file)) return
  const button = Array.from(session.content.querySelectorAll('button')).find(element => element.dataset.materialFile === file)
  button?.click()
}

async function showReaderMaterial(session, slug, { push = true, file } = {}) {
  if (!session.active) return false
  if (push && session.history.length) session.history.at(-1).scrollTop = session.content.scrollTop
  if (push) session.history.push({ slug, scrollTop: 0 })
  session.slug = slug
  session.back.disabled = session.history.length < 2
  session.back.hidden = session.history.length < 2
  const previous = session.history.at(-2)
  session.back.setAttribute('aria-label', previous ? `Back to ${materials[previous.slug].title}` : 'Previous reference')
  const request = ++session.request
  const rendering = renderMaterial(session.content, slug, { githubRef: session.options.githubRef, reader: true })
  session.content.scrollTop = session.history.at(-1).scrollTop
  session.content.querySelector('#material-reader-title')?.focus({ preventScroll: true })
  await rendering
  if (!session.active || request !== session.request) return false
  selectReaderFile(session, file)
  session.content.scrollTop = session.history.at(-1).scrollTop
  session.options.onRender?.(session.content, { materialId: slug })
  return true
}

/** Open a prepared reference without changing the current route or lesson DOM. */
export function openMaterialReader(slug, options = {}) {
  if (!Object.hasOwn(materials, slug)) return Promise.resolve(false)
  if (readerSession?.active) {
    const session = readerSession
    if (session.slug === slug) {
      selectReaderFile(session, options.file)
      session.content.querySelector('#material-reader-title')?.focus({ preventScroll: true })
      return Promise.resolve(true)
    }
    return showReaderMaterial(session, slug, { file: options.file })
  }
  const dialog = node('dialog', 'material-reader')
  dialog.setAttribute('aria-labelledby', 'material-reader-title')
  dialog.setAttribute('aria-describedby', 'material-reader-context')
  const bar = node('div', 'material-reader-bar')
  const context = node('p', 'small muted', options.contextLabel ? `Reference for ${options.contextLabel}` : 'Workshop reference')
  context.id = 'material-reader-context'
  const actions = node('div', 'actions')
  const back = node('button', 'button quiet', 'Previous reference')
  back.type = 'button'
  const close = node('button', 'button secondary', 'Close reference')
  close.type = 'button'
  const content = node('div', 'material-reader-content')
  const session = {
    dialog, content, back, options, history: [], request: 0, active: true,
    trigger: options.trigger || document.activeElement,
    scrollX: window.scrollX, scrollY: window.scrollY
  }
  readerSession = session
  back.addEventListener('click', () => {
    if (session.history.length < 2) return
    session.history.pop()
    void showReaderMaterial(session, session.history.at(-1).slug, { push: false })
  })
  close.addEventListener('click', closeMaterialReader)
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeMaterialReader() })
  dialog.addEventListener('close', () => finishReader(session))
  actions.append(back)
  if (typeof options.onAsk === 'function') {
    const ask = node('button', 'button quiet', 'Ask about this reference')
    ask.type = 'button'
    ask.addEventListener('pointerdown', () => { session.selectedText = selectedReaderText(session) })
    ask.addEventListener('click', () => {
      const text = session.selectedText || selectedReaderText(session) || readableText(content.querySelector('[data-material-body]'))
      session.selectedText = ''
      options.onAsk({ materialId: session.slug, label: materials[session.slug].title, text: text.trim(), source: session.slug, trigger: ask })
    })
    actions.append(ask)
  }
  actions.append(close)
  bar.append(context, actions)
  dialog.append(bar, content)
  session.uninstallLinks = installMaterialReaderLinks(dialog)
  document.body.append(dialog)
  dialog.showModal()
  return showReaderMaterial(session, slug, { file: options.file })
}

/** Return the cleanup function after installing delegated, allowlisted links. */
export function installMaterialReaderLinks(root = document, options = {}) {
  const handler = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target.closest?.('a[href]')
    if (!anchor || !root.contains(anchor) || anchor.hasAttribute('download')) return
    const slug = materialIdForHref(anchor.getAttribute('href'))
    if (!slug) return
    event.preventDefault()
    const settings = typeof options === 'function' ? options(anchor, slug) : options
    void openMaterialReader(slug, { ...settings, trigger: anchor, file: anchor.dataset.materialFileTarget })
  }
  root.addEventListener('click', handler)
  return () => root.removeEventListener('click', handler)
}
