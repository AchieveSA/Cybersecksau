// Games platform API (04_platform-spec.md). Storage-agnostic: `store` is { get, set, del, list } over JSON values.
// The server owns the clock, checks every answer and computes every score; the client only ever sees the current item.
import { randomInt, randomUUID, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { PHISH, QUIZ, PASSWORDS, PASSWORDS_TIP, CAESAR_WORDS, CAESAR_TIP, PERMS, APPS, PERMS_TIP } from './content.mjs'

export const DEFAULT_SESSIONS = [
  { id: 'f1', label: 'الطالبات · 10:00–11:30' },
  { id: 'm1', label: 'الطلاب · 12:00–3:00' },
]
const STATES = ['draft', 'open', 'frozen', 'closed']
const GRACE = 1.5 // seconds of network slack on a per-question timer

// Shared scoring rule (03): (base + speed bonus) × streak multiplier, normalised so a flawless instant run is exactly 1,000.
// bonus = max(0, 10 − seconds) × 10, scaled per game so its share matches the concept's split (phish 720 + 280, quiz 700 + 300).
export const GAMES = {
  phish: { n: 12, base: 60, bonusScale: 280 / 1200, limit: 10, maxSeconds: 180 },
  quiz: { n: 10, base: 70, bonusScale: 300 / 1000, limit: 6, maxSeconds: 120 },
  puzzles: { n: 5, maxSeconds: 330, fastUnder: 240, fastBonus: 100 },
}
export const mult = (streak) => (streak >= 5 ? 2 : streak >= 3 ? 1.5 : 1)
export function itemRaw(g, t, streak) {
  const bonus = Math.max(0, 10 - t) * 10 * g.bonusScale
  return (g.base + bonus) * mult(streak)
}
export function maxRaw(g) {
  let s = 0
  for (let i = 1; i <= g.n; i++) s += itemRaw(g, 0, i)
  return s
}
const normalise = (g, raw) => Math.min(1000, Math.round((raw * 1000) / maxRaw(g)))

// ---------------------------------------------------------------- helpers
class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status }
}
const fail = (status, msg) => { throw new HttpError(status, msg) }
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]] } return a }
const pick = (a, n) => shuffle(a).slice(0, n)
const sha = (s) => createHash('sha256').update(String(s)).digest()
const safeEq = (a, b) => timingSafeEqual(sha(a), sha(b))

const DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 }
export function normalisePhone(raw) {
  let p = String(raw || '').replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]).replace(/[^\d+]/g, '')
  if (p.startsWith('+966')) p = '0' + p.slice(4)
  else if (p.startsWith('00966')) p = '0' + p.slice(5)
  else if (p.startsWith('966') && p.length === 12) p = '0' + p.slice(3)
  else if (/^5\d{8}$/.test(p)) p = '0' + p
  return /^05\d{8}$/.test(p) ? p : null
}
const cleanText = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
// «سارة م.»: first name + last initial, never the phone.
export function displayName(full) {
  const parts = cleanText(full, 60).split(' ').filter(Boolean)
  if (parts.length < 2) return parts[0] || '—'
  return `${parts[0]} ${[...parts[parts.length - 1]][0]}.`
}

// ---------------------------------------------------------------- sessions
async function getSession(store, id, seed = true) {
  const s = await store.get(`session/${id}`)
  if (s || !seed) return s
  const d = DEFAULT_SESSIONS.find((x) => x.id === id)
  if (!d) return null
  const fresh = { id: d.id, label: d.label, state: 'draft', winners: null, announced_at: null, created_at: Date.now() }
  await store.set(`session/${id}`, fresh)
  return fresh
}
async function listSessions(store) {
  await Promise.all(DEFAULT_SESSIONS.map((d) => getSession(store, d.id)))
  const keys = await store.list('session/')
  const all = (await Promise.all(keys.map((k) => store.get(k)))).filter(Boolean)
  return all.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
}
const publicSession = (s) => s && { id: s.id, label: s.label, state: s.state }

