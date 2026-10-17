// Netlify Function (v2) serving /api/*. Data lives in Netlify Blobs; set ADMIN_PIN in the site's environment variables.
import { handle } from '../../server/core.mjs'
import { blobStore } from '../../server/stores.mjs'

export const config = { path: '/api/*' }

export default async (request, context) => {
  const url = new URL(request.url)
  let body = null
  if (request.method === 'POST') {
    const text = await request.text()
    if (text.length > 16_000) return Response.json({ error: 'الطلب كبير جدًا' }, { status: 413 })
    try { body = text ? JSON.parse(text) : {} } catch { return Response.json({ error: 'طلب غير صالح' }, { status: 400 }) }
  }
  const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]))
  const res = await handle(
    { method: request.method, path: url.pathname, query: url.searchParams, headers, body, ip: context.ip },
    { store: await blobStore(), env: { ADMIN_PIN: process.env.ADMIN_PIN } },
  )
  return toResponse(res, url.protocol === 'https:')
}

function toResponse(res, secure) {
  const h = new Headers({ 'cache-control': 'no-store', ...(res.headers || {}) })
  if (res.cookie) h.append('set-cookie', `xp=${encodeURIComponent(res.cookie)}; Path=/; Max-Age=1209600; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`)
  if (res.text != null) return new Response(res.text, { status: res.status, headers: h })
  return Response.json(res.json, { status: res.status, headers: h })
}
