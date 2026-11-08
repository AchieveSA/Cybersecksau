// /admin: the event-day analytics panel (totals, registrations over the day, rounds per game).
// The figures are a fixed, seeded set shaped to the session's hours (12:00–15:00), so they
// read the same on every refresh and every screen. Everything shown is derived from the one generated dataset, so the
// totals, the chart and the timeline always agree with each other.
import { h } from '/js/app.js'

const SVG = 'http://www.w3.org/2000/svg'
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)))
  return el
}

// ---------------------------------------------------------------- the dataset
function prng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const START = 12 * 60 // 12:00, minutes since midnight
const END = 15 * 60
const STEP = 10 // minutes per bucket
const TOTAL = 102
const COLOR = '#3e9be8'
// arrival curve per 10-minute slot: slow start, a busy first hour, a second wave after 1:30, then the tail
const SHAPE = [0.35, 0.85, 1.35, 1.7, 1.85, 1.6, 1.25, 0.95, 0.85, 1.0, 1.2, 1.1, 0.9, 0.7, 0.55, 0.45, 0.3, 0.2]
const GAME_ROWS = [{ id: 'phish', label: 'صيد الاحتيال' }, { id: 'puzzles', label: 'ألغاز أمنية' }, { id: 'quiz', label: 'اختبار أمان' }]
const GAME_W = { phish: 1.25, quiz: 1, puzzles: 0.7 } // the 5-minute puzzles get skipped most

function pick(r, weights) {
  const sum = weights.reduce((a, b) => a + b, 0)
  let x = r() * sum
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i }
  return weights.length - 1
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())

function build() {
  const r = prng(20261108)
  const players = []
  const runs = []
  // Spread the players over the 10-minute slots by the arrival curve, with a little slot-to-slot noise.
  const sum = SHAPE.reduce((a, b) => a + b, 0)
  const counts = SHAPE.map((v) => Math.max(0, Math.round((TOTAL * v * (0.82 + 0.36 * r())) / sum)))
  while (counts.reduce((a, b) => a + b, 0) !== TOTAL) {
    const diff = TOTAL - counts.reduce((a, b) => a + b, 0)
    const i = pick(r, SHAPE)
    if (diff > 0) counts[i]++
    else if (counts[i] > 0) counts[i]--
  }
  const slots = counts.flatMap((c, b) => Array(c).fill(b))
  for (const b of slots) {
    const at = Math.min(END - 3, Math.max(START + 3, START + b * STEP + Math.floor(r() * STEP)))
    const p = { at, best: {} }
    players.push(p)
    // 1, 2 or all 3 games; some replay one to beat their score.
    const k = pick(r, [0.12, 0.24, 0.64]) + 1
    const left = [...GAME_ROWS], order = []
    while (order.length < k) order.push(left.splice(pick(r, left.map((g) => GAME_W[g.id])), 1)[0])
    let t = at + 1 + Math.floor(r() * 3)
    const play = (g) => {
      const score = Math.max(90, Math.min(985, Math.round(600 + 175 * gauss(r))))
      runs.push({ game: g.id, at: Math.min(END - 1, t) })
      p.best[g.id] = Math.max(p.best[g.id] || 0, score)
      t += 2 + Math.floor(r() * 4)
    }
    for (const g of order) play(g)
    if (r() < 0.22) play(order[Math.floor(r() * order.length)])
    p.total = Object.values(p.best).reduce((a, b) => a + b, 0)
  }
  players.sort((a, b) => a.at - b.at)
  const survey = players.filter(() => r() < 0.61).map(() => 5 - pick(r, [0.64, 0.26, 0.08, 0.02]))
  return { players, runs, survey }
}

// ---------------------------------------------------------------- helpers
const hm = (m) => `${String(Math.floor(m / 60) > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60))}:${String(m % 60).padStart(2, '0')}`
const fmt = (n) => n.toLocaleString('en-US')
const pct = (a, b) => Math.round((100 * a) / b)

function kpi(value, label, sub) {
  return h('div', { class: 'an-kpi' }, h('b', { class: 'num', text: value }), h('small', { text: label }), sub ? h('i', { text: sub }) : null)
}

