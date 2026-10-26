const observers = new WeakMap()

function labelText(pre) {
  const previous = pre.previousElementSibling
  if (previous?.classList.contains('code-label')) return previous.textContent.trim()
  if (pre.classList.contains('source-record')) return 'Source text'
  if (pre.classList.contains('answer-text')) return 'Reference text'
  if (pre.dataset.language) return pre.dataset.language.toUpperCase()
  return 'Code'
}

function languageHint(pre, label) {
  const value = `${pre.dataset.language || ''} ${label}`.toLowerCase()
  if (/\b(?:python|py)\b/.test(value)) return 'python'
  if (/\bcode cell\b/.test(value)) return 'python'
  if (/\b(?:sse|stream|events?)\b/.test(value)) return 'sse'
  if (/\bjson\b/.test(value)) return 'json'
  return ''
}

export function formatCode(text, language = '') {
  const source = String(text ?? '')
  const hint = String(language || '').trim().toLowerCase()
  if (['python', 'py', 'sse', 'stream', 'text', 'plaintext'].includes(hint)) return source
  if (!/^\s*[\[{]/.test(source)) return source
  try {
    return JSON.stringify(JSON.parse(source), null, 2)
  } catch {
    return source
  }
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
  if (pre.closest('.code-block-wrap')) {
    const label = pre.closest('.code-block-wrap').querySelector('.code-language')?.textContent || ''
    const formatted = formatCode(pre.textContent || '', languageHint(pre,label))
    if (!pre.querySelector('code')) {
      const code=pre.ownerDocument.createElement('code')
      code.textContent=formatted
      pre.replaceChildren(code)
    } else if(pre.textContent!==formatted) pre.querySelector('code').textContent=formatted
    return null
  }
  if (!pre.parentNode) return null
  const doc = pre.ownerDocument
  let label = labelText(pre)
  const language = languageHint(pre, label)
  const formatted = formatCode(pre.textContent || '', language)
  if (!language && /^\s*[\[{]/.test(formatted)) {
    try { JSON.parse(formatted); label = 'JSON' } catch {}
  }
  if (!pre.querySelector('code')) {
    const code = doc.createElement('code')
    code.textContent = formatted
    pre.replaceChildren(code)
  } else if (formatted !== pre.textContent) pre.querySelector('code').textContent = formatted

  const wrap = doc.createElement('div')
  wrap.className = 'code-block-wrap'
  const toolbar = doc.createElement('div')
  toolbar.className = 'code-toolbar'
  const originalLabel=pre.previousElementSibling?.classList.contains('code-label')?pre.previousElementSibling:null
  const languageLabel = originalLabel || doc.createElement('span')
  languageLabel.classList.add('code-language')
  if(!originalLabel) languageLabel.textContent = label
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
    for (const record of records) {
      if(record.target.nodeType===1&&record.target.matches('pre')) enhanceCodeBlocks(record.target)
      for (const added of record.addedNodes) {
        if (added.nodeType === 1 || added.nodeType === 11) enhanceCodeBlocks(added)
      }
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  observers.set(root, observer)
  return observer
}
