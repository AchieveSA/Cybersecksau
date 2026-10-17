// /play/phish · /play/puzzles · /play/quiz — the client only renders the current item; the server times, checks and scores.
import { $, h, icon, api, chrome, GAMES, beat, toast, sleep, needPlayer, glitchText, iso } from '/js/app.js'

chrome()
const game = location.pathname.split('/').filter(Boolean)[1]
if (!GAMES[game]) location.replace('/play')
const G = GAMES[game]
document.title = `${G.t} · معرض الابتكار المفتوح`
const main = $('main')
let runId = null
let stopTimer = () => {}
let onKey = null // keyboard shortcut for the card on screen
addEventListener('keydown', (e) => onKey && onKey(e))

const RULES = {
  phish: [
    ['swipe', 'اسحب البطاقة يسارًا إذا كانت احتيالًا، ويمينًا إذا كانت آمنة (أو استخدم الزرّين)'],
    ['timer', '12 بطاقة، 10 ثوانٍ لكل بطاقة، ثم يظهر السبب'],
    ['flame', 'السرعة تمنحك نقاطًا إضافية، و3 إجابات صحيحة متتالية = ×1.5، و5 = ×2'],
  ],
  quiz: [
    ['timer', '10 أسئلة، 6 ثوانٍ لكل سؤال، والانتقال تلقائي'],
    ['zap', 'كلما أجبت أسرع حصلت على نقاط أكثر'],
    ['flame', 'الإجابة الخاطئة تكسر السلسلة ولا تخصم نقاطًا'],
  ],
  puzzles: [
    ['key', 'كلمة المرور الأقوى: رتّب 6 كلمات من الأضعف إلى الأقوى'],
    ['lock', 'فك الشيفرة: أدر العجلة حتى تظهر الكلمة، في 3 جولات'],
    ['users', 'من يشوف إيش؟ اختر الصلاحية التي يحتاجها كل تطبيق فعلًا'],
    ['trophy', 'أنهِ الألغاز الثلاثة في أقل من 4 دقائق واحصل على 100 نقطة إضافية'],
  ],
}

// ---------------------------------------------------------------- shell
function intro() {
  const title = glitchText(G.t)
  main.replaceChildren(h('section', { class: 'intro' },
    h('p', { class: 'tag', text: G.en }),
    h('h1', { style: 'margin-top:6px' }, title),
    h('p', { class: 'lead', text: G.s }),
    h('ul', { class: 'rules' }, RULES[game].map(([ic, t]) => h('li', { class: 'panel' }, icon(ic), h('span', { text: t })))),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', id: 'start', onclick: start }, 'ابدأ'),
      h('a', { class: 'btn ghost sm', href: '/play', style: 'width:100%' }, 'رجوع إلى الألعاب'))))
  setTimeout(() => beat(title), 300)
}

async function start() {
  $('#start').disabled = true
  try {
    const r = await api('POST', '/api/run/start', { game })
    runId = r.run
    if (r.frozen) toast('تم إعلان الفائزين لهذه الفترة، ولن تُحتسب هذه الجولة', { warn: true, ms: 3500 })
    hud.score = null
    show(r.item)
  } catch (e) {
    if (!needPlayer(e)) { toast(e.message, { warn: true }); $('#start').disabled = false }
  }
}