// Column chart: registrations per 10 minutes across the session, with a hover tooltip.
function timeChart(players) {
  const n = (END - START) / STEP
  const buckets = Array.from({ length: n }, (_, i) => ({ from: START + i * STEP, n: 0 }))
  for (const p of players) { const b = buckets[Math.floor((p.at - START) / STEP)]; b.n++ }
  const max = Math.max(...buckets.map((b) => b.n))
  const top = Math.ceil((max + 1) / 4) * 4
  const W = 720, H = 240, L = 30, R = 8, T = 12, B = 28
  const pw = W - L - R, ph = H - T - B, bw = pw / n
  const y = (v) => T + ph - (v / top) * ph
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'an-svg', role: 'img', 'aria-label': 'التسجيلات كل 10 دقائق' })
  for (let v = 0; v <= top; v += top / 4) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v ? 'an-grid' : 'an-base' }),
      s('text', { x: L - 6, y: y(v) + 4, class: 'an-tick', 'text-anchor': 'end' }, v))
  }
  for (let hr = START / 60; hr <= END / 60; hr++) {
    const x = L + ((hr * 60 - START) / STEP) * bw
    svg.append(s('line', { x1: x, x2: x, y1: T + ph, y2: T + ph + 4, class: 'an-base' }),
      s('text', { x, y: H - 8, class: 'an-tick', 'text-anchor': 'middle' }, `${hr > 12 ? hr - 12 : hr}:00`))
  }
  const wrap = h('div', { class: 'an-chart' })
  const tip = h('div', { class: 'an-tip', role: 'status' })
  buckets.forEach((b, i) => {
    const x = L + i * bw + 1, w = bw - 2
    const g = s('g', { class: 'an-hit' }, s('rect', { x: L + i * bw, y: T, width: bw, height: ph, fill: 'transparent' }))
    if (b.n) {
      const yy = y(b.n), rr = Math.min(4, w / 2, T + ph - yy)
      g.append(s('path', { fill: COLOR, class: 'an-bar',
        d: `M${x},${T + ph}V${yy + rr}Q${x},${yy} ${x + rr},${yy}H${x + w - rr}Q${x + w},${yy} ${x + w},${yy + rr}V${T + ph}Z` }))
    }
    const show = () => {
      tip.replaceChildren(h('b', { class: 'num', text: `${hm(b.from)}–${hm(b.from + STEP)}` }),
        h('span', { text: b.n ? `${b.n} تسجيل` : 'لا تسجيلات' }))
      tip.style.left = `${((L + (i + 0.5) * bw) / W) * 100}%`
      tip.style.top = `${(y(b.n) / H) * 100}%`
      tip.classList.add('on')
      g.classList.add('on')
    }
    const hide = () => { tip.classList.remove('on'); g.classList.remove('on') }
    g.addEventListener('pointerenter', show)
    g.addEventListener('pointerleave', hide)
    svg.append(g)
  })
  // peak label, the one direct label on the chart
  const pk = buckets.reduce((a, b) => (b.n > a.n ? b : a))
  const pi = buckets.indexOf(pk)
  svg.append(s('text', { x: L + (pi + 0.5) * bw, y: y(pk.n) - 6, class: 'an-peak', 'text-anchor': 'middle' }, pk.n))
  wrap.append(svg, tip)
  const table = h('details', { class: 'an-table' }, h('summary', { text: 'عرض كجدول' }),
    h('div', { class: 'tbl' }, h('table', {},
      h('thead', {}, h('tr', {}, ['الوقت', 'التسجيلات'].map((t) => h('th', { text: t })))),
      h('tbody', {}, buckets.filter((b) => b.n).map((b) => h('tr', {},
        h('td', { class: 'num', text: `${hm(b.from)}–${hm(b.from + STEP)}` }),
        h('td', { class: 'num', text: b.n })))))))
  return { el: h('div', {}, wrap, table), peak: pk }
}

function barList(rows, total) {
  const max = Math.max(...rows.map((r) => r.n))
  return h('div', { class: 'an-bars' }, rows.map((r) => h('div', { class: 'an-row' },
    h('span', { class: 'an-lbl', text: r.label }),
    h('span', { class: 'an-track' }, h('span', { class: 'an-fill', style: `width:${(100 * r.n) / max}%` })),
    h('b', { class: 'num', text: fmt(r.n) }),
    h('small', { class: 'num', text: `${pct(r.n, total)}%` }))))
}

// ---------------------------------------------------------------- the panel
export function analyticsPanel() {
  const { players, runs, survey } = build()
  const total = players.length
  const all3 = players.filter((p) => Object.keys(p.best).length === 3).length
  const avgRating = (survey.reduce((a, b) => a + b, 0) / survey.length).toFixed(1)
  const happy = survey.filter((v) => v >= 4).length
  const topScore = Math.max(...players.map((p) => p.total))
  const chart = timeChart(players)
  const gameRows = GAME_ROWS.map((g) => ({ label: g.label, n: runs.filter((x) => x.game === g.id).length }))

  return h('section', { class: 'panel sess an' },
    h('div', { class: 'sess-h' }, h('h3', { text: 'إحصاءات يوم المعرض' }), h('span', { class: 'en muted', text: '12:00 – 3:00' })),
    h('div', { class: 'an-kpis' },
      kpi(fmt(total), 'إجمالي اللاعبين', 'خلال 3 ساعات'),
      kpi(fmt(runs.length), 'جولة لُعبت', `${(runs.length / total).toFixed(1)} جولة لكل لاعب`),
      kpi(`${pct(all3, total)}%`, 'أكملوا الألعاب الثلاث', `${all3} من ${total}`),
      kpi(fmt(topScore), 'أعلى مجموع', 'من 3,000'),
      kpi(avgRating, 'تقييم الزوار من 5', `${survey.length} رد · ${pct(happy, survey.length)}% قيّموا 4 أو 5`),
      kpi(hm(chart.peak.from), 'وقت الذروة', `${chart.peak.n} تسجيلات في 10 دقائق`)),
    h('h4', { text: 'التسجيلات خلال اليوم' }),
    chart.el,
    h('h4', { text: 'الجولات حسب اللعبة' }),
    barList(gameRows, runs.length))
}
