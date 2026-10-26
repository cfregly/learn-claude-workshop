import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareSelectedContent,widgetContent} from '../public/ask-claude.js'

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

test('explicit selection preserves leading indentation and trailing newlines',()=>{
  const text='    raise AccessDenied("Northstar")\n'
  assert.equal(prepareSelectedContent(text,'Selected code').text,text)
})

test('source widgets retain separate fact, explanation, and source lines',()=>{
  const text=value=>({nodeType:3,textContent:value})
  const inline=(tagName,value)=>({nodeType:1,tagName,childNodes:[text(value)],className:''})
  const widget={matches:selector=>selector==='.source-fact',children:[inline('STRONG','64 weekly active users'),inline('SPAN','The cause is unknown.'),inline('SPAN','USAGE')]}
  assert.equal(widgetContent(widget),'64 weekly active users\nThe cause is unknown.\nUSAGE')
})
