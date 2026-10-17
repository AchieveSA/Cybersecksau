// Store adapters for core.mjs: Netlify Blobs in production, a JSON-file store for local development and tests.
import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function blobStore(name = 'expo') {
  const { getStore } = await import('@netlify/blobs')
  const s = getStore({ name, consistency: 'strong' })
  return {
    get: (k) => s.get(k, { type: 'json' }),
    set: (k, v) => s.setJSON(k, v),
    del: (k) => s.delete(k),
    list: async (prefix) => (await s.list({ prefix })).blobs.map((b) => b.key),
  }
}

export function memoryStore(file) {
  let data = null
  const load = async () => {
    if (data) return data
    try { data = new Map(Object.entries(JSON.parse(await fs.readFile(file, 'utf8')))) } catch { data = new Map() }
    return data
  }
  const save = async () => {
    if (!file) return
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(Object.fromEntries(data)))
  }
  const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)))
  return {
    get: async (k) => clone((await load()).get(k)),
    set: async (k, v) => { (await load()).set(k, clone(v)); await save() },
    del: async (k) => { (await load()).delete(k); await save() },
    list: async (prefix) => [...(await load()).keys()].filter((k) => k.startsWith(prefix)),
  }
}