const hud = { el: null, prog: null, score: null, streak: null, bar: null }
function frame(progressText) {
  hud.prog = h('span', { class: 'prog num', text: progressText })
  hud.streak = h('span', { class: 'streak' })
  hud.score = hud.score || h('span', { class: 'score num', text: '0' })
  hud.bar = h('div', { class: 'timer', role: 'progressbar', 'aria-label': 'الوقت المتبقي' }, h('i'))
  const stage = h('div', { class: 'stage' })
  main.replaceChildren(h('div', { class: 'hud' }, hud.prog, hud.streak, hud.score), hud.bar, stage)
  return stage
}
function setScore(v, streak, mlt) {
  if (v != null && hud.score.textContent !== String(v)) { hud.score.textContent = v; beat(hud.score, { sliver: false }) }
  if (streak != null) {
    hud.streak.textContent = `سلسلة ${streak} ×${mlt}`
    hud.streak.classList.toggle('on', streak >= 3)
  }
}
// Visual countdown; the authoritative clock is on the server.
function timer(seconds, onEnd) {
  stopTimer()
  const bar = hud.bar, fill = bar.firstChild
  const t0 = performance.now()
  let raf, done = false
  const tick = (now) => {
    const left = Math.max(0, 1 - (now - t0) / (seconds * 1000))
    fill.style.transform = `scaleX(${left})`
    bar.classList.toggle('low', left < 0.3)
    if (left <= 0) { done = true; onEnd(); return }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  stopTimer = () => { if (!done) cancelAnimationFrame(raf); done = true }
  return stopTimer
}

async function send(item, answer, att = 0) {
  stopTimer()
  try {
    return await api('POST', '/api/run/answer', { run: runId, idx: item.idx, att, answer })
  } catch (e) {
    if (!needPlayer(e)) toast(e.message, { warn: true })
    throw e
  }
}
async function advance(fb) {
  if (fb.result) { location.href = `/result/${runId}`; return }
  const r = await api('POST', '/api/run/next', { run: runId })
  if (r.done) { location.href = `/result/${runId}`; return }
  show(r.item)
}

function show(item) {
  onKey = null
  if (item.kind === 'card') return phishCard(item)
  if (item.kind === 'mcq') return quizItem(item)
  if (item.kind === 'pw') return pwPuzzle(item)
  if (item.kind === 'cz') return czPuzzle(item)
  if (item.kind === 'pm') return pmPuzzle(item)
}

function feedbackPanel(ok, head, body, extra) {
  return h('div', { class: `feedback panel ${ok ? 'ok' : 'bad'}`, role: 'status' },
    h('span', { class: 'v' }, iso(head), extra ? h('span', { class: 'pts num', text: extra }) : null),
    body ? h('span', { text: iso(body) }) : null)
}

// ---------------------------------------------------------------- Game 1 · swipe cards
const CH = { email: ['mail', 'البريد'], sms: ['chat', 'الرسائل'], wa: ['chat', 'واتساب'], login: ['lock', 'المتصفح'], popup: ['alert', 'المتصفح'] }
function renderCard(c) {
  const f = (name, tag, cls, text) => h(tag, { class: cls, 'data-f': name, text })
  const card = h('article', { class: `msg ${c.ch}`, 'aria-label': 'رسالة' },
    h('span', { class: 'stamp ph', text: 'احتيال' }), h('span', { class: 'stamp sf', text: 'آمن' }))
  if (c.ch === 'login' || c.ch === 'popup') {
    const insecure = c.url.startsWith('http://')
    card.append(h('div', { class: 'chrome' }, icon(insecure ? 'alert' : 'lock'), f('url', 'span', `url${insecure ? ' insecure' : ''}`, c.url)))
    if (c.ch === 'login') {
      card.append(h('div', { class: 'login' },
        c.logo ? h('img', { src: '/assets/brand/logo_ksau.png', alt: '' }) : null,
        h('div', { class: 'ttl', text: c.title }),
        h('div', { class: 'in', text: 'Email / Username' }), h('div', { class: 'in', text: 'Password' }),
        h('div', { class: 'go', text: 'Sign in' })))
    } else {
      card.append(h('div', { class: 'popup' }, h('div', { class: 'ttl', text: c.title }), f('body', 'p', 'text', c.body),
        h('div', { class: 'login', style: 'padding:6px 0 0' }, h('div', { class: 'in', text: '••••••••' }), h('div', { class: 'go', text: 'متابعة' }))))
    }
  } else {
    const [ic, app] = CH[c.ch]
    card.append(h('div', { class: 'chrome' }, icon(ic), h('span', { text: app })))
    const body = h('div', { class: 'mbody' })
    if (c.ch === 'email') {
      body.append(...[
        h('div', { class: 'from' }, c.logo ? h('img', { src: '/assets/brand/logo_ksau.png', alt: '', style: 'height:30px;width:auto' }) : h('span', { class: 'avatar', text: [...c.from][0] }),
          h('span', {}, f('from', 'b', '', c.from), f('addr', 'span', 'addr', c.addr))),
        f('subj', 'p', 'subj', c.subj), f('body', 'p', 'text', c.body),
        c.link ? f('link', 'span', 'linkbtn', c.link) : null,
        c.file ? h('div', { class: 'file' }, icon('file'), f('file', 'span', '', c.file)) : null].filter(Boolean))
    } else {
      body.append(h('div', { class: 'who' }, h('span', { class: 'avatar', text: c.unknown ? '?' : [...c.from][0] }),
        h('span', {}, f('from', 'b', '', c.from), c.sub ? h('span', { class: 'sub', text: c.sub }) : null, c.unknown ? h('span', { class: 'badge-unk', text: 'رقم غير محفوظ' }) : null)),
        h('div', { class: 'bubble' }, f('body', 'span', '', c.body), c.link ? f('link', 'span', 'lnk', c.link) : null))
    }
    card.append(body)
  }
  return card
}
function markText(root, mark) {
  const el = root.querySelector(`[data-f="${mark.field}"]`)
  if (!el) return
  const t = el.textContent, i = t.indexOf(mark.text)
  if (i < 0) return
  el.replaceChildren(t.slice(0, i), h('mark', { text: mark.text }), t.slice(i + mark.text.length))
}

function phishCard(item) {
  const stage = frame(`${item.idx + 1} / ${item.n}`)
  const c = item.card
  const card = renderCard(c)
  const deck = h('div', { class: 'deck' }, card)
  const btnPh = h('button', { class: 'btn ph', type: 'button' }, icon('left'), 'احتيال')
  const btnSf = h('button', { class: 'btn sf', type: 'button' }, 'آمن', icon('right'))
  const fbBox = h('div')
  stage.append(c.ctx ? h('p', { class: 'ctx' }, icon('info'), h('span', { text: c.ctx })) : '', deck,
    h('div', { class: 'swipe-btns' }, btnPh, btnSf), h('div', { class: 'hint' }, h('span', { text: '← احتيال' }), h('span', { text: 'آمن →' })), fbBox)
  let locked = false
  const stamps = { ph: card.querySelector('.stamp.ph'), sf: card.querySelector('.stamp.sf') }
  const decide = async (ans) => {
    if (locked) return
    locked = true
    btnPh.disabled = btnSf.disabled = true
    card.classList.remove('drag')
    if (ans) {
      card.style.transform = `translateX(${ans === 'phish' ? -60 : 60}px) rotate(${ans === 'phish' ? -4 : 4}deg)`
      stamps[ans === 'phish' ? 'ph' : 'sf'].style.opacity = 1
    }
    const fb = await send(item, ans).catch(() => null)
    if (!fb) return
    card.style.transform = ''
    stamps.ph.style.opacity = fb.verdict === 'phish' ? 1 : 0
    stamps.sf.style.opacity = fb.verdict === 'safe' ? 1 : 0
    card.classList.toggle('safe', fb.verdict === 'safe')
    markText(card, fb.mark)
    const label = fb.verdict === 'phish' ? 'احتيال' : 'آمنة'
    const head = fb.timeout ? 'انتهى الوقت' : fb.correct ? 'صح!' : `خطأ، الرسالة ${label}`
    fbBox.replaceChildren(feedbackPanel(fb.correct, head, `السبب: ${fb.tell}`, fb.correct ? `+${fb.pts}` : null))
    setScore(fb.score, fb.streak, fb.mult)
    if (fb.correct) beat(fb.streak >= 3 ? hud.streak : null)
    else beat(card, { sliver: false })
    let went = false
    const go = () => { if (!went) { went = true; advance(fb) } }
    fbBox.firstChild.addEventListener('click', go)
    await sleep(fb.result ? 1600 : 2200)
    go()
  }
  btnPh.onclick = () => decide('phish')
  btnSf.onclick = () => decide('safe')
  onKey = (e) => {
    if (e.key === 'ArrowLeft') decide('phish')
    if (e.key === 'ArrowRight') decide('safe')
  }
  // Physical swipe: left = احتيال, right = آمن.
  let x0 = null, dx = 0
  card.addEventListener('pointerdown', (e) => { if (locked) return; x0 = e.clientX; dx = 0; card.classList.add('drag'); card.setPointerCapture(e.pointerId) })
  card.addEventListener('pointermove', (e) => {
    if (x0 == null || locked) return
    dx = e.clientX - x0
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`
    stamps.ph.style.opacity = Math.min(1, Math.max(0, -dx / 90))
    stamps.sf.style.opacity = Math.min(1, Math.max(0, dx / 90))
  })
  const end = () => {
    if (x0 == null || locked) return
    x0 = null
    card.classList.remove('drag')
    if (dx < -90) decide('phish')
    else if (dx > 90) decide('safe')
    else { card.style.transform = ''; stamps.ph.style.opacity = stamps.sf.style.opacity = 0 }
  }
  card.addEventListener('pointerup', end)
  card.addEventListener('pointercancel', end)
  timer(item.limit, () => decide(null))
}

// ---------------------------------------------------------------- Game 3 · speed quiz
function quizItem(item) {
  const stage = frame(`${item.idx + 1} / ${item.n}`)
  const keys = ['أ', 'ب', 'ج', 'د']
  const opts = item.o.map((t, i) => h('button', { class: `opt${item.ltr ? ' ltr' : ''}`, type: 'button', onclick: () => choose(i) },
    h('span', { class: 'k', text: keys[i] }), h('span', { class: 't', text: t })))
  const fbBox = h('div')
  stage.append(h('div', { class: 'q panel', text: iso(item.q) }), h('div', { class: 'opts' }, opts), fbBox)
  let locked = false
  async function choose(i) {
    if (locked) return
    locked = true
    opts.forEach((b) => (b.disabled = true))
    if (i != null) opts[i].classList.add('wrong')
    const fb = await send(item, i).catch(() => null)
    if (!fb) return
    if (i != null) opts[i].classList.remove('wrong')
    if (i != null && !fb.correct) opts[i].classList.add('wrong')
    opts[fb.right].classList.add('right')
    fbBox.replaceChildren(feedbackPanel(fb.correct, fb.timeout ? 'انتهى الوقت' : fb.correct ? 'صح!' : 'خطأ', fb.tell, fb.correct ? `+${fb.pts}` : null))
    setScore(fb.score, fb.streak, fb.mult)
    if (fb.correct) beat(fb.streak >= 3 ? hud.streak : null)
    else beat(stage.querySelector('.q'), { sliver: false })
    await sleep(1700)
    advance(fb)
  }
  timer(item.limit, () => choose(null))
}

// ---------------------------------------------------------------- Game 2 · puzzles
const PUZ_LABEL = (idx) => (idx === 0 ? 'اللغز 1 من 3' : idx <= 3 ? 'اللغز 2 من 3' : 'اللغز 3 من 3')
const nextBtn = (fb) => h('button', { class: 'btn', type: 'button', style: 'margin-top:16px', onclick: (e) => { e.target.disabled = true; advance(fb) } }, fb.result ? 'اعرض النتيجة' : 'التالي')

function pwPuzzle(item) {
  const stage = frame(PUZ_LABEL(item.idx))
  let order = item.items.slice()
  let sel = null
  const list = h('div', { class: 'pw-list' })
  const draw = () => list.replaceChildren(...order.map((p, i) => h('button', { type: 'button', class: `pw${sel === i ? ' sel' : ''}`, onclick: () => tap(i) },
    h('span', { class: 'n num', text: i + 1 }), h('span', { class: 't', text: p.text }))))
  const tap = (i) => {
    if (sel == null) sel = i
    else { if (sel !== i) [order[sel], order[i]] = [order[i], order[sel]]; sel = null }
    draw()
  }
  draw()
  const submit = h('button', { class: 'btn', type: 'button', onclick: () => done(order.map((p) => p.id)) }, 'تأكيد الترتيب')
  stage.append(h('h2', { text: 'كلمة المرور الأقوى' }), h('p', { class: 'center muted', text: 'رتّبها من الأضعف (1) إلى الأقوى (6). اضغط على كلمتين لتبديل مكانهما' }),
    h('div', { class: 'scale' }, h('span', { text: '▲ الأضعف' }), h('span', {})), list, h('div', { class: 'scale' }, h('span', { text: '▼ الأقوى' })), h('div', { class: 'btns' }, submit))
  let locked = false
  async function done(ans) {
    if (locked) return
    locked = true
    submit.disabled = true
    const fb = await send(item, ans).catch(() => null)
    if (!fb) return
    const TIER = ['ضعيفة جدًا', 'ضعيفة', 'جيدة', 'الأقوى']
    const byId = Object.fromEntries(item.items.map((p) => [p.id, p.text]))
    list.replaceChildren(...fb.solution.map((id, i) => h('div', { class: `pw t${fb.tiers[id]}` },
      h('span', { class: 'n num', text: i + 1 }), h('span', { class: 't', text: byId[id] }), h('span', { class: 'tierlbl', text: TIER[fb.tiers[id]] }))))
    submit.remove()
    stage.append(feedbackPanel(fb.good >= 12, `${fb.good} من ${fb.of} أزواج في مكانها`, fb.tip, `+${fb.pts}`), nextBtn(fb))
    setScore(fb.score)
    beat(null)
  }
  timer(item.limit, () => done(order.map((p) => p.id)))
}

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const shiftWord = (w, k) => [...w].map((c) => A[(A.indexOf(c) + k + 26 * 3) % 26]).join('')
function czPuzzle(item) {
  const stage = frame(PUZ_LABEL(item.idx))
  let k = 0, att = item.tries
  const S = 300, C = S / 2, R1 = 132, R2 = 98
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${S} ${S}`)
  svg.setAttribute('class', 'wheel')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', 'عجلة الشيفرة')
  svg.innerHTML = `<defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ee7ff"/><stop offset="1" stop-color="#8df2cc"/></linearGradient></defs>
    <circle cx="${C}" cy="${C}" r="${C - 2}" fill="rgba(12,8,50,.6)" stroke="rgba(207,198,255,.5)" stroke-width="1.5"/>
    <circle cx="${C}" cy="${C}" r="${R2 + 16}" fill="rgba(255,255,255,.06)" stroke="url(#wg)" stroke-width="2"/>
    <path d="M${C - 11} 4 L${C + 11} 4 L${C} 18 Z" fill="#ffd56b"/>
    <text x="${C}" y="${C - 4}" text-anchor="middle" font-size="12" fill="#a79cf2" letter-spacing="2">SHIFT</text>
    <text id="kv" x="${C}" y="${C + 26}" text-anchor="middle" font-size="30" fill="#fff">0</text>`
  const outer = document.createElementNS(NS, 'g'), inner = document.createElementNS(NS, 'g')
  inner.style.transition = 'transform .18s'
  inner.style.transformOrigin = `${C}px ${C}px`
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 2 * Math.PI
    const mk = (r, txt, fill, size) => {
      const t = document.createElementNS(NS, 'text')
      t.setAttribute('x', C + r * Math.sin(a)); t.setAttribute('y', C - r * Math.cos(a) + size * 0.36)
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', size); t.setAttribute('fill', fill)
      t.textContent = txt
      return t
    }
    outer.append(mk(R1, A[i], '#f4f1ff', 15))
    inner.append(mk(R2, A[i], '#8df2cc', 14))
  }
  svg.append(outer, inner)
  const kv = svg.querySelector('#kv')
  const plain = h('div', { class: 'cz-word plain', 'aria-live': 'polite' })
  const set = (nk) => {
    k = ((nk % 26) + 26) % 26
    // Outer ring = cipher letters; inner ring turns so each cipher letter sits over the letter it decodes to.
    inner.style.transform = `rotate(${(k * 360) / 26}deg)`
    kv.textContent = k
    plain.replaceChildren(...[...shiftWord(item.cipher, -k)].map((ch) => h('span', { text: ch })))
  }
  // Drag the wheel round.
  let dragA = null, k0 = 0
  const ang = (e) => { const r = svg.getBoundingClientRect(); return Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2)) }
  svg.addEventListener('pointerdown', (e) => { dragA = ang(e); k0 = k; svg.setPointerCapture(e.pointerId) })
  svg.addEventListener('pointermove', (e) => { if (dragA == null) return; set(k0 + Math.round(((ang(e) - dragA) / (2 * Math.PI)) * 26)) })
  svg.addEventListener('pointerup', () => (dragA = null))
  const info = item.shift != null ? `الإزاحة = ${item.shift}. أدر العجلة إليها` : item.hint ? `تلميح: الإزاحة بين ${item.hint[0]} و${item.hint[1]}` : 'الإزاحة مخفية… جرّب حتى تظهر كلمة مفهومة'
  const submit = h('button', { class: 'btn', type: 'button', onclick: () => guess(k) }, 'هذه هي الكلمة')
  const fbBox = h('div')
  stage.append(
    h('h2', { text: 'فك الشيفرة' }),
    h('p', { class: 'center muted', text: `الجولة ${item.round + 1} من 3 · ${info}` }),
    h('div', { class: 'cz-word', 'aria-label': 'النص المشفّر' }, [...item.cipher].map((ch) => h('span', { text: ch }))),
    svg,
    h('div', { class: 'dial' },
      h('button', { type: 'button', 'aria-label': 'إزاحة أقل', onclick: () => set(k - 1) }, icon('left')),
      h('div', { class: 'k' }, h('small', { text: 'ROTATE' })),
      h('button', { type: 'button', 'aria-label': 'إزاحة أكثر', onclick: () => set(k + 1) }, icon('right'))),
    plain, h('div', { class: 'btns' }, submit), fbBox)
  set(0)
  let locked = false
  async function guess(shift) {
    if (locked) return
    locked = true
    submit.disabled = true
    const fb = await send(item, shift == null ? null : { shift }, att).catch(() => null)
    if (!fb) return
    if (fb.correct === false && fb.triesLeft) {
      att += 1
      locked = false
      submit.disabled = false
      beat(plain, { sliver: false })
      toast(`ليست هذه، بقي لك ${fb.triesLeft === 1 ? 'محاولة واحدة' : 'محاولتان'}`, { warn: true })
      timer(item.limit, () => guess(null))
      return
    }
    set(fb.shift)
    stage.querySelectorAll('.dial button').forEach((b) => (b.disabled = true))
    submit.remove()
    fbBox.replaceChildren(feedbackPanel(fb.correct, fb.correct ? `صح! الكلمة ${fb.word}` : `الكلمة كانت ${fb.word} (الإزاحة ${fb.shift})`, fb.tip, fb.correct ? `+${fb.pts}` : null), nextBtn(fb))
    setScore(fb.score)
    if (fb.correct) beat(null)
  }
  timer(item.limit, () => guess(null))
}

