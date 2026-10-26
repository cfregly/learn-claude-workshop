import './vendor/prism-config.js'
import './vendor/prism-core.min.js'
import './vendor/prism-clike.min.js'
import './vendor/prism-javascript.min.js'
import './vendor/prism-typescript.min.js'
import './vendor/prism-python.min.js'
import './vendor/prism-bash.min.js'
import './vendor/prism-sql.min.js'
import './vendor/prism-json.min.js'

const observers = new WeakMap()
const renderedBlocks = new WeakMap()

const TOKEN_CLASSES = Object.freeze({
  key: 'code-token-key',
  string: 'code-token-string',
  number: 'code-token-number',
  boolean: 'code-token-boolean',
  null: 'code-token-null',
  punctuation: 'code-token-punctuation',
  comment: 'code-token-comment',
  keyword: 'code-token-keyword',
  function: 'code-token-function',
  builtin: 'code-token-builtin',
  operator: 'code-token-operator',
  variable: 'code-token-variable',
  regex: 'code-token-regex'
})

const LANGUAGE_ALIASES = Object.freeze({
  'application/json': 'json',
  py: 'python',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash'
})

const HIGHLIGHT_LANGUAGES = new Set(['json', 'python', 'javascript', 'typescript', 'bash', 'sql'])

function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase()
  return LANGUAGE_ALIASES[language] || language
}

function classLanguage(element) {
  const match = String(element?.className || '').match(/(?:^|\s)language-([\w+-]+)(?=\s|$)/i)
  return match ? normalizeLanguage(match[1]) : ''
}

