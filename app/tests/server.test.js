import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from '../server.mjs'
import { mkdtemp, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
const server=createServer()
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin=`http://127.0.0.1:${server.address().port}`
after(()=>new Promise(resolve=>server.close(resolve)))
test('serves the workshop, content, and downloadable exercises with usable types',async()=>{
  for(const [file,type] of [['/','text/html'],['/app.js','text/javascript'],['/content.js','text/javascript'],['/materials/api-trace.ipynb','application/x-ipynb+json'],['/materials/northstar-renewals.zip','application/zip']]) {
    const response=await fetch(origin+file)
    assert.equal(response.status,200,file)
    assert.ok(response.headers.get('content-type').startsWith(type),file)
    assert.ok((await response.arrayBuffer()).byteLength>0,file)
    assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"))
  }
})
test('health identifies the workshop and rejects unsupported writes and private paths',async()=>{
  const health=await(await fetch(origin+'/api/health')).json()
  assert.equal(health.workshop,'learn-claude-workshop')
  assert.equal((await fetch(origin+'/.env')).status,404)
  assert.equal((await fetch(origin+'/%2e%2e%2fserver.mjs')).status,404)
  assert.equal((await fetch(origin+'/api/generate',{method:'POST',body:'test'})).status,405)
  assert.equal((await fetch(origin+'/materials/not-a-file')).status,404)
  assert.equal((await fetch(origin+'/app.js',{method:'HEAD'})).status,200)
})
test('starts through the active-release symlink used by systemd',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'northstar-start-'))
  const entry=path.join(directory,'server.mjs')
  await symlink(fileURLToPath(new URL('../server.mjs',import.meta.url)),entry)
  const child=spawn(process.execPath,[entry],{env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']})
  try {
    const url=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Symlink launch did not start a listener')),3000)
      child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Origin exited before listening: ${code}`))})
      child.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0])}})
    })
    assert.equal((await(await fetch(url+'/api/health')).json()).status,'ok')
  } finally {
    if(child.exitCode===null && child.signalCode===null) {
      const exited=new Promise(resolve=>child.once('exit',resolve))
      child.kill('SIGTERM')
      await exited
    }
    await rm(directory,{recursive:true,force:true})
  }
})
