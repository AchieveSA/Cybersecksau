// Rules from 04_platform-spec.md, exercised against the API with an in-memory store and a controllable clock.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handle, GAMES, maxRaw, itemRaw, normalisePhone, displayName, caesar, pairsGood } from '../server/core.mjs'
import { memoryStore } from '../server/stores.mjs'
import { PHISH, QUIZ } from '../server/content.mjs'

function api(store, clock) {
  const env = { ADMIN_PIN: '9753' }
  return async (method, path, { body, token, pin } = {}) => {
    const [p, qs] = path.split('?')
    const headers = {}
    if (token) headers['x-player'] = token
    if (pin) headers['x-admin-pin'] = pin
    const r = await handle({ method, path: p, query: new URLSearchParams(qs || ''), headers, body }, { store, env, now: clock.t })
    return { status: r.status, ...(r.json || {}), _text: r.text }
  }
}
async function setup() {
  const store = memoryStore()
  const clock = { t: 1_700_000_000_000 }
  const call = api(store, clock)
  await call('POST', '/api/admin/session', { pin: '9753', body: { id: 'f1', state: 'open' } })
  return { store, clock, call }
}
const join = (call, phone, name = 'سارة محمد') => call('POST', '/api/join', { body: { s: 'f1', name, phone, consent: true } })

// Play a question game; `pick(view, i)` returns the answer, `dt` seconds per item.
async function playQuestions(call, clock, store, token, game, pick, dt = 1) {
  const st = await call('POST', '/api/run/start', { token, body: { game } })
  assert.equal(st.status, 200)
  let item = st.item, last
  for (let i = 0; ; i++) {
    clock.t += dt * 1000
    last = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: item.idx, answer: await pick(item, st.run) } })
    assert.equal(last.status, 200, last.error)
    if (!last.next) break
    clock.t += 2000
    item = (await call('POST', '/api/run/next', { token, body: { run: st.run } })).item
  }
  return { run: st.run, last }
}
const truth = async (store, sid, runId) => store.get(`run/${sid}/${runId}`)
const phishRight = (store) => async (item) => PHISH.find((c) => c.id === item.card.id).verdict
const quizRight = (store) => async (item, runId) => {
  const run = (await store.list('run/f1/')).length && (await store.get(`run/f1/${runId}`))
  const q = QUIZ.find((x) => x.id === run.deck[item.idx])
  return run.perm[item.idx].indexOf(q.a)
}

test('shared scoring rule normalises a flawless instant run to exactly 1,000', () => {
  for (const g of [GAMES.phish, GAMES.quiz]) {
    let raw = 0
    for (let i = 1; i <= g.n; i++) raw += itemRaw(g, 0, i)
    assert.equal(raw, maxRaw(g))
  }
  assert.equal(itemRaw(GAMES.phish, 4, 3) / itemRaw(GAMES.phish, 4, 1), 1.5)
  assert.equal(itemRaw(GAMES.phish, 4, 5) / itemRaw(GAMES.phish, 4, 1), 2)
})

test('phone normalisation and display names', () => {
  assert.equal(normalisePhone('0551234567'), '0551234567')
  assert.equal(normalisePhone('+966 55 123 4567'), '0551234567')
  assert.equal(normalisePhone('٠٥٥١٢٣٤٥٦٧'), '0551234567')
  assert.equal(normalisePhone('551234567'), '0551234567')
  assert.equal(normalisePhone('0451234567'), null)
  assert.equal(displayName('سارة محمد العتيبي'), 'سارة ا.')
  assert.equal(displayName('نورة'), 'نورة')
  assert.equal(caesar('ABZ', 1), 'BCA')
  assert.equal(pairsGood(['w1', 'w4', 'w3', 'w2', 'w5', 'w6']), 15)
})

test('registration is once per phone per session and resumes the same player', async () => {
  const { call } = await setup()
  const a = await join(call, '0551234567')
  const b = await join(call, '+966551234567', 'اسم آخر')
  assert.equal(a.existed, false)
  assert.equal(b.existed, true)
  assert.equal(a.token, b.token)
  assert.equal(b.name, 'سارة محمد')
  assert.equal((await call('POST', '/api/join', { body: { s: 'f1', name: 'x y', phone: '0551111111' } })).status, 400) // no consent
  assert.equal((await call('POST', '/api/join', { body: { s: 'm1', name: 'x y', phone: '0551111111', consent: true } })).status, 403) // draft
})

