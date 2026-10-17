// /result/<run>: score, rank, the branded share card (drawn client-side so Arabic shapes correctly), replay / next game.
import { $, h, icon, api, chrome, GAMES, ORDER, beat, toast, needPlayer, glitchText } from '/js/app.js'
const kids = (...a) => a.filter((x) => x != null && x !== false)

chrome()
const runId = location.pathname.split('/').filter(Boolean)[1]
const main = $('main')

async function load() {
  let r
  try { r = await api('GET', `/api/result/${encodeURIComponent(runId)}`) } catch (e) {
    if (!needPlayer(e)) main.replaceChildren(h('p', { class: 'err', text: e.message }), h('a', { class: 'btn', href: '/play' }, 'العودة إلى الألعاب'))
    return
  }
  const G = GAMES[r.game]
  document.title = `نتيجتك في ${G.t} · معرض الابتكار المفتوح`
  const val = glitchText(String(r.score), 'num')
  const onBoard = r.counted && r.valid && r.total > 0
  const stats = r.game === 'puzzles'
    ? [[`${r.parts.pw}`, 'كلمات المرور'], [`${r.parts.cz}`, 'الشيفرة'], [`${r.parts.pm}`, 'الصلاحيات']]
    : [[`${r.right}/${r.n}`, 'إجابات صحيحة'], [`${r.bestStreak}`, 'أطول سلسلة'], [`${r.seconds}`, 'ثانية']]
  const next = ORDER.find((g) => g !== r.game && r.played[g] == null) || ORDER[(ORDER.indexOf(r.game) + 1) % 3]

  main.replaceChildren(...kids(
    h('p', { class: 'tag', text: G.en }),
    h('h2', { style: 'margin-top:6px' }, 'نتيجتك في ', h('span', { class: 'accent', text: G.t })),
    h('section', { class: 'score-hero tile' },
      h('div', { class: 'val' }, val),
      h('div', { class: 'unit', text: `${r.score} نقطة` }),
      onBoard ? h('span', { class: 'rk num', text: `#${r.rank} على اللوحة` }) : null,
      r.isBest && r.score > 0 ? h('div', {}, h('span', { class: 'best-flag', text: 'أفضل نتيجة لك في هذه اللعبة' })) : null),
    h('div', { class: 'stats' }, stats.map(([b, s]) => h('div', { class: 'panel' }, h('b', { class: 'num', text: b }), h('small', { text: s })))),
    r.game === 'puzzles' && r.parts.fast ? h('p', { class: 'center', style: 'margin-top:10px;color:var(--gold);font-weight:700', text: `+${r.parts.fast} مكافأة إنهاء الألغاز في أقل من 4 دقائق` }) : null,
    !r.valid ? h('p', { class: 'note panel', text: 'تجاوزت الجولة الحد الأقصى للوقت، فحُفظت دون أن تُحتسب' }) : null,
    r.valid && !r.counted ? h('p', { class: 'note panel', text: 'تم إعلان الفائزين لهذه الفترة، فلم تُحتسب هذه الجولة على اللوحة' }) : null,
    !r.isBest && r.best != null && r.valid && r.counted ? h('p', { class: 'center muted', style: 'margin-top:10px', text: `أفضل نتيجة لك في هذه اللعبة: ${r.best}` }) : null,
    h('div', { class: 'btns' },
      h('button', { class: 'btn mint', type: 'button', onclick: () => share(r) }, icon('share'), 'شارك بطاقتك'),
      h('div', { class: 'btns two', style: 'margin:0' },
        h('a', { class: 'btn ghost', href: `/play/${r.game}` }, icon('replay'), 'أعد المحاولة'),
        h('a', { class: 'btn', href: `/play/${next}` }, 'اللعبة التالية')),
      h('a', { class: 'btn ghost sm', href: '/play', style: 'width:100%' }, `مجموعك ${r.total} · العودة إلى الألعاب`)),
    h('p', { class: 'motto', text: 'لأن ما يدور في عقلك يستحق الحماية 🧠' })))
  setTimeout(() => beat(val), 250)
}