// ---------------------------------------------------------------- players
async function authPlayer(store, req) {
  const tok = req.headers['x-player'] || cookie(req.headers.cookie, 'xp')
  if (!tok) fail(401, 'سجّل أولًا')
  const [sid, pid, secret] = String(tok).split('.')
  if (!sid || !pid || !secret) fail(401, 'سجّل أولًا')
  const p = await store.get(`player/${sid}/${pid}`)
  if (!p || !safeEq(p.secret, secret)) fail(401, 'سجّل أولًا')
  return p
}
function cookie(header, name) {
  const m = String(header || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}
const tokenOf = (p) => `${p.session_id}.${p.id}.${p.secret}`
const totalOf = (p) => ['phish', 'puzzles', 'quiz'].reduce((t, g) => t + (p.best?.[g]?.score || 0), 0)
const secondsOf = (p) => ['phish', 'puzzles', 'quiz'].reduce((t, g) => t + (p.best?.[g]?.seconds || 0), 0)

// Board per session, cached briefly per function instance: 60+ phones and a TV poll every few seconds.
const boardCache = new Map()
async function boardRows(store, sid, now) {
  const c = boardCache.get(sid)
  if (c && now - c.at < 2000) return c.rows
  const keys = await store.list(`player/${sid}/`)
  const players = []
  for (let i = 0; i < keys.length; i += 25) players.push(...(await Promise.all(keys.slice(i, i + 25).map((k) => store.get(k)))))
  const rows = players.filter(Boolean).map((p) => ({
    id: p.id, name: displayName(p.name), full: p.name, phone: p.phone, college: p.college, created_at: p.created_at,
    phish: p.best?.phish?.score || 0, puzzles: p.best?.puzzles?.score || 0, quiz: p.best?.quiz?.score || 0,
    total: totalOf(p), seconds: Math.round(secondsOf(p) * 10) / 10,
  }))
  // Winner rule: total desc, tie → fewer seconds; then whoever registered first.
  rows.sort((a, b) => b.total - a.total || a.seconds - b.seconds || a.created_at - b.created_at)
  rows.forEach((r, i) => { r.rank = i + 1 })
  boardCache.set(sid, { at: now, rows })
  return rows
}
const dropBoardCache = (sid) => boardCache.delete(sid)

// ---------------------------------------------------------------- run construction
function phishDeck() {
  for (let tries = 0; tries < 100; tries++) {
    const deck = [1, 2, 3].flatMap((l, i) => pick(PHISH.filter((c) => c.lvl === l), [4, 5, 3][i]))
    const safe = deck.filter((c) => c.verdict === 'safe').length
    if (safe >= 4 && safe <= 6) return deck.map((c) => c.id)
  }
  return [1, 2, 3].flatMap((l, i) => pick(PHISH.filter((c) => c.lvl === l), [4, 5, 3][i])).map((c) => c.id)
}
function puzzlesState() {
  let order = shuffle(PASSWORDS.map((p) => p.id))
  while (pairsGood(order) === 15) order = shuffle(order)
  const words = pick(CAESAR_WORDS, 3)
  const rounds = words.map((w, i) => {
    const shift = i === 0 ? 3 + randomInt(8) : 1 + randomInt(25)
    const lo = Math.max(1, Math.min(21, shift - randomInt(5)))
    return { word: w, shift, hint: i === 1 ? [lo, lo + 4] : null, tries: 0 }
  })
  return { order, rounds, apps: shuffle(APPS.map((a) => a.id)), parts: { pw: 0, cz: 0, pm: 0 } }
}
export const caesar = (word, k) => [...word].map((ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + k) % 26) + 65)).join('')
// Kendall-style: pairs in the right relative order (same tier counts either way). 6 items → 15 pairs.
export function pairsGood(order) {
  const tier = Object.fromEntries(PASSWORDS.map((p) => [p.id, p.tier]))
  let good = 0
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (tier[order[i]] <= tier[order[j]]) good++
  return good
}