test('items never carry the answer, and re-requesting an item does not restart its clock', async () => {
  const { call, clock, store } = await setup()
  const { token } = await join(call, '0551234567')
  const st = await call('POST', '/api/run/start', { token, body: { game: 'phish' } })
  const json = JSON.stringify(st)
  assert.ok(!json.includes('verdict') && !json.includes('tell') && !json.includes('"mark"'))
  clock.t += 8000
  await call('POST', '/api/run/next', { token, body: { run: st.run } })
  clock.t += 4000 // 12 s after serving: past the 10 s + grace window
  const verdict = PHISH.find((c) => c.id === st.item.card.id).verdict
  const r = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: 0, answer: verdict } })
  assert.equal(r.correct, false)
  assert.equal(r.timeout, true)
  // A retried answer (dropped connection) returns the same feedback instead of an error.
  const again = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: 0, answer: verdict } })
  assert.deepEqual(again, r)
  const q = await call('POST', '/api/run/start', { token, body: { game: 'quiz' } })
  const qj = JSON.stringify(q.item)
  assert.ok(!qj.includes('"a"') && !qj.includes('tell'))
  void store
})

test('a perfect fast phish run scores 1,000 and the speed bonus and streak matter', async () => {
  const { call, clock, store } = await setup()
  const { token } = await join(call, '0551234567')
  const fast = await playQuestions(call, clock, store, token, 'phish', phishRight(store), 0)
  assert.equal(fast.last.result.score, 1000)
  assert.equal(fast.last.result.valid, true)
  const slow = await playQuestions(call, clock, store, token, 'phish', phishRight(store), 6)
  assert.ok(slow.last.result.score < 1000 && slow.last.result.score > 800, String(slow.last.result.score))
  // Alternating wrong answers kill the streak.
  let k = 0
  const alt = await playQuestions(call, clock, store, token, 'phish', async (item) => {
    const v = PHISH.find((c) => c.id === item.card.id).verdict
    return k++ % 2 ? v : v === 'safe' ? 'phish' : 'safe'
  }, 0)
  assert.ok(alt.last.result.score < 500, String(alt.last.result.score))
  const me = await call('GET', '/api/me', { token })
  assert.equal(me.best.phish, 1000)
})

test('quiz: correct answers via shuffled options; best run counts', async () => {
  const { call, clock, store } = await setup()
  const { token } = await join(call, '0551234567')
  const r = await playQuestions(call, clock, store, token, 'quiz', quizRight(store), 1)
  assert.ok(r.last.result.score > 900, String(r.last.result.score))
  const zero = await playQuestions(call, clock, store, token, 'quiz', async () => null, 1)
  assert.equal(zero.last.result.score, 0)
  const res = await call('GET', `/api/result/${zero.run}`, { token })
  assert.equal(res.best, r.last.result.score)
  assert.equal(res.isBest, false)
})

test('puzzles: sort, three Caesar rounds with retries, permissions, fast bonus', async () => {
  const { call, clock, store } = await setup()
  const { token } = await join(call, '0551234567')
  const st = await call('POST', '/api/run/start', { token, body: { game: 'puzzles' } })
  const run = () => store.get(`run/f1/${st.run}`)
  clock.t += 20000
  let r = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: 0, answer: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'] } })
  assert.equal(r.pts, 300)
  for (let i = 1; i <= 3; i++) {
    const it = (await call('POST', '/api/run/next', { token, body: { run: st.run } })).item
    assert.equal(it.kind, 'cz')
    assert.equal(it.shift != null, i === 1)
    const k = (await run()).puz.rounds[i - 1].shift
    clock.t += 5000
    if (i === 2) {
      const miss = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: i, att: 0, answer: { shift: (k % 25) + 1 } } })
      assert.equal(miss.correct, false)
      assert.equal(miss.triesLeft, 2)
    }
    r = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: i, att: i === 2 ? 1 : 0, answer: { shift: k } } })
    assert.equal(r.pts, i === 2 ? 60 : 100)
  }
  await call('POST', '/api/run/next', { token, body: { run: st.run } })
  clock.t += 30000
  r = await call('POST', '/api/run/answer', { token, body: { run: st.run, idx: 4, answer: { a1: 'loc', a2: 'mic', a3: 'con', a4: 'pho', a5: 'ntf', a6: 'loc' } } })
  assert.equal(r.pts, 250)
  assert.equal(r.result.score, 300 + 260 + 250 + 100)
})

