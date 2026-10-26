const REPO = 'https://github.com/cfregly/learn-claude-workshop'
const renders = new WeakMap()

const materials = {
  'live-stream-tool': {
    title: 'Live streaming and a read-only lookup',
    description: 'Run the real Northstar tool round trip, stream the draft, and keep generation separate from source review.',
    local: '/materials/live-stream-tool-demo.md', github: 'docs/live-stream-tool-demo.md', kind: 'markdown'
  },
  'live-stream-tool-code': {
    title: 'Runnable streaming and tool client',
    description: 'A Python SDK exercise with an offline default and an explicit live streaming mode.',
    local: '/materials/live-stream-tool-demo.py', github: 'labs/live-stream-tool-demo.py', kind: 'python'
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
    local: '/materials/renewal-brief/SKILL.md', github: 'labs/skills/renewal-brief/SKILL.md', kind: 'markdown'
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
    local: '/materials/streaming-lab.md', github: 'docs/streaming-lab.md', kind: 'markdown'
  },
  'claude-for-work': {
    title: 'Claude for Work activity',
    description: 'Set up a private Project, use the synthetic records, and complete the task for your role.',
    local: '/materials/claude-for-work.md', github: 'docs/claude-for-work.md', kind: 'markdown'
  },
  'incomplete-response': {
    title: 'When a draft stops early',
    description: 'One failure taught through an annotated API trace and a source-checked business brief.',
    local: '/materials/incomplete-response.md', github: 'docs/incomplete-response.md', kind: 'markdown'
  },
  'source-pack': {
    title: 'Northstar source pack',
    description: 'Synthetic account records, known facts, open questions, and a source-checked reference brief.',
    local: '/materials/northstar-source-pack.md', github: 'docs/northstar-source-pack.md', kind: 'markdown'
  },
  facilitator: {
    title: 'Facilitator guide',
    description: 'Agendas, recovery options, teach-back prompts, and return points for a working session.',
    local: '/materials/facilitator-guide.md', github: 'docs/facilitator-guide.md', kind: 'markdown'
  },
  security: {
    title: 'Security and regulated workflows',
    description: 'A prepared review of data boundaries, permissions, retention, failure handling, and cost.',
    local: '/materials/security-workshop.md', github: 'docs/security-workshop.md', kind: 'markdown'
  },
  'api-client': {
    title: 'Direct Claude API client',
    description: 'A dry-run-first Python client for use in your own approved environment.',
    local: '/materials/claude_api_demo.py', github: 'labs/claude_api_demo.py', kind: 'python'
  },
  fixtures: {
    title: 'Evaluation fixtures',
    description: 'Prepared ordinary, conflicting, unsupported, and untrusted-input cases.',
    local: '/materials/source-fixtures.json', github: 'labs/source-fixtures.json', kind: 'json'
  },
  notebook: {
    title: 'Engineer notebook',
    description: 'Prepared Markdown, code, and saved text output. Nothing runs in this browser.',
    local: '/materials/api-trace.ipynb', github: 'labs/api-trace.ipynb', kind: 'notebook'
  },
  'renewal-code': {
    title: 'Claude Code practice repository',
    description: 'Read the starter files inline, then open the reference notes or solution only when useful.',
    local: '/materials/northstar-renewals.zip', github: 'labs/northstar-renewals/starter', kind: 'renewal', tree: true
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

function node(tag, className = '', text = '') {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

function safeHref(value, { sameOrigin = false } = {}) {
  try {
    const url = new URL(String(value), window.location.href)
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

function link(label, href, className = '', external = false) {
  const anchor = node('a', className, label)
  anchor.href = href
  if (external) {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  return anchor
}

function appendInline(parent, source) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    parent.append(document.createTextNode(source.slice(cursor, match.index)))
    const token = match[0]
    if (token.startsWith('`')) parent.append(node('code', '', token.slice(1, -1)))
    else if (token.startsWith('**')) parent.append(node('strong', '', token.slice(2, -2)))
    else {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      const href = parts && safeHref(parts[2])
      if (href) parent.append(link(parts[1], href, '', new URL(href).origin !== window.location.origin))
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

function blockStart(lines, index) {
  const line = lines[index] || ''
  return /^```/.test(line) || /^#{1,6}\s+/.test(line) || /^\s*(?:[-+*]|\d+\.)\s+/.test(line)
    || (line.includes('|') && tableDivider(lines[index + 1] || ''))
}

export function renderMarkdown(target, markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n')
  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }
    const fence = line.match(/^```\s*([^\s`]*)/)
    if (fence) {
      const body = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) body.push(lines[index++])
      if (index < lines.length) index += 1
      if (fence[1] && fence[1] !== 'text') target.append(node('p', 'code-label', `Code · ${fence[1]}`))
      const code = node('pre', fence[1] === 'text' ? 'source-record' : 'code', body.join('\n'))
      code.dataset.language = fence[1]
      target.append(code)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const element = node(`h${Math.min(6, heading[1].length + 1)}`)
      appendInline(element, heading[2])
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
        const cell = node('th'); appendInline(cell, value); headRow.append(cell)
      }
      head.append(headRow); table.append(head)
      const body = node('tbody')
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const row = node('tr')
        for (const value of tableCells(lines[index])) {
          const cell = node('td'); appendInline(cell, value); row.append(cell)
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
      while (index < lines.length) {
        const current = lines[index].match(/^\s*([-+*]|\d+\.)\s+(.+)$/)
        if (!current || /\d/.test(current[1]) !== ordered) break
        const entry = node('li'); appendInline(entry, current[2]); list.append(entry); index += 1
      }
      target.append(list)
      continue
    }
    const paragraphLines = [line.trim()]
    index += 1
    while (index < lines.length && lines[index].trim() && !blockStart(lines, index)) paragraphLines.push(lines[index++].trim())
    const paragraph = node('p'); appendInline(paragraph, paragraphLines.join(' ')); target.append(paragraph)
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

function renderNotebook(target, text) {
  let notebook
  try { notebook = JSON.parse(text) } catch { throw new Error('The prepared notebook is not valid JSON.') }
  if (!Array.isArray(notebook.cells)) throw new Error('The prepared notebook has no readable cells.')
  notebook.cells.forEach((cell, index) => {
    const section = node('section', 'reference')
    const source = Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || '')
    if (cell.cell_type === 'markdown') {
      section.append(node('p', 'code-label', `Prepared Markdown cell ${index + 1}`))
      renderMarkdown(section, source)
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
  return renders.get(container) === token && window.location.hash === token.hash
}

async function fetchText(path, token) {
  const href = safeHref(path, { sameOrigin: true })
  if (!href) throw new Error('The material path is invalid.')
  const response = await fetch(href, { signal: token.controller.signal, credentials: 'same-origin', cache: 'no-cache' })
  if (!response.ok) throw new Error(`The material is unavailable (${response.status}).`)
  return response.text()
}

function renderContent(target, text, kind) {
  if (kind === 'markdown') renderMarkdown(target, text)
  else if (kind === 'notebook') renderNotebook(target, text)
  else renderCode(target, text, kind)
}

function filePanel(githubRef, token, container) {
  const panel = node('div', 'answer-text')
  panel.dataset.materialContent = 'true'
  let request = 0
  const show = async (file, buttons) => {
    const fileRequest = ++request
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.materialFile === file[1])))
    panel.replaceChildren(node('p', 'empty', `Loading ${file[1]}…`))
    try {
      const text = await fetchText(`/materials/renewals/${file[1]}`, token)
      if (!current(container, token) || fileRequest !== request) return
      const heading = node('div', 'actions')
      heading.append(node('h2', '', file[1]))
      heading.append(link('Open this file on GitHub', githubHref(`labs/northstar-renewals/${file[1]}`, githubRef), 'button quiet', true))
      panel.replaceChildren(heading)
      renderContent(panel, text, file[2])
    } catch (error) {
      if (!current(container, token) || error.name === 'AbortError' || fileRequest !== request) return
      panel.replaceChildren(node('p', 'empty', error.message || 'This file could not be opened.'))
    }
  }
  return { panel, show }
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

function pageShell(material, slug, githubRef, backHref) {
  const page = node('div', 'page')
  page.dataset.materialSlug = slug
  const safeBack = safeHref(backHref, { sameOrigin: true }) || `${window.location.origin}/#resources`
  page.append(link(backHref.startsWith('#path/') ? '← Back to your lesson' : '← Back to workshop materials', safeBack, 'back-link'))
  const header = node('div', 'resource-header')
  header.append(node('h1', '', material.title), node('p', 'lead', material.description))
  const actions = node('div', 'actions')
  actions.append(link('Open on GitHub', githubHref(material.github, githubRef, material.tree), 'button', true))
  const download = link(material.kind === 'renewal' ? 'Download ZIP' : 'Download file', material.local, 'button quiet')
  download.download = ''
  actions.append(download); header.append(actions); page.append(header)
  const body = node('section', 'answer-text')
  body.dataset.materialBody = 'true'
  page.append(body)
  return { page, body }
}

export async function renderMaterial(container, slug, { githubRef = 'main', backHref = '#resources' } = {}) {
  const previous = renders.get(container)
  if (previous) previous.controller.abort()
  const token = { controller: new AbortController(), hash: window.location.hash }
  renders.set(container, token)
  const material = materials[slug]
  document.title=(material?material.title:'Material not found')+' | Learn Claude workshop'
  if (!material) {
    const page = node('div', 'page')
    page.append(node('h1', '', 'Material not found'), link('Back to workshop materials', safeHref(backHref, { sameOrigin: true }) || '#resources', 'button'))
    container.replaceChildren(page)
    return
  }
  const { page, body } = pageShell(material, slug, githubRef, backHref)
  body.append(node('p', 'empty', 'Loading prepared material…'))
  container.replaceChildren(page)
  container.setAttribute('aria-busy', 'true')
  try {
    if (material.kind === 'renewal') {
      body.replaceChildren()
      await renderRenewal(body, githubRef, token, container)
    } else {
      const text = await fetchText(material.local, token)
      if (!current(container, token)) return
      body.replaceChildren()
      renderContent(body, text, material.kind)
    }
    if (current(container, token)) container.setAttribute('aria-busy', 'false')
  } catch (error) {
    if (!current(container, token) || error.name === 'AbortError') return
    body.replaceChildren(node('h2', '', 'This material could not be opened'), node('p', 'empty', error.message || 'Try again from the materials page.'))
    container.setAttribute('aria-busy', 'false')
  }
}
