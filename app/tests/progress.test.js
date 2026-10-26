import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const appPath = fileURLToPath(new URL('../public/app.js', import.meta.url))

function loadProgressHelpers(initialWork) {
  const source = readFileSync(appPath, 'utf8')
  const start = source.indexOf('function work(path)')
  const end = source.indexOf('function roleName(path)', start)
  if (start < 0 || end < 0) throw new Error('Progress helpers could not be extracted from app.js')

  const context = vm.createContext({ initialWork: structuredClone(initialWork) })
  const script = new vm.Script(`
    const state = { work: initialWork }
    ${source.slice(start, end)}
    globalThis.progressApi = { state, work, progressLabel }
  `)
  script.runInContext(context)
  return context.progressApi
}

const path = {
  id: 'test-path',
  quiz: [
    { answer: 1 },
    { answer: 2 }
  ]
}

test('a passed check reached by deep link stays incomplete at one of five steps', () => {
  const api = loadProgressHelpers({
    'test-path': { steps: [4], answers: [1, 2], complete: false }
  })

  const progress = api.work(path)

  assert.equal(progress.checkPassed, true)
  assert.equal(progress.complete, false)
  assert.deepEqual([...progress.steps], [4])
  assert.equal(api.progressLabel(progress), '1 of 5 steps complete · Learning check passed')
})

test('all five unique steps plus a passed check completes the path', () => {
  const api = loadProgressHelpers({
    'test-path': { steps: [0, 1, 2, 3, 4], answers: [1, 2], complete: false }
  })

  const progress = api.work(path)

  assert.equal(progress.checkPassed, true)
  assert.equal(progress.complete, true)
  assert.deepEqual([...progress.steps], [0, 1, 2, 3, 4])
  assert.equal(api.progressLabel(progress), 'Path complete')
})

test('incorrect saved answers override legacy completion flags', () => {
  const api = loadProgressHelpers({
    'test-path': {
      steps: [0, 1, 2, 3, 4],
      answers: [0, 2],
      checkPassed: true,
      complete: true
    }
  })

  const progress = api.work(path)

  assert.equal(progress.checkPassed, false)
  assert.equal(progress.complete, false)
  assert.equal(api.progressLabel(progress), '5 of 5 steps complete')
})

test('duplicate and malformed steps cannot inflate progress', () => {
  const api = loadProgressHelpers({
    'test-path': {
      steps: [0, 0, 1, 4, 4, 5, -1, 1.5, '2', null],
      answers: [1, 2],
      complete: true
    }
  })

  const progress = api.work(path)

  assert.deepEqual([...progress.steps], [0, 1, 4])
  assert.equal(progress.checkPassed, true)
  assert.equal(progress.complete, false)
  assert.equal(api.progressLabel(progress), '3 of 5 steps complete · Learning check passed')
})