// ---------------------------------------------------------------- share card · 1080×1080 PNG in the poster style
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
function spaced(ctx, text, x, y, gap) {
  const w = [...text].reduce((a, c) => a + ctx.measureText(c).width + gap, -gap)
  let cx = x - w / 2
  for (const c of text) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + gap }
}
async function card(r) {
  await Promise.all(['900 80px Cairo', '700 40px Plex', '600 28px Plex', '800 100px Inter', '700 22px Inter'].map((f) => document.fonts.load(f, 'معرض 123')))
  const [ksau, mark, bas] = await Promise.all(['/assets/brand/logo_ksau.png', '/assets/brand/cyber_logo.png', '/assets/brand/logo_baseerah.png'].map(img))
  const W = 1080, cv = document.createElement('canvas')
  cv.width = cv.height = W
  const c = cv.getContext('2d')
  const lin = c.createLinearGradient(0, 0, 0, W)
  ;[['0', '#4a3bb5'], ['.34', '#2a1c7a'], ['.64', '#1a1158'], ['1', '#120b3a']].forEach(([o, col]) => lin.addColorStop(+o, col))
  c.fillStyle = lin; c.fillRect(0, 0, W, W)
  const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, W) }
  glow(180, 60, 700, 'rgba(207,198,255,.55)'); glow(1000, 420, 600, 'rgba(94,231,255,.15)'); glow(120, 860, 600, 'rgba(255,79,216,.13)')
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1
  for (let i = -6; i <= 14; i++) { c.beginPath(); c.moveTo(540 + i * 120, W); c.lineTo(540 + i * 12, 700); c.stroke() }
  for (const y of [730, 770, 820, 880, 950]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke() }
  c.fillStyle = 'rgba(255,255,255,.03)'; for (let y = 0; y < W; y += 4) c.fillRect(0, y, W, 1)

  c.drawImage(ksau, W - 56 - 200, 48, 200, 200 * ksau.height / ksau.width)
  c.drawImage(mark, 50, 30, 120, 120 * mark.height / mark.width)
  c.fillStyle = '#8df2cc'; c.font = '800 28px Inter'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('×', 196, 90)
  c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.roundRect(222, 58, 128, 64, 16); c.fill()
  c.drawImage(bas, 234, 64, 104, 104 * bas.height / bas.width)

  c.direction = 'rtl'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.font = '600 28px Plex'; c.fillStyle = '#cfc6ff'; c.fillText('نادي الأمن السيبراني × نادي بصيرة', 540, 205)
  c.font = '900 84px Cairo'
  const title = 'معرض الابتكار المفتوح'
  c.fillStyle = 'rgba(94,231,255,.55)'; c.fillText(title, 536, 300)
  c.fillStyle = 'rgba(255,79,216,.5)'; c.fillText(title, 544, 300)
  c.fillStyle = '#fff'; c.fillText(title, 540, 300)
  c.direction = 'ltr'; c.font = '700 22px Inter'; c.fillStyle = '#8df2cc'; spaced(c, 'AI & STARTUP OPEN EXPO', 540, 348, 7)

  // glass panel
  c.save(); c.beginPath(); c.roundRect(150, 390, 780, 470, 60)
  const gl = c.createLinearGradient(150, 390, 930, 860); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(1, 'rgba(255,255,255,.07)')
  c.shadowColor = 'rgba(10,5,50,.45)'; c.shadowBlur = 50; c.shadowOffsetY = 24; c.fillStyle = gl; c.fill(); c.restore()
  c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 2; c.beginPath(); c.roundRect(150, 390, 780, 470, 60); c.stroke()
  c.direction = 'rtl'; c.textAlign = 'center'
  c.font = '700 40px Plex'; c.fillStyle = '#fff'; c.fillText(GAMES[r.game].t, 540, 460)
  c.direction = 'ltr'; c.font = '800 220px Inter'
  const s = String(r.score)
  c.fillStyle = 'rgba(94,231,255,.6)'; c.fillText(s, 532, 680)
  c.fillStyle = 'rgba(255,79,216,.55)'; c.fillText(s, 548, 680)
  c.fillStyle = '#fff'; c.fillText(s, 540, 680)
  c.fillStyle = 'rgba(94,231,255,.75)'; c.fillRect(150, 600, 780, 3)
  c.direction = 'rtl'; c.font = '700 36px Plex'; c.fillStyle = '#cfc6ff'; c.fillText('نقطة', 540, 735)
  const line = (r.counted && r.valid && r.total > 0) ? `${r.name} · #${r.rank} على اللوحة` : r.name
  c.font = '700 34px Plex'; c.fillStyle = '#ffd56b'; c.fillText(line, 540, 810)

  c.font = '600 26px Plex'; c.fillStyle = '#f4f1ff'; c.fillText('هل تكشف رسالة الاحتيال في 10 ثوانٍ؟ 🔐', 540, 950)
  return new Promise((ok) => cv.toBlob(ok, 'image/png'))
}
async function share(r) {
  toast('نجهّز بطاقتك…')
  let blob
  try { blob = await card(r) } catch { toast('تعذّر إنشاء البطاقة', { warn: true }); return }
  const file = new File([blob], `expo-${r.game}-${r.score}.png`, { type: 'image/png' })
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: 'نتيجتي في الألعاب الأمنية · معرض الابتكار المفتوح 🔐' })
      toast(null)
      return
    }
  } catch (e) { if (e.name === 'AbortError') { toast(null); return } }
  const a = h('a', { href: URL.createObjectURL(blob), download: file.name })
  document.body.append(a); a.click(); a.remove()
  toast('حُفظت البطاقة في جهازك')
}

load()
