// Club-style QR (ref_qr_poster.png): gradient modules on white, the club mark in the centre. Error correction H so the
// centre badge never breaks scanning. Needs /js/vendor/qrcode.js loaded first (window.qrcode).
export function qrSvg(text, { size = 600, mark = '/assets/brand/cyber_mark_keyed.png' } = {}) {
  const q = window.qrcode(0, 'H')
  q.addData(text)
  q.make()
  const n = q.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2)
  const at = (i) => (i + quiet) * cell
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
  const hole = Math.round(n * 0.22) | 1, h0 = (n - hole) / 2
  const inHole = (r, c) => r >= h0 - 0.5 && r < h0 + hole && c >= h0 - 0.5 && c < h0 + hole
  let dots = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!q.isDark(r, c) || finder(r, c) || inHole(r, c)) continue
    dots += `<rect x="${at(c).toFixed(2)}" y="${at(r).toFixed(2)}" width="${(cell * 0.92).toFixed(2)}" height="${(cell * 0.92).toFixed(2)}" rx="${(cell * 0.3).toFixed(2)}"/>`
  }
  const eye = (r, c) => `<rect x="${at(c) + cell / 2}" y="${at(r) + cell / 2}" width="${cell * 6}" height="${cell * 6}" rx="${cell * 1.6}" fill="none" stroke="url(#qg)" stroke-width="${cell}"/>
    <rect x="${at(c) + cell * 2}" y="${at(r) + cell * 2}" width="${cell * 3}" height="${cell * 3}" rx="${cell * 0.8}" fill="url(#qg)"/>`
  const b = hole * cell, bx = at(h0)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="رمز QR: ${text}">
  <defs><linearGradient id="qg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16807c"/><stop offset=".5" stop-color="#2f5aa8"/><stop offset="1" stop-color="#4b33b8"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="#fff"/>
  <g fill="url(#qg)">${dots}</g>${eye(0, 0)}${eye(0, n - 7)}${eye(n - 7, 0)}
  <rect x="${bx}" y="${bx}" width="${b}" height="${b}" rx="${b * 0.24}" fill="#2a1c7a"/>
  <image href="${mark}" x="${bx + b * 0.14}" y="${bx + b * 0.14}" width="${b * 0.72}" height="${b * 0.72}"/>
</svg>`
}