const PUZZLE_ITEMS = ['pw', 'cz', 'cz', 'cz', 'pm']
function itemView(run) {
  const i = run.idx
  if (run.game === 'phish') {
    const c = PHISH.find((x) => x.id === run.deck[i])
    const { verdict, tell, mark, lvl, ...card } = c
    return { kind: 'card', idx: i, n: run.deck.length, limit: GAMES.phish.limit, card }
  }
  if (run.game === 'quiz') {
    const q = QUIZ.find((x) => x.id === run.deck[i])
    const perm = run.perm[i]
    return { kind: 'mcq', idx: i, n: run.deck.length, limit: GAMES.quiz.limit, q: q.q, o: perm.map((k) => q.o[k]), ltr: !!q.ltr }
  }
  const st = run.puz
  const kind = PUZZLE_ITEMS[i]
  if (kind === 'pw') return { kind, idx: i, n: 5, limit: 90, items: st.order.map((id) => ({ id, text: PASSWORDS.find((p) => p.id === id).text })) }
  if (kind === 'cz') {
    const r = i - 1, rd = st.rounds[r]
    return { kind, idx: i, n: 5, limit: 30, round: r, cipher: caesar(rd.word, rd.shift), shift: r === 0 ? rd.shift : null, hint: rd.hint, tries: rd.tries, maxTries: 3 }
  }
  return { kind, idx: i, n: 5, limit: 90, apps: st.apps.map((id) => { const a = APPS.find((x) => x.id === id); return { id, label: a.label, sub: a.sub } }), perms: PERMS }
}

// ---------------------------------------------------------------- answering
function answerQuestion(run, answer, t) {
  const g = GAMES[run.game]
  const i = run.idx
  let correct, extra
  if (run.game === 'phish') {
    const c = PHISH.find((x) => x.id === run.deck[i])
    correct = answer === c.verdict
    extra = { verdict: c.verdict, tell: c.tell, mark: c.mark }
  } else {
    const q = QUIZ.find((x) => x.id === run.deck[i])
    const perm = run.perm[i]
    correct = Number.isInteger(answer) && perm[answer] === q.a
    extra = { right: perm.indexOf(q.a), tell: q.tell }
  }
  const timeout = answer == null || t > g.limit + GRACE
  if (timeout) correct = false
  let pts = 0
  if (correct) {
    run.streak += 1
    const raw = itemRaw(g, Math.min(t, g.limit), run.streak)
    pts = Math.round((raw * 1000) / maxRaw(g))
    run.raw += raw
  } else run.streak = 0 // a wrong answer costs the streak, not points
  run.bestStreak = Math.max(run.bestStreak || 0, run.streak)
  run.right += correct ? 1 : 0
  run.answers.push({ q: run.deck[i], a: answer, ok: correct, t: Math.round(t * 100) / 100 })
  return { done: true, fb: { correct, timeout, pts, score: normalise(g, run.raw), streak: run.streak, mult: mult(run.streak), ...extra } }
}

function answerPuzzle(run, answer, t) {
  const st = run.puz
  const kind = PUZZLE_ITEMS[run.idx]
  if (kind === 'pw') {
    const ids = PASSWORDS.map((p) => p.id)
    const ok = Array.isArray(answer) && answer.length === ids.length && ids.every((id) => answer.includes(id))
    const order = ok ? answer : st.order
    const good = pairsGood(order)
    const pts = Math.round((300 * good) / 15)
    st.parts.pw = pts
    run.answers.push({ k: 'pw', a: order, good, t })
    const tier = Object.fromEntries(PASSWORDS.map((p) => [p.id, p.tier]))
    const solution = order.slice().sort((a, b) => tier[a] - tier[b])
    return { done: true, fb: { pts, good, of: 15, solution, tiers: tier, tip: PASSWORDS_TIP, score: partsSum(st) } }
  }
  if (kind === 'cz') {
    const rd = st.rounds[run.idx - 1]
    const shift = answer && Number.isInteger(answer.shift) ? answer.shift : null
    const correct = shift != null && ((shift % 26) + 26) % 26 === rd.shift
    rd.tries += 1
    run.answers.push({ k: 'cz', round: run.idx - 1, a: shift, ok: correct, t })
    const give = correct ? [100, 60, 30][rd.tries - 1] : 0
    if (!correct && shift != null && rd.tries < 3) return { done: false, fb: { correct: false, triesLeft: 3 - rd.tries, score: partsSum(st) } }
    st.parts.cz += give
    return { done: true, fb: { correct, pts: give, word: rd.word, shift: rd.shift, tip: run.idx === 3 ? CAESAR_TIP : null, score: partsSum(st) } }
  }
  const map = answer && typeof answer === 'object' ? answer : {}
  let right = 0
  const solution = {}
  for (const a of APPS) { solution[a.id] = a.need; if (map[a.id] === a.need) right++ }
  st.parts.pm = right * 50
  run.answers.push({ k: 'pm', a: map, right, t })
  return { done: true, fb: { pts: right * 50, right, of: APPS.length, solution, tip: PERMS_TIP, score: partsSum(st) } }
}
const partsSum = (st) => st.parts.pw + st.parts.cz + st.parts.pm

