import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareSelectedContent} from '../public/ask-claude.js'

test('explicit selected context preserves copied code and quotes exactly',()=>{
  const text='def lookup(account_id):\n    return {"approval": None, "account": account_id}'
  const excerpt=prepareSelectedContent(text,'Python lookup')
  assert.equal(excerpt.text,text)
  assert.equal(excerpt.label,'Python lookup')
  assert.equal(excerpt.truncated,false)
})
test('empty selection does not attach context',()=>{
  assert.equal(prepareSelectedContent(' \n '),null)
})
test('large excerpts have an explicit bound and retain their original length',()=>{
  const excerpt=prepareSelectedContent('a'.repeat(6100),'x'.repeat(200))
  assert.equal(excerpt.text.length,6000)
  assert.equal(excerpt.label.length,160)
  assert.equal(excerpt.originalLength,6100)
  assert.equal(excerpt.truncated,true)
})