test('runs over the game maximum are kept but invalid; frozen sessions keep runs off the board', async () => {
  const { call, clock, store } = await setup()
  const { token } = await join(call, '0551234567')
  const slow = await playQuestions(call, clock, store, token, 'quiz', quizRight(store), 13) // 10 × (13 + 2) s > 120 s
  assert.equal(slow.last.result.valid, false)
  assert.equal((await call('GET', '/api/me', { token })).best.quiz, null)

  const b = await join(call, '0559999999', 'خالد سعد')
  await playQuestions(call, clock, store, b.token, 'quiz', quizRight(store), 2)
  await playQuestions(call, clock, store, token, 'quiz', quizRight(store), 1)
  const pv = await call('POST', '/api/admin/winners/preview', { pin: '9753', body: { s: 'f1' } })
  assert.equal(pv.winners[0].full, 'سارة محمد')
  assert.equal(pv.winners[0].phone, '0551234567')
  const an = await call('POST', '/api/admin/winners/announce', { pin: '9753', body: { s: 'f1' } })
  assert.deepEqual(an.winners.map((w) => w.name), ['سارة م.', 'خالد س.'])
  const after = await playQuestions(call, clock, store, b.token, 'phish', phishRight(store), 0)
  assert.equal(after.last.result.counted, false)
  const board = await call('GET', '/api/board?s=f1')
  assert.equal(board.session.state, 'frozen')
  assert.equal(board.rows.find((x) => x.name === 'خالد س.').phish, 0)
  assert.ok(!JSON.stringify(board).includes('055'))
})

test('admin: PIN required, lockout, CSV export, purge phones, reset', async () => {
  const { call } = await setup()
  await join(call, '0551234567')
  assert.equal((await call('GET', '/api/admin/overview')).status, 401)
  const csv = await call('GET', '/api/admin/export?s=f1', { pin: '9753' })
  assert.ok(csv._text.includes('0551234567'))
  const ov = await call('GET', '/api/admin/overview', { pin: '9753' })
  assert.equal(ov.sessions.find((s) => s.id === 'f1').players, 1)
  assert.equal((await call('POST', '/api/admin/purge-phones', { pin: '9753', body: {} })).purged, 1)
  const players = await call('GET', '/api/admin/players?s=f1', { pin: '9753' })
  assert.equal(players.players[0].phone, null)
  assert.equal((await call('POST', '/api/admin/reset', { pin: '9753', body: { s: 'f1', confirm: 'nope' } })).status, 400)
  assert.ok((await call('POST', '/api/admin/reset', { pin: '9753', body: { s: 'f1', confirm: 'f1' } })).deleted >= 1)
  for (let i = 0; i < 10; i++) await call('GET', '/api/admin/overview', { pin: '0000' })
  assert.equal((await call('GET', '/api/admin/overview', { pin: '9753' })).status, 429)
})

test('content pools are large enough and well-formed', () => {
  assert.ok(QUIZ.length >= 40)
  assert.equal(new Set(QUIZ.map((q) => q.id)).size, QUIZ.length)
  for (const q of QUIZ) assert.ok(q.o.length === 4 && q.a >= 0 && q.a < 4 && q.tell, q.id)
  for (const l of [1, 2, 3]) assert.ok(PHISH.filter((c) => c.lvl === l).length >= [4, 5, 3][l - 1])
  for (const c of PHISH) {
    assert.ok(['phish', 'safe'].includes(c.verdict) && c.tell && c.mark, c.id)
    assert.ok(String(c[c.mark.field] ?? '').includes(c.mark.text), `${c.id} mark not found in ${c.mark.field}`)
  }
})
