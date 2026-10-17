// Local stand-in for Netlify: serves public/, applies the [[redirects]] from netlify.toml and runs /api/* through
// server/core.mjs with a JSON-file store.  usage: ADMIN_PIN=2468 PORT=8888 node scripts/dev-server.mjs
import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handle } from '../server/core.mjs'
import { memoryStore } from '../server/stores.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'public')
const store = memoryStore(process.env.DATA_FILE || path.join(root, '.data', 'dev.json'))
const env = { ADMIN_PIN: process.env.ADMIN_PIN || '2468' }
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }

const toml = await fs.readFile(path.join(root, 'netlify.toml'), 'utf8')
const redirects = [...toml.matchAll(/\[\[redirects\]\]\s+from = "([^"]+)"\s+to = "([^"]+)"\s+status = (\d+)/g)]
  .map(([, from, to, status]) => ({ from, to, status: +status }))

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (url.pathname.startsWith('/api/')) {
    let body = null
    if (req.method === 'POST') {
      const chunks = []
      for await (const c of req) chunks.push(c)
      try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { body = {} }
    }
    const out = await handle({ method: req.method, path: url.pathname, query: url.searchParams, headers: req.headers, body }, { store, env })
    const h = { 'cache-control': 'no-store', ...(out.headers || {}) }
    if (out.cookie) h['set-cookie'] = `xp=${encodeURIComponent(out.cookie)}; Path=/; Max-Age=1209600; SameSite=Lax; HttpOnly`
    if (out.text != null) { res.writeHead(out.status, h); return res.end(out.text) }
    res.writeHead(out.status, { ...h, 'content-type': 'application/json' })
    return res.end(JSON.stringify(out.json))
  }
  let p = url.pathname
  for (const r of redirects) {
    const hit = r.from.endsWith('/*') ? p.startsWith(r.from.slice(0, -1)) : p === r.from
    if (!hit) continue
    if (r.status >= 300) { res.writeHead(r.status, { location: r.to }); return res.end() }
    p = r.to
    break
  }
  if (p.endsWith('/')) p += 'index.html'
  const file = path.join(pub, path.normalize(p))
  if (!file.startsWith(pub)) { res.writeHead(403); return res.end() }
  try {
    const data = await fs.readFile(file)
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found')
  }
}).listen(+(process.env.PORT || 8888), () => console.log(`http://localhost:${process.env.PORT || 8888}  (admin PIN ${env.ADMIN_PIN})`))
