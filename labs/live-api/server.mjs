import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLiveDemo } from './live-demo.mjs'

const publicRoot = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)))
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.md':'text/markdown; charset=utf-8','.json':'application/json','.ipynb':'application/x-ipynb+json','.zip':'application/zip','.py':'text/x-python; charset=utf-8' }
const headers = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Cache-Control':'no-cache'
}

export function createServer(options = {}) {
  const liveDemo = createLiveDemo(options.demoOptions)
  return http.createServer(async (request, response) => {
    const send = (status, body, extra={}) => {
      response.writeHead(status, {...headers,...extra})
      response.end(request.method==='HEAD'?undefined:body)
    }
    try {
      let pathname
      try { pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname) }
      catch { return send(400,'Invalid path') }
      if(pathname==='/api/demo') {
        const result = await liveDemo.handle(request)
        return send(result.statusCode,JSON.stringify(result.body),{'Content-Type':'application/json','Cache-Control':'no-store',...(result.headers||{})})
      }
      if(pathname==='/api/health') {
        if(!['GET','HEAD'].includes(request.method)) return send(405,'Method not allowed',{'Allow':'GET, HEAD'})
        const demo = await liveDemo.capabilities()
        return send(200,JSON.stringify({status:'ok',workshop:'northstar',mode:demo.available?'live-and-reference':'reference-exercises',live_demo:{available:demo.available,configured:demo.configured,reason:demo.reason},version:process.env.RELEASE_ID||'development'}),{'Content-Type':'application/json','Cache-Control':'no-store'})
      }
      if(!['GET','HEAD'].includes(request.method)) return send(405,'Method not allowed',{'Allow':'GET, HEAD'})
      if(pathname.startsWith('/api/')) return send(404,JSON.stringify({error:'No live model request was made. Use the downloadable API lab in your own environment.'}),{'Content-Type':'application/json'})
      if(pathname.includes('\0')||pathname.split('/').some(p=>p.startsWith('.'))) return send(404,'Not found')
      const filename=path.resolve(publicRoot,'.'+(pathname==='/'?'/index.html':pathname))
      if(!filename.startsWith(publicRoot+path.sep)) return send(404,'Not found')
      try {
        const info=await stat(filename)
        if(!info.isFile()) return send(404,'Not found')
        const body=await readFile(filename)
        send(200,body,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':body.byteLength,'Last-Modified':info.mtime.toUTCString()})
      } catch { send(404,'Not found') }
    } catch {
      if(response.headersSent||response.writableEnded||response.destroyed||response.socket?.destroyed||!response.writable) return
      return send(500,JSON.stringify({status:'error',code:'request_failed',message:'The request could not be completed. Use the prepared reference and try again.'}),{'Content-Type':'application/json','Cache-Control':'no-store'})
    }
  })
}
if(process.argv[1] && realpathSync(process.argv[1])===fileURLToPath(import.meta.url)) {
  const host=process.env.HOST||'127.0.0.1'
  const port=Number(process.env.PORT||18120)
  if(host!=='127.0.0.1') throw new Error('The workshop must bind to loopback only')
  const server=createServer()
  server.listen(port,host,()=>console.log(`Northstar workshop: http://${host}:${server.address().port}`))
  const stop=()=>server.close(()=>process.exit(0))
  process.on('SIGTERM',stop)
  process.on('SIGINT',stop)
}
