// /admin: sessions, live counts, «إعلان الفائزين», CSV export, delete a player, purge phones, reset. PIN-gated server-side.
import { $, h, icon, api, chrome, toast, iso } from '/js/app.js'

chrome()
const STATE = { draft: 'لم تبدأ', open: 'مفتوحة', frozen: 'مجمّدة', closed: 'مغلقة' }
const Q1 = ['الألعاب', 'البناء المباشر', 'المنصة المفتوحة']
let pin = sessionStorage.getItem('pin') || ''
const call = (method, path, body) => api(method, path, body, { pin, retry: false })
const openPlayers = new Set()

async function login(e) {
  e?.preventDefault()
  if (e) pin = $('#login').pin.value.trim()
  try {
    await refresh()
    sessionStorage.setItem('pin', pin)
    $('#login').classList.add('hide')
    $('#app').classList.remove('hide')
  } catch (err) {
    $('#lerr').textContent = err.message
    sessionStorage.removeItem('pin')
  }
}

async function refresh() {
  const { sessions } = await call('GET', '/api/admin/overview')
  const wrap = $('#sessions')
  const blocks = []
  for (const s of sessions) blocks.push(await sessionCard(s))
  wrap.replaceChildren(...blocks)
}

const btn = (label, cls, fn, ic) => h('button', { class: `btn sm ${cls}`, type: 'button', onclick: fn }, ic ? icon(ic) : null, label)
async function setState(s, state) { await call('POST', '/api/admin/session', { id: s.id, state }); toast(`الفترة الآن: ${STATE[state]}`); refresh() }

async function sessionCard(s) {
  const sv = s.survey
  const card = h('section', { class: 'panel sess' },
    h('div', { class: 'sess-h' },
      h('h3', { text: iso(s.label) }), h('span', { class: 'en muted', text: s.id }), h('span', { class: `state ${s.state}`, text: STATE[s.state] })),
    h('div', { class: 'kpis' },
      h('div', {}, h('b', { class: 'num', text: s.players }), h('small', { text: 'لاعب مسجّل' })),
      h('div', {}, h('b', { class: 'num', text: s.runs }), h('small', { text: 'جولة لُعبت' })),
      h('div', {}, h('b', { class: 'num', text: sv.n }), h('small', { text: 'رد على الاستبيان' })),
      h('div', {}, h('b', { class: 'num', text: sv.avg ?? '—' }), h('small', { text: sv.n ? `التقييم · ${Math.round((100 * sv.happy) / sv.n)}% ≥ 4` : 'التقييم من 5' })),
      h('div', {}, h('b', { class: 'num', text: sv.q1.join(' · ') }), h('small', { text: Q1.join(' · ') }))),
    s.winners ? h('p', { style: 'margin-top:12px;font-weight:700;color:var(--gold)', text: 'الفائزون: ' + s.winners.map((w) => `${w.rank}. ${w.name} (${w.total})`).join('  ·  ') }) : null,
    h('div', { class: 'acts' },
      s.state !== 'open' ? btn('تفعيل الفترة', 'mint', () => setState(s, 'open')) : null,
      s.state === 'open' ? btn('تجميد اللوحة', 'ghost', () => setState(s, 'frozen')) : null,
      btn('إعلان الفائزين', '', () => announce(s), 'trophy'),
      s.state !== 'closed' ? btn('إغلاق الفترة', 'ghost', () => setState(s, 'closed')) : null,
      h('a', { class: 'btn sm ghost', href: `/board?s=${s.id}`, target: '_blank' }, icon('tv'), 'شاشة اللوحة'),
      h('a', { class: 'btn sm ghost', href: `/qr?s=${s.id}&label=${encodeURIComponent(s.label)}`, target: '_blank' }, icon('qr'), 'طباعة QR'),
      btn('تصدير CSV', 'ghost', () => exportCsv(s), 'download'),
      btn(openPlayers.has(s.id) ? 'إخفاء اللاعبين' : 'اللاعبون', 'ghost', () => { openPlayers.has(s.id) ? openPlayers.delete(s.id) : openPlayers.add(s.id); refresh() }, 'users'),
      btn('إعادة ضبط', 'danger', () => reset(s), 'trash')))
  if (openPlayers.has(s.id)) card.append(await playersTable(s))
  return card
}

