// Shared front-end helpers: page chrome, API client (with offline retry), icons, toasts, the glitch beat.

export const $ = (s, r = document) => r.querySelector(s)
export const $$ = (s, r = document) => [...r.querySelectorAll(s)]
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const qs = new URLSearchParams(location.search)

// h('div', { class: 'x', text: 'y', onclick }, ...children). User data always goes in as text, never as HTML.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'style') el.style.cssText = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  return el
}

// ---------------------------------------------------------------- icons (lucide, 1.8 stroke)
const ICONS = {
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>',
  puzzle: '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  swipe: '<polyline points="18 8 22 12 18 16"/><polyline points="6 8 2 12 6 16"/><line x1="2" x2="22" y1="12" y2="12"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  tv: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
}
export function icon(name, cls = '') {
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  t.setAttribute('viewBox', '0 0 24 24')
  t.setAttribute('class', `icon ${cls}`.trim())
  t.setAttribute('aria-hidden', 'true')
  t.innerHTML = ICONS[name] || ''
  return t
}

// ---------------------------------------------------------------- the three games
export const GAMES = {
  phish: { t: 'صيد الاحتيال', en: 'PHISH OR NOT PHISH', s: 'احتيال أم آمن؟ اسحب وقرّر خلال 10 ثوانٍ', icon: 'fish', color: '#ff7fe3' },
  puzzles: { t: 'ألغاز أمنية', en: 'SECURITY PUZZLES', s: 'ثلاثة ألغاز قصيرة: كلمات المرور، الشيفرة، الصلاحيات', icon: 'puzzle', color: '#ffd56b' },
  quiz: { t: 'اختبار أمان', en: '60-SECOND QUIZ', s: '10 أسئلة، 6 ثوانٍ لكل سؤال', icon: 'timer', color: '#5ee7ff' },
}
export const ORDER = ['phish', 'puzzles', 'quiz']

// ---------------------------------------------------------------- player token
export const auth = {
  get: () => { try { return localStorage.getItem('xp') } catch { return null } },
  set: (t) => { try { localStorage.setItem('xp', t) } catch {} },
  clear: () => { try { localStorage.removeItem('xp') } catch {} },
  session: () => (auth.get() || '').split('.')[0] || null,
}

// ---------------------------------------------------------------- API
let offlineToast = false
export async function api(method, path, body, { retry = true, pin } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res
    try {
      const headers = { 'content-type': 'application/json' }
      const tok = auth.get()
      if (tok) headers['x-player'] = tok
      if (pin) headers['x-admin-pin'] = pin
      res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' })
    } catch (e) {
      if (!retry || attempt > 40) throw Object.assign(new Error('انقطع الاتصال، حاول مرة أخرى'), { status: 0 })
      if (!offlineToast) { toast('انقطع الاتصال، سنحفظ إجابتك عند عودته', { warn: true, sticky: true }); offlineToast = true }
      await Promise.race([sleep(Math.min(6000, 800 * 1.6 ** attempt)), new Promise((r) => addEventListener('online', r, { once: true }))])
      continue
    }
    if (offlineToast) { toast(null); offlineToast = false }
    const isJson = (res.headers.get('content-type') || '').includes('json')
    const data = isJson ? await res.json() : await res.text()
    if (!res.ok) throw Object.assign(new Error((data && data.error) || 'حدث خطأ'), { status: res.status, data })
    return data
  }
}
// Player pages: no valid token → registration.
export function needPlayer(e) {
  if (e && e.status === 401) {
    auth.clear()
    location.replace('/join' + (qs.get('s') ? `?s=${encodeURIComponent(qs.get('s'))}` : ''))
    return true
  }
  return false
}

// ---------------------------------------------------------------- toast + beat
let toastEl, toastTimer
export function toast(msg, { warn = false, sticky = false, ms = 2600 } = {}) {
  if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(toastEl) }
  clearTimeout(toastTimer)
  if (!msg) { toastEl.classList.remove('on'); return }
  toastEl.textContent = msg
  toastEl.classList.toggle('warn', warn)
  toastEl.classList.add('on')
  if (!sticky) toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms)
}
// The one effect: ≤300 ms, only on a beat (a word landing, a transition, a win). CSS turns it off for reduced motion.
export function beat(el, { sliver = true } = {}) {
  if (el) {
    el.classList.remove('hit', 'hit-shake'); void el.offsetWidth
    el.classList.add(el.classList.contains('g') ? 'hit' : 'hit-shake')
    setTimeout(() => el.classList.remove('hit', 'hit-shake'), 320)
  }
  if (sliver) {
    const s = h('div', { class: `sliver ${Math.random() < 0.5 ? 'c' : 'm'}`, style: `top:${15 + Math.random() * 60}%` })
    document.body.append(s)
    requestAnimationFrame(() => s.classList.add('run'))
    setTimeout(() => s.remove(), 360)
  }
}
// Isolate Latin/number runs (domains, times, scores) so RTL lines keep their order: «الطالبات · 10:00–11:30».
export const iso = (s) => String(s ?? '').replace(/[A-Za-z0-9+#@$!][A-Za-z0-9.\-_@/:$!%&+–×#]*[A-Za-z0-9!$%]|[A-Za-z0-9]/g, (m) => `\u2066${m}\u2069`)
export const glitchText = (text, cls = '') => h('span', { class: `g ${cls}`.trim(), 'data-t': text, text })

// ---------------------------------------------------------------- page chrome
const GRID = `<svg viewBox="0 0 1080 460" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient></defs><g stroke="url(#gl)" stroke-width="1" fill="none"><path d="M-300 460 L460 0 M-100 460 L500 0 M100 460 L540 0 M300 460 L560 0 M500 460 L580 0 M700 460 L600 0 M900 460 L620 0 M1100 460 L660 0 M1300 460 L700 0"/><path d="M0 120 H1080 M0 180 H1080 M0 250 H1080 M0 330 H1080 M0 420 H1080 M0 70 H1080 M0 30 H1080"/></g></svg>`
export function chrome({ header = true } = {}) {
  const ground = h('div', { class: 'ground', 'aria-hidden': 'true' })
  ground.innerHTML = GRID
  document.body.prepend(ground)
  if (header) {
    const top = h('header', { class: 'top' },
      h('a', { href: '/', 'aria-label': 'الرئيسية' }, h('img', { class: 'ksau', src: '/assets/brand/logo_ksau.png', alt: 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية', width: 114, height: 40 })),
      h('div', { class: 'lockup', 'aria-label': 'نادي الأمن السيبراني بالشراكة مع نادي بصيرة' },
        h('img', { class: 'mark', src: '/assets/brand/cyber_mark.png', alt: '', width: 47, height: 34 }),
        h('span', { class: 'x', text: '×' }),
        h('span', { class: 'pill' }, h('img', { src: '/assets/brand/logo_baseerah.png', alt: '', width: 49, height: 26 }))))
    document.body.prepend(top)
    document.body.prepend(ground)
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {})
}