function detectLanguage(source) {
  const text = String(source || '')
  if (/^\s*(?:event|data|id|retry):/m.test(text)) return 'sse'
  if (/^\s*(?:#!.*\b(?:bash|sh|zsh)\b|(?:export\s+)?[A-Z_][A-Z0-9_]*=|(?:curl|printf|echo|cd|chmod|python\d*|npm|node)\b)/m.test(text)) return 'bash'
  if (/^\s*(?:def|class|from|import)\s+|^\s*(?:async\s+)?def\s+|^\s*@\w+|\b(?:raise|elif|None|True|False)\b/m.test(text)) return 'python'
  if (/\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)\b[\s\S]*\b(?:FROM|VALUES|SET|TABLE)\b/i.test(text)) return 'sql'
  if (/\b(?:const|let|var|function|interface|export|import)\b|=>|\bconsole\.(?:log|error)\s*\(/m.test(text)) return /\b(?:interface|type)\s+\w+|:\s*(?:string|number|boolean)\b/.test(text) ? 'typescript' : 'javascript'
  return ''
}

function detectJson(source) {
  const text = String(source || '').trim()
  if (!/^[\[{]/.test(text)) return ''
  try {
    JSON.parse(text)
    return 'json'
  } catch {
    return ''
  }
}

function labelText(pre) {
  const previous = pre.previousElementSibling
  if (previous?.classList.contains('code-label')) return previous.textContent.trim()
  if (pre.classList.contains('source-record')) return 'Source text'
  if (pre.classList.contains('answer-text')) return 'Reference text'
  if (pre.dataset.language) return pre.dataset.language.toUpperCase()
  return 'Code'
}

function languageHint(pre, label, source = '') {
  const code = Array.from(pre.children).find(child => child.matches?.('code'))
  const explicit = normalizeLanguage(pre.dataset.language || classLanguage(pre) || classLanguage(code))
  if (explicit) return explicit
  const value = String(label || '').toLowerCase()
  if (/\b(?:python|py)\b/.test(value)) return 'python'
  if (/\bcode cell\b/.test(value)) return 'python'
  if (/\b(?:javascript|js)\b/.test(value)) return 'javascript'
  if (/\b(?:typescript|ts)\b/.test(value)) return 'typescript'
  if (/\b(?:bash|shell|sh)\b/.test(value)) return 'bash'
  if (/\bsql\b/.test(value)) return 'sql'
  if (/\b(?:sse|stream|events?)\b/.test(value)) return 'sse'
  if (/\bjson\b/.test(value)) return 'json'
  const json = detectJson(source)
  if (json) return json
  if (pre.classList.contains('source-record') || pre.classList.contains('answer-text')) return ''
  return detectLanguage(source)
}

export function formatCode(text, language = '') {
  const source = String(text ?? '')
  const hint = normalizeLanguage(language)
  const jsonHint = hint === 'json'
  if (hint && !jsonHint) return source
  if (!jsonHint && !/^\s*[\[{]/.test(source)) return source
  try {
    return JSON.stringify(JSON.parse(source), null, 2)
  } catch {
    return source
  }
}

function appendToken(tokens, type, text) {
  if (!text) return
  const previous = tokens.at(-1)
  if (previous?.type === type) previous.text += text
  else tokens.push({ type, text })
}

function semanticToken(type, aliases = []) {
  const roles = [type, ...[].concat(aliases || [])]
  if (roles.includes('property') || roles.includes('attr-name')) return 'key'
  if (roles.includes('comment')) return 'comment'
  if (roles.includes('string') || roles.includes('char') || roles.includes('inserted')) return 'string'
  if (roles.includes('number')) return 'number'
  if (roles.includes('boolean')) return 'boolean'
  if (roles.includes('null')) return 'null'
  if (roles.includes('keyword') || roles.includes('important') || roles.includes('atrule')) return 'keyword'
  if (roles.includes('function') || roles.includes('command')) return 'function'
  if (roles.some(role => ['builtin', 'class-name', 'constant', 'symbol', 'tag', 'selector'].includes(role))) return 'builtin'
  if (roles.includes('operator')) return 'operator'
  if (roles.includes('variable') || roles.includes('parameter')) return 'variable'
  if (roles.includes('regex')) return 'regex'
  if (roles.includes('punctuation')) return 'punctuation'
  return 'plain'
}

function flattenPrismToken(value, tokens, inheritedType = 'plain') {
  if (typeof value === 'string') {
    appendToken(tokens, inheritedType, value)
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) flattenPrismToken(entry, tokens, inheritedType)
    return
  }
  const type = semanticToken(value?.type, value?.alias)
  flattenPrismToken(value?.content ?? '', tokens, type === 'plain' ? inheritedType : type)
}

/** Joining every returned token's text reconstructs the source byte-for-byte. */
export function tokenizeCode(text, language = '') {
  const source = String(text ?? '')
  const hint = normalizeLanguage(language)
  const grammar = globalThis.Prism?.languages?.[hint]
  if (!grammar || !HIGHLIGHT_LANGUAGES.has(hint)) return [{ type: 'plain', text: source }]
  try {
    const tokens = []
    flattenPrismToken(globalThis.Prism.tokenize(source, grammar), tokens)
    return tokens
  } catch {
    return [{ type: 'plain', text: source }]
  }
}

function renderCode(pre, source, language) {
  const existingCode = Array.from(pre.children).find(child => child.matches?.('code'))
  if (!HIGHLIGHT_LANGUAGES.has(language)) {
    if (existingCode) {
      renderedBlocks.set(pre, { code: existingCode, source, language })
      return false
    }

    const code = pre.ownerDocument.createElement('code')
    code.append(...Array.from(pre.childNodes))
    pre.append(code)
    renderedBlocks.set(pre, { code, source, language })
    return true
  }

  const current = renderedBlocks.get(pre)
  const codeIsCurrent = Boolean(current && current.code === existingCode &&
    current.source === source &&
    current.language === language &&
    pre.textContent === source)
  if (codeIsCurrent) return false

  const doc = pre.ownerDocument
  const code = existingCode || doc.createElement('code')
  if (!existingCode && pre.children.length) code.append(...Array.from(pre.childNodes))
  const hasAuthoredMarkup = Array.from(code.children).some(child => !child.classList.contains('code-token'))
  if (hasAuthoredMarkup) {
    if (pre.childNodes.length !== 1 || pre.firstElementChild !== code) pre.replaceChildren(code)
    renderedBlocks.set(pre, { code, source, language })
    return false
  }
  code.classList.add('code-highlight', `language-${language}`)
  const children = []
  for (const token of tokenizeCode(source, language)) {
    const tokenClass = TOKEN_CLASSES[token.type]
    if (!tokenClass) {
      children.push(doc.createTextNode(token.text))
      continue
    }
    const span = doc.createElement('span')
    span.className = `code-token ${tokenClass}`
    span.textContent = token.text
    children.push(span)
  }
  code.replaceChildren(...children)
  if (pre.childNodes.length !== 1 || pre.firstElementChild !== code) pre.replaceChildren(code)
  renderedBlocks.set(pre, { code, source, language })
  return true
}

function prepareCode(pre, requestedLabel) {
  let label = requestedLabel
  let language = languageHint(pre, label, pre.textContent || '')
  const formatted = formatCode(pre.textContent || '', language)
  if (!language && /^\s*[\[{]/.test(formatted)) {
    try {
      JSON.parse(formatted)
      language = 'json'
      label = 'JSON'
    } catch {}
  }
  if (label === 'Code' && language) {
    const displayNames = { javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', bash: 'Shell', sql: 'SQL', json: 'JSON' }
    label = displayNames[language] || label
  }
  renderCode(pre, formatted, language)
  return { label, language }
}

function selectForManualCopy(pre) {
  const doc = pre.ownerDocument
  const selection = doc.defaultView?.getSelection?.()
  if (!selection || !doc.createRange) return false
  const range = doc.createRange()
  range.selectNodeContents(pre)
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}

function copyHandler(pre, status) {
  return async () => {
    const source = pre.textContent || ''
    try {
      const clipboard = globalThis.navigator?.clipboard
      if (!clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await clipboard.writeText(source)
      status.textContent = 'Copied.'
    } catch {
      const selected = selectForManualCopy(pre)
      status.textContent = selected
        ? 'Copy unavailable. Code selected. Press Command+C or Ctrl+C.'
        : 'Copy unavailable. Select the code and copy it manually.'
    }
  }
}

function wrapCodeBlock(pre) {
  const existingWrap = pre.closest('.code-block-wrap')
  if (existingWrap) {
    const label = existingWrap.querySelector('.code-language')?.textContent || ''
    prepareCode(pre, label)
    return null
  }
  if (!pre.parentNode) return null
  const doc = pre.ownerDocument
  const prepared = prepareCode(pre, labelText(pre))

  const wrap = doc.createElement('div')
  wrap.className = 'code-block-wrap'
  const toolbar = doc.createElement('div')
  toolbar.className = 'code-toolbar'
  const originalLabel=pre.previousElementSibling?.classList.contains('code-label')?pre.previousElementSibling:null
  const languageLabel = originalLabel || doc.createElement('span')
  languageLabel.classList.add('code-language')
  if(!originalLabel) languageLabel.textContent = prepared.label
  const button = doc.createElement('button')
  button.type = 'button'
  button.className = 'code-copy-button'
  button.textContent = 'Copy code'
  button.setAttribute('aria-label', 'Copy code')
  const status = doc.createElement('span')
  status.className = 'code-copy-status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  toolbar.append(languageLabel, button, status)

  pre.parentNode.insertBefore(wrap, pre)
  wrap.append(toolbar, pre)
  button.addEventListener('click', copyHandler(pre, status))
  return wrap
}

function codeBlocks(root) {
  if (!root) return []
  const blocks = []
  if (root.nodeType === 1 && root.matches?.('pre')) blocks.push(root)
  if (root.querySelectorAll) blocks.push(...root.querySelectorAll('pre'))
  return blocks
}

function closestCodeBlock(node) {
  const element = node?.nodeType === 1 ? node : node?.parentElement
  if (!element) return null
  if (element.matches?.('pre')) return element
  return element.closest?.('pre') || null
}

export function enhanceCodeBlocks(root = globalThis.document) {
  let enhanced = 0
  for (const pre of codeBlocks(root)) {
    if (wrapCodeBlock(pre)) enhanced += 1
  }
  return enhanced
}

export function observeCodeBlocks(root = globalThis.document) {
  if (!root) return null
  enhanceCodeBlocks(root)
  if (observers.has(root)) return observers.get(root)
  const Observer = root.ownerDocument?.defaultView?.MutationObserver || globalThis.MutationObserver
  if (!Observer) return null
  const observer = new Observer(records => {
    const changed = new Set()
    for (const record of records) {
      const target = closestCodeBlock(record.target)
      if (target) changed.add(target)
      for (const added of record.addedNodes) {
        const containing = closestCodeBlock(added)
        if (containing) changed.add(containing)
        if (added.nodeType === 1 || added.nodeType === 11) {
          for (const pre of codeBlocks(added)) changed.add(pre)
        }
      }
    }
    for (const pre of changed) wrapCodeBlock(pre)
  })
  observer.observe(root, { childList: true, characterData: true, subtree: true })
  observers.set(root, observer)
  return observer
}
