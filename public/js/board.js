// /board?s=<session> on the host TV: top 10, refreshed every 3 s, station QR bottom-left, glitch reveal of the winners.
import { $, h, api, chrome, GAMES, ORDER, qs, beat, sleep, iso } from '/js/app.js'
import { qrSvg } from '/js/qr.js'

chrome({ header: false })
const COLORS = { phish: '#ff7fe3', puzzles: '#ffd56b', quiz: '#5ee7ff' }
$('#legend').replaceChildren(...ORDER.map((g) => h('span', {}, h('i', { style: `background:${COLORS[g]}` }), GAMES[g].t)))
let sid = qs.get('s')
let seenReveal = null
let revealing = false

function rowEl(r) {
  return h('div', { class: `row r${r.rank}` },
    h('span', { class: 'badge', text: r.rank }),
    h('span', { class: 'nm', text: r.name }),
    h('div', { class: 'bars' }, ORDER.map((g) => h('div', { class: 'bar' },
      h('small', {}, GAMES[g].t, h('b', { class: 'num', text: r[g] })),
      h('span', {}, h('i', { style: `width:${r[g] / 10}%;background:${COLORS[g]}` }))))),
    h('span', { class: 'tot num', text: r.total }))
}

async function reveal(winners) {
  revealing = true
  beat($('#tv'), { sliver: true })
  $('#tv').classList.add('hit-board')
  setTimeout(() => $('#tv').classList.remove('hit-board'), 620)
  await sleep(600)
  const title = h('span', { class: 'g', 'data-t': 'الفائزون', text: 'الفائزون' })
  const pods = winners.slice().sort((a, b) => a.rank - b.rank).map((w) => h('div', { class: `pod p${w.rank}` },
    h('span', { class: `badge`, style: w.rank === 1 ? 'background:var(--gold);color:#3a2600' : w.rank === 2 ? 'background:var(--silver);color:#22243a' : 'background:var(--bronze);color:#3a1a08', text: w.rank }),
    h('span', { class: 'nm', text: w.name }), h('span', { class: 'tot num', text: w.total })))
  const ov = h('div', { class: 'reveal', role: 'dialog', 'aria-label': 'الفائزون' },
    h('p', { class: 'tag', text: 'WINNERS' }), h('h1', {}, title), h('div', { class: 'podium' }, pods),
    h('p', { class: 'gift', text: 'تُسلَّم الهدايا عند طاولة الأمن السيبراني' }))
  document.querySelector('.reveal')?.remove()
  document.body.append(ov)
  beat(title)
  if (!winners.length) { pods.length = 0; ov.querySelector('.podium').append(h('p', { class: 'center lead', text: 'لا توجد نتائج في هذه الفترة' })) }
  // 3 → 2 → 1, each held 2 s, with a sliver sweep instead of confetti.
  for (const p of pods.slice().reverse()) {
    p.classList.add('on')
    beat(p.querySelector('.nm'))
    await sleep(2000)
  }
  revealing = false
}

async function tick() {
  try {
    if (!sid) sid = (await api('GET', '/api/status', null, { retry: false })).session?.id || 'f1'
    const b = await api('GET', `/api/board?s=${encodeURIComponent(sid)}`, null, { retry: false })
    $('#slabel').textContent = iso(b.session.label)
    const frozen = b.session.state !== 'open'
    $('#live').classList.toggle('frozen', frozen)
    $('#livetxt').textContent = b.winners ? 'تم إعلان الفائزين لهذه الفترة' : b.session.state === 'frozen' ? 'اللوحة مجمّدة' : frozen ? 'الفترة غير مفتوحة' : `مباشر · ${b.count} لاعبًا`
    $('#rows').replaceChildren(...(b.rows.length ? b.rows.map(rowEl) : [h('div', { class: 'empty panel', text: 'كن أول المتصدّرين! امسح الرمز وابدأ 🎮' })]))
    if (b.winners && b.announced_at !== seenReveal && !revealing) { seenReveal = b.announced_at; reveal(b.winners) }
    if (!b.winners) { seenReveal = null; document.querySelector('.reveal')?.remove() }
    if (!$('#qr').dataset.s || $('#qr').dataset.s !== sid) {
      const url = `${location.origin}/join?s=${sid}`
      $('#qr').innerHTML = qrSvg(url)
      $('#qr').dataset.s = sid
      $('#short').textContent = ['f1', 'm1'].includes(sid) ? `${location.host}/${sid}` : `${location.host}/join?s=${sid}`
    }
  } catch {}
}
tick()
setInterval(tick, 3000)
// Keep the TV awake where supported.
navigator.wakeLock?.request?.('screen').catch(() => {})