async function finishRun(store, run, now) {
  run.finished_at = now
  run.seconds = Math.round((now - run.started_at) / 100) / 10
  const g = GAMES[run.game]
  run.valid = run.seconds <= g.maxSeconds
  if (run.game === 'puzzles') {
    run.fast = run.seconds < g.fastUnder
    run.score = Math.min(1000, partsSum(run.puz) + (run.fast ? g.fastBonus : 0))
  } else run.score = normalise(g, run.raw)
  const session = await getSession(store, run.session_id)
  // After «إعلان الفائزين» (frozen) runs still save but no longer count towards the board.
  run.counted = session?.state === 'open'
  const p = await store.get(`player/${run.session_id}/${run.player_id}`)
  run.isBest = false
  if (p && run.valid && run.counted) {
    const prev = p.best?.[run.game]
    if (!prev || run.score > prev.score || (run.score === prev.score && run.seconds < prev.seconds)) {
      p.best = { ...(p.best || {}), [run.game]: { score: run.score, seconds: run.seconds, run: run.id } }
      await store.set(`player/${p.session_id}/${p.id}`, p)
      run.isBest = true
    }
  }
  dropBoardCache(run.session_id)
}

// ---------------------------------------------------------------- admin guard
async function authAdmin(store, req, env, now) {
  const pin = env.ADMIN_PIN
  if (!pin) fail(503, 'لم يُضبط رمز الإدارة (ADMIN_PIN) في إعدادات الموقع')
  const lock = (await store.get('admin/fails')) || { n: 0, since: now }
  if (now - lock.since > 10 * 60 * 1000) { lock.n = 0; lock.since = now }
  if (lock.n >= 10) fail(429, 'محاولات كثيرة، انتظر 10 دقائق')
  const given = String(req.headers['x-admin-pin'] || '')
  if (!given || !safeEq(given, pin)) {
    lock.n += 1
    await store.set('admin/fails', lock)
    fail(401, 'رمز الإدارة غير صحيح')
  }
}

async function deletePrefix(store, prefix) {
  const keys = await store.list(prefix)
  for (let i = 0; i < keys.length; i += 25) await Promise.all(keys.slice(i, i + 25).map((k) => store.del(k)))
  return keys.length
}
const csvCell = (v) => {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ---------------------------------------------------------------- router
// req: { method, path, query: URLSearchParams, headers: lower-cased object, body, ip }. Returns { status, json, text, headers }.
export async function handle(req, { store, env = {}, now = Date.now() }) {
  try {
    return await route(req, store, env, now)
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.message } }
    console.error(e)
    return { status: 500, json: { error: 'حدث خطأ، حاول مرة أخرى' } }
  }
}

