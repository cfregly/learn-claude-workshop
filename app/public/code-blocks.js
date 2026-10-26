const observers = new WeakMap()
const renderedBlocks = new WeakMap()

const JSON_TOKEN_CLASSES = Object.freeze({
  key: 'code-token-key',
  string: 'code-token-string',
  number: 'code-token-number',
  boolean: 'code-token-boolean',
  null: 'code-token-null',
  punctuation: 'code-token-punctuation'
})

function labelText(pre) {
  const previous = pre.previousElementSibling
  if (previous?.classList.contains('code-label')) return previous.textContent.trim()
  if (pre.classList.contains('source-record')) return 'Source text'
  if (pre.classList.contains('answer-text')) return 'Reference text'
  if (pre.dataset.language) return pre.dataset.language.toUpperCase()
  return 'Code'
}

function languageHint(pre, label) {
  const explicit = String(pre.dataset.language || '').trim().toLowerCase()
  if (['json', 'application/json'].includes(explicit)) return 'json'
  if (['python', 'py'].includes(explicit)) return 'python'
  if (['sse', 'stream', 'text', 'plaintext'].includes(explicit)) return explicit
  if (explicit) return 'plain'
  const value = String(label || '').toLowerCase()
  if (/\b(?:python|py)\b/.test(value)) return 'python'
  if (/\bcode cell\b/.test(value)) return 'python'
  if (/\b(?:sse|stream|events?)\b/.test(value)) return 'sse'
  if (/\bjson\b/.test(value)) return 'json'
  return ''
}

export function formatCode(text, language = '') {
  const source = String(text ?? '')
  const hint = String(language || '').trim().toLowerCase()
  const jsonHint = ['json', 'application/json'].includes(hint)
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

/**
 * Split JSON source into display tokens without producing markup. Joining every
 * token's text always reconstructs the source byte-for-byte.
 */
export function tokenizeCode(text, language = '') {
  const source = String(text ?? '')
  const hint = String(language || '').trim().toLowerCase()
  if (!['json', 'application/json'].includes(hint)) return [{ type: 'plain', text: source }]

  const tokens = []
  let index = 0
  while (index < source.length) {
    const character = source[index]
    if (/\s/.test(character)) {
      let end = index + 1
      while (end < source.length && /\s/.test(source[end])) end += 1
      appendToken(tokens, 'plain', source.slice(index, end))
      index = end
      continue
    }
    if (character === '"') {
      let end = index + 1
      while (end < source.length) {
        if (source[end] === '\\') {
          end = Math.min(source.length, end + 2)
          continue
        }
        end += 1
        if (source[end - 1] === '"') break
      }
      let next = end
      while (next < source.length && /\s/.test(source[next])) next += 1
      appendToken(tokens, source[next] === ':' ? 'key' : 'string', source.slice(index, end))
      index = end
      continue
    }
    if ('{}[]:,'.includes(character)) {
      appendToken(tokens, 'punctuation', character)
      index += 1
      continue
    }
    const remainder = source.slice(index)
    const number = remainder.match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    if (number) {
      appendToken(tokens, 'number', number[0])
      index += number[0].length
      continue
    }
    const keyword = /^(?:true|false|null)\b/.exec(remainder)?.[0]
    if (keyword) {
      appendToken(tokens, keyword === 'null' ? 'null' : 'boolean', keyword)
      index += keyword.length
      continue
    }
    appendToken(tokens, 'plain', character)
    index += 1
  }
  return tokens
}

function renderCode(pre, source, language) {
  if (language !== 'json') {
    const existingCode = Array.from(pre.children).find(child => child.matches?.('code'))
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
  const codeIsCurrent = current?.code === pre.firstElementChild &&
    current.source === source &&
    current.language === language &&
    pre.textContent === source
  if (codeIsCurrent) return false

  const doc = pre.ownerDocument
  const code = doc.createElement('code')
  if (language === 'json') code.className = 'code-highlight language-json'
  for (const token of tokenizeCode(source, language)) {
    const tokenClass = JSON_TOKEN_CLASSES[token.type]
    if (!tokenClass) {
      code.append(doc.createTextNode(token.text))
      continue
    }
    const span = doc.createElement('span')
    span.className = `code-token ${tokenClass}`
    span.textContent = token.text
    code.append(span)
  }
  pre.replaceChildren(code)
  renderedBlocks.set(pre, { code, source, language })
  return true
}

function prepareCode(pre, requestedLabel) {
  let label = requestedLabel
  let language = languageHint(pre, label)
  const formatted = formatCode(pre.textContent || '', language)
  if (!language && /^\s*[\[{]/.test(formatted)) {
    try {
      JSON.parse(formatted)
      language = 'json'
      label = 'JSON'
    } catch {}
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