async function playersTable(s) {
  const { players } = await call('GET', `/api/admin/players?s=${s.id}`)
  if (!players.length) return h('p', { class: 'muted', style: 'margin-top:12px', text: 'لا يوجد لاعبون بعد' })
  return h('div', { class: 'tbl' }, h('table', {},
    h('thead', {}, h('tr', {}, ['#', 'الاسم', 'الجوال', 'الكلية', 'الاحتيال', 'الألغاز', 'الاختبار', 'المجموع', 'ث', ''].map((t) => h('th', { text: t })))),
    h('tbody', {}, players.map((p) => h('tr', {},
      h('td', { class: 'num', text: p.rank }), h('td', { text: p.name }), h('td', { class: 'num', text: p.phone || '—' }), h('td', { text: p.college || '' }),
      h('td', { class: 'num', text: p.phish }), h('td', { class: 'num', text: p.puzzles }), h('td', { class: 'num', text: p.quiz }),
      h('td', { class: 'num', text: p.total }), h('td', { class: 'num', text: p.seconds }),
      h('td', {}, h('button', { class: 'btn sm danger', type: 'button', 'aria-label': 'حذف اللاعب', onclick: async () => {
        if (!confirm(`حذف ${p.name} من الفترة؟`)) return
        await call('POST', '/api/admin/player/delete', { s: s.id, pid: p.id }); toast('حُذف اللاعب'); refresh()
      } }, icon('trash'))))))))
}

function dialog(...kids) {
  const d = $('#dlg')
  d.replaceChildren(...kids.flat().filter(Boolean))
  d.showModal()
  return d
}
async function announce(s) {
  let r
  try { r = await call('POST', '/api/admin/winners/preview', { s: s.id }) } catch (e) { toast(e.message, { warn: true }); return }
  refresh()
  const d = dialog(
    h('h3', { style: 'font-size:20px', text: iso(`إعلان الفائزين · ${s.label}`) }),
    h('p', { class: 'muted', style: 'margin:6px 0 8px', text: 'جُمّدت اللوحة. تأكد من الأسماء قبل العرض على الشاشة.' }),
    r.winners.length ? r.winners.map((w) => h('div', { class: 'winner' }, h('span', { class: 'badge', text: w.rank }),
      h('div', {}, h('b', { text: w.full }), h('div', { class: 'muted num', text: iso(`${w.total} نقطة · ${w.seconds} ث · ${w.phone || '—'}`) })))) : h('p', { text: 'لا توجد نتائج بعد' }),
    h('div', { class: 'acts' },
      btn('اعرض على الشاشة', '', async () => { await call('POST', '/api/admin/winners/announce', { s: s.id }); d.close(); toast('بدأ العرض على الشاشة'); refresh() }, 'trophy'),
      btn('إلغاء', 'ghost', () => d.close())))
}
async function exportCsv(s) {
  const res = await fetch(`/api/admin/export?s=${s.id}`, { headers: { 'x-admin-pin': pin } })
  if (!res.ok) { toast('تعذّر التصدير', { warn: true }); return }
  const a = h('a', { href: URL.createObjectURL(await res.blob()), download: `expo-${s.id}.csv` })
  document.body.append(a); a.click(); a.remove()
}
async function reset(s) {
  const v = prompt(`سيُحذف كل اللاعبين والجولات والاستبيان في «${s.label}». اكتب ${s.id} للتأكيد:`)
  if (v == null) return
  try { const r = await call('POST', '/api/admin/reset', { s: s.id, confirm: v.trim() }); toast(`حُذف ${r.deleted} سجلًا`); refresh() } catch (e) { toast(e.message, { warn: true }) }
}

$('#login').addEventListener('submit', login)
$('#newsess').addEventListener('submit', async (e) => {
  e.preventDefault()
  const f = e.target
  try { await call('POST', '/api/admin/session', { id: f.elements.id.value.trim().toLowerCase(), label: f.elements.label.value }); f.reset(); refresh() } catch (err) { toast(err.message, { warn: true }) }
})
$('#purge').addEventListener('click', async () => {
  if (!confirm('حذف كل أرقام الجوال من جميع الفترات والاستبيان؟ لا يمكن التراجع.')) return
  const r = await call('POST', '/api/admin/purge-phones', {})
  toast(`حُذفت ${r.purged} أرقام`); refresh()
})
$('#logout').addEventListener('click', () => { sessionStorage.removeItem('pin'); location.reload() })
if (pin) login()
setInterval(() => { if (!$('#app').classList.contains('hide') && !$('#dlg').open) refresh().catch(() => {}) }, 5000)