async function route(req, store, env, now) {
  const { method, path } = req
  const q = req.query || new URLSearchParams()
  const body = req.body || {}
  const seg = path.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const R = (m, p) => method === m && seg.join('/') === p

  // -- public
  if (R('GET', 'status')) {
    const sessions = await listSessions(store)
    const want = q.get('s')
    const session = want ? sessions.find((s) => s.id === want) : sessions.find((s) => s.state === 'open') || null
    return { status: 200, json: { session: publicSession(session), open: sessions.filter((s) => s.state === 'open').map(publicSession) } }
  }

  if (R('POST', 'join')) {
    const s = await getSession(store, cleanText(body.s, 12))
    if (!s) fail(404, 'الفترة غير موجودة')
    if (s.state === 'draft') fail(403, 'لم تبدأ هذه الفترة بعد')
    if (s.state === 'closed') fail(403, 'انتهت هذه الفترة')
    const phone = normalisePhone(body.phone)
    if (!phone) fail(400, 'أدخل رقمًا سعوديًا يبدأ بـ 05')
    const idx = await store.get(`phone/${s.id}/${phone}`)
    if (idx) {
      const p = await store.get(`player/${s.id}/${idx.pid}`)
      if (p) return { status: 200, json: { token: tokenOf(p), name: p.name, existed: true }, cookie: tokenOf(p) }
    }
    const name = cleanText(body.name, 40)
    if ([...name].length < 2) fail(400, 'اكتب اسمك')
    if (body.consent !== true) fail(400, 'نحتاج موافقتك على حفظ الرقم للتواصل مع الفائزين')
    const p = { id: randomUUID(), session_id: s.id, name, phone, college: cleanText(body.college, 60) || null,
      created_at: now, best: {}, secret: randomBytes(18).toString('base64url') }
    await store.set(`player/${s.id}/${p.id}`, p)
    await store.set(`phone/${s.id}/${phone}`, { pid: p.id })
    dropBoardCache(s.id)
    return { status: 200, json: { token: tokenOf(p), name: p.name, existed: false }, cookie: tokenOf(p) }
  }

  if (R('GET', 'me')) {
    const p = await authPlayer(store, req)
    const s = await getSession(store, p.session_id)
    const rows = await boardRows(store, p.session_id, now)
    const me = rows.find((r) => r.id === p.id)
    const best = Object.fromEntries(['phish', 'puzzles', 'quiz'].map((g) => [g, p.best?.[g]?.score ?? null]))
    return { status: 200, json: { name: p.name, session: publicSession(s), best, total: totalOf(p), rank: me?.rank || rows.length, count: rows.length } }
  }

  if (R('GET', 'board')) {
    const s = await getSession(store, cleanText(q.get('s'), 12))
    if (!s) fail(404, 'الفترة غير موجودة')
    const rows = await boardRows(store, s.id, now)
    const top = rows.filter((r) => r.total > 0).slice(0, 10).map(({ rank, name, phish, puzzles, quiz, total }) => ({ rank, name, phish, puzzles, quiz, total }))
    return { status: 200, json: { session: publicSession(s), count: rows.length, rows: top, winners: s.winners, announced_at: s.announced_at } }
  }

  if (R('POST', 'survey')) {
    const s = await getSession(store, cleanText(body.s, 12))
    if (!s) fail(404, 'الفترة غير موجودة')
    const q1 = ['games', 'build', 'demo'].includes(body.q1) ? body.q1 : null
    const q2 = Number.isInteger(body.q2) && body.q2 >= 1 && body.q2 <= 5 ? body.q2 : null
    if (!q1 || !q2) fail(400, 'أكمل السؤالين الأول والثاني')
    const q3 = body.q3 === true
    const phone = q3 && body.phone ? normalisePhone(body.phone) : null
    if (q3 && body.phone && !phone) fail(400, 'أدخل رقمًا سعوديًا يبدأ بـ 05')
    await store.set(`survey/${s.id}/${randomUUID()}`, { session_id: s.id, q1, q2, q3, phone, at: now })
    return { status: 200, json: { ok: true } }
  }

  // -- runs
  if (R('POST', 'run/start')) {
    const p = await authPlayer(store, req)
    const game = body.game
    if (!GAMES[game]) fail(400, 'لعبة غير معروفة')
    const s = await getSession(store, p.session_id)
    if (!s || s.state === 'draft' || s.state === 'closed') fail(403, 'الفترة غير مفتوحة الآن')
    const run = { id: randomUUID(), player_id: p.id, session_id: p.session_id, game, started_at: now, served_at: null,
      idx: 0, streak: 0, bestStreak: 0, raw: 0, right: 0, answers: [], fb: {}, done: false }
    if (game === 'phish') run.deck = phishDeck()
    if (game === 'quiz') { run.deck = pick(QUIZ, GAMES.quiz.n).map((x) => x.id); run.perm = run.deck.map(() => shuffle([0, 1, 2, 3])) }
    if (game === 'puzzles') run.puz = puzzlesState()
    run.served_at = now
    await store.set(`run/${run.session_id}/${run.id}`, run)
    return { status: 200, json: { run: run.id, game, frozen: s.state === 'frozen', item: itemView(run) } }
  }

  if (R('POST', 'run/next') || R('POST', 'run/answer')) {
    const p = await authPlayer(store, req)
    const key = `run/${p.session_id}/${cleanText(body.run, 40)}`
    const run = await store.get(key)
    if (!run || run.player_id !== p.id) fail(404, 'الجولة غير موجودة')

    if (seg[1] === 'next') {
      if (run.done) return { status: 200, json: { done: true } }
      // Re-requesting an item never restarts its timer.
      if (run.served_at == null) { run.served_at = now; await store.set(key, run) }
      return { status: 200, json: { item: itemView(run) } }
    }

    const idx = body.idx, att = Number.isInteger(body.att) ? body.att : 0
    const fbKey = `${idx}:${att}`
    if (run.fb[fbKey]) return { status: 200, json: run.fb[fbKey] } // retried after a dropped connection
    if (run.done || idx !== run.idx) fail(409, 'تم تسجيل هذه الإجابة مسبقًا')
    if (run.served_at == null) fail(409, 'اطلب السؤال أولًا')
    const t = (now - run.served_at) / 1000
    const { done, fb } = run.game === 'puzzles' ? answerPuzzle(run, body.answer, t) : answerQuestion(run, body.answer, t)
    const n = run.game === 'puzzles' ? PUZZLE_ITEMS.length : run.deck.length
    if (done) { run.idx += 1; run.served_at = null }
    else run.served_at = now // a wrong Caesar guess restarts that round's clock
    const out = { ...fb, next: done && run.idx < n }
    if (done && run.idx >= n) {
      run.done = true
      await finishRun(store, run, now)
      out.result = { score: run.score, seconds: run.seconds, valid: run.valid, counted: run.counted }
    }
    run.fb[fbKey] = out
    await store.set(key, run)
    return { status: 200, json: out }
  }

  if (method === 'GET' && seg[0] === 'result' && seg[1]) {
    const p = await authPlayer(store, req)
    const run = await store.get(`run/${p.session_id}/${cleanText(seg[1], 40)}`)
    if (!run || run.player_id !== p.id || !run.done) fail(404, 'النتيجة غير موجودة')
    dropBoardCache(p.session_id)
    const rows = await boardRows(store, p.session_id, now)
    const me = rows.find((r) => r.id === p.id)
    const fresh = await store.get(`player/${p.session_id}/${p.id}`)
    const s = await getSession(store, p.session_id)
    return { status: 200, json: {
      game: run.game, score: run.score, seconds: run.seconds, valid: run.valid, counted: run.counted, isBest: run.isBest,
      right: run.right, n: run.game === 'puzzles' ? null : run.deck.length, bestStreak: run.bestStreak,
      parts: run.game === 'puzzles' ? { ...run.puz.parts, fast: run.fast ? GAMES.puzzles.fastBonus : 0 } : null,
      best: fresh?.best?.[run.game]?.score ?? null, total: me?.total || 0, rank: me?.rank || rows.length, count: rows.length,
      name: displayName(p.name), session: publicSession(s),
      played: Object.fromEntries(['phish', 'puzzles', 'quiz'].map((g) => [g, fresh?.best?.[g]?.score ?? null])),
    } }
  }

  // -- admin
  if (seg[0] === 'admin') {
    await authAdmin(store, req, env, now)
    const sub = seg.slice(1).join('/')

    if (method === 'GET' && sub === 'overview') {
      const sessions = await listSessions(store)
      const out = []
      for (const s of sessions) {
        const [players, runs, surveyKeys] = await Promise.all([store.list(`player/${s.id}/`), store.list(`run/${s.id}/`), store.list(`survey/${s.id}/`)])
        const surveys = (await Promise.all(surveyKeys.map((k) => store.get(k)))).filter(Boolean)
        const avg = surveys.length ? surveys.reduce((a, x) => a + x.q2, 0) / surveys.length : null
        out.push({ ...publicSession(s), winners: s.winners, announced_at: s.announced_at, players: players.length, runs: runs.length,
          survey: { n: surveys.length, avg: avg && Math.round(avg * 10) / 10, happy: surveys.filter((x) => x.q2 >= 4).length,
            q1: ['games', 'build', 'demo'].map((k) => surveys.filter((x) => x.q1 === k).length), followUp: surveys.filter((x) => x.q3).length } })
      }
      return { status: 200, json: { sessions: out } }
    }

    if (method === 'POST' && sub === 'session') {
      const id = String(body.id || '').toLowerCase()
      if (!/^[a-z0-9]{1,12}$/.test(id)) fail(400, 'معرّف الفترة: حروف إنجليزية صغيرة وأرقام فقط')
      const s = (await getSession(store, id)) || { id, label: id, state: 'draft', winners: null, announced_at: null, created_at: now }
      if (body.label != null) s.label = cleanText(body.label, 60) || s.label
      if (body.state != null) {
        if (!STATES.includes(body.state)) fail(400, 'حالة غير معروفة')
        s.state = body.state
        if (body.state === 'open') { s.winners = null; s.announced_at = null }
      }
      await store.set(`session/${id}`, s)
      dropBoardCache(id)
      return { status: 200, json: { session: publicSession(s) } }
    }

    if (method === 'POST' && sub === 'purge-phones') {
      // Every session at once: «حذف أرقام الجوال» after the event. Names and scores stay for the report.
      let n = 0
      for (const ss of await listSessions(store)) {
        for (const k of await store.list(`player/${ss.id}/`)) {
          const p = await store.get(k)
          if (p?.phone) { p.phone = null; await store.set(k, p); n++ }
        }
        await deletePrefix(store, `phone/${ss.id}/`)
        for (const k of await store.list(`survey/${ss.id}/`)) {
          const v = await store.get(k)
          if (v?.phone) { v.phone = null; await store.set(k, v) }
        }
        dropBoardCache(ss.id)
      }
      return { status: 200, json: { purged: n } }
    }
    const s = await getSession(store, cleanText(body.s || q.get('s'), 12))
    if (!s) fail(404, 'الفترة غير موجودة')

    if (method === 'POST' && sub === 'winners/preview') {
      // Freezes the board first so the names confirmed are the names revealed.
      if (s.state === 'open') { s.state = 'frozen'; await store.set(`session/${s.id}`, s) }
      dropBoardCache(s.id)
      const rows = (await boardRows(store, s.id, now)).filter((r) => r.total > 0).slice(0, 3)
      return { status: 200, json: { winners: rows.map(({ rank, full, name, phone, total, seconds }) => ({ rank, full, name, phone, total, seconds })) } }
    }
    if (method === 'POST' && sub === 'winners/announce') {
      s.state = 'frozen'
      dropBoardCache(s.id)
      const rows = (await boardRows(store, s.id, now)).filter((r) => r.total > 0).slice(0, 3)
      s.winners = rows.map(({ rank, name, total }) => ({ rank, name, total }))
      s.announced_at = now
      await store.set(`session/${s.id}`, s)
      return { status: 200, json: { winners: s.winners } }
    }
    if (method === 'GET' && sub === 'players') {
      dropBoardCache(s.id)
      const rows = await boardRows(store, s.id, now)
      return { status: 200, json: { players: rows.map(({ id, rank, full, phone, college, phish, puzzles, quiz, total, seconds, created_at }) =>
        ({ id, rank, name: full, phone, college, phish, puzzles, quiz, total, seconds, created_at })) } }
    }
    if (method === 'GET' && sub === 'export') {
      dropBoardCache(s.id)
      const rows = await boardRows(store, s.id, now)
      const head = ['rank', 'name', 'phone', 'college', 'phish', 'puzzles', 'quiz', 'total', 'seconds', 'registered']
      const lines = rows.map((r) => [r.rank, r.full, r.phone, r.college, r.phish, r.puzzles, r.quiz, r.total, r.seconds, new Date(r.created_at).toISOString()].map(csvCell).join(','))
      return { status: 200, text: '﻿' + [head.join(','), ...lines].join('\n'),
        headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="expo-${s.id}.csv"` } }
    }
    if (method === 'POST' && sub === 'player/delete') {
      const p = await store.get(`player/${s.id}/${cleanText(body.pid, 40)}`)
      if (!p) fail(404, 'اللاعب غير موجود')
      await store.del(`player/${s.id}/${p.id}`)
      if (p.phone) await store.del(`phone/${s.id}/${p.phone}`)
      dropBoardCache(s.id)
      return { status: 200, json: { ok: true } }
    }
    if (method === 'POST' && sub === 'reset') {
      if (body.confirm !== s.id) fail(400, 'اكتب معرّف الفترة للتأكيد')
      let n = 0
      for (const pre of ['player', 'phone', 'run', 'survey']) n += await deletePrefix(store, `${pre}/${s.id}/`)
      s.winners = null; s.announced_at = null
      await store.set(`session/${s.id}`, s)
      dropBoardCache(s.id)
      return { status: 200, json: { deleted: n } }
    }
  }

  fail(404, 'غير موجود')
}