function pmPuzzle(item) {
  const stage = frame(PUZ_LABEL(item.idx))
  const pick = {}
  const submit = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => done() }, 'تأكيد')
  const rows = item.apps.map((a) => {
    const chips = item.perms.map((p) => h('button', { type: 'button', class: 'chip', 'aria-label': p.label, 'data-p': p.id, onclick: () => {
      pick[a.id] = p.id
      chips.forEach((c) => c.classList.toggle('on', c.dataset.p === p.id))
      submit.disabled = Object.keys(pick).length < item.apps.length
    } }, icon(p.icon), h('small', { text: p.label })))
    return { a, chips, el: h('div', { class: 'pm-row panel' }, h('div', { class: 'app' }, h('span', { text: a.label }), h('small', { text: a.sub })), h('div', { class: 'chips' }, chips)) }
  })
  stage.append(h('h2', { text: 'من يشوف إيش؟' }), h('p', { class: 'center muted', text: 'اختر الصلاحية الوحيدة التي يحتاجها كل تطبيق فعلًا' }), ...rows.map((r) => r.el), h('div', { class: 'btns' }, submit))
  let locked = false
  async function done() {
    if (locked) return
    locked = true
    submit.disabled = true
    const fb = await send(item, pick).catch(() => null)
    if (!fb) return
    for (const r of rows) for (const c of r.chips) {
      c.disabled = true
      const right = fb.solution[r.a.id] === c.dataset.p
      c.classList.toggle('right', right)
      c.classList.toggle('wrong', !right && pick[r.a.id] === c.dataset.p)
      c.classList.remove('on')
    }
    submit.remove()
    stage.append(feedbackPanel(fb.right >= 5, `${fb.right} من ${fb.of} صحيحة`, fb.tip, `+${fb.pts}`), nextBtn(fb))
    setScore(fb.score)
    beat(null)
  }
  timer(item.limit, () => done())
}

intro()
