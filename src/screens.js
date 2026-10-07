import * as THREE from 'three';

// Procedural screen content modelled on the iPhone Duo's iOS 27 layout as shown in
// hands-on photos: inner display = landscape Home Screen spanning both halves
// (widgets top-left, 4-column grids, vertical Dock on the right edge, status on the
// right, search button bottom-right); outer display = Lock Screen with a large clock.
// Icons are drawn here in the iOS style; no Apple artwork files are used.

const INNER_W = 2048, INNER_H = 1452;     // 1.41:1, same aspect on both displays
const OUTER_W = 1024, OUTER_H = 1452;

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_R = '"SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// iOS app-icon squircle (continuous corners)
function squircle(ctx, x, y, s) {
  const k = s * 0.5, c = s * 0.09;
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.bezierCurveTo(x + s - c, y, x + s, y + c, x + s, y + k);
  ctx.bezierCurveTo(x + s, y + s - c, x + s - c, y + s, x + k, y + s);
  ctx.bezierCurveTo(x + c, y + s, x, y + s - c, x, y + k);
  ctx.bezierCurveTo(x, y + c, x + c, y, x + k, y);
  ctx.closePath();
}
const lin = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rad = (ctx, x, y, r, stops) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };


// ---------------------------------------------------------------- wallpaper
// cheap, portable blur (no ctx.filter): downscale then upscale
function blurred(src, factor = 18) {
  const s = document.createElement('canvas');
  s.width = Math.max(1, Math.round(src.width / factor)); s.height = Math.max(1, Math.round(src.height / factor));
  const sx = s.getContext('2d'); sx.imageSmoothingQuality = 'high';
  sx.drawImage(src, 0, 0, s.width, s.height);
  const s2 = document.createElement('canvas');
  s2.width = Math.round(src.width / 4); s2.height = Math.round(src.height / 4);
  const x2 = s2.getContext('2d'); x2.imageSmoothingQuality = 'high';
  x2.drawImage(s, 0, 0, s2.width, s2.height);
  return s2;
}

// Liquid Glass panel: blurred backdrop + tint + specular rim
function glassPanel(ctx, blur, x, y, w, h, r, { tint = 'rgba(255,255,255,0.22)', dark = false } = {}) {
  ctx.save();
  rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.drawImage(blur, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = dark ? 'rgba(30,30,34,0.25)' : tint;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = lin(ctx, x, y, x, y + h, [[0, 'rgba(255,255,255,0.18)'], [0.3, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.06)']]);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  rr(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.strokeStyle = lin(ctx, x, y, x + w, y + h, [[0, 'rgba(255,255,255,0.75)'], [0.4, 'rgba(255,255,255,0.15)'], [0.7, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0.5)']]);
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

// ---------------------------------------------------------------- icons
// Each painter draws inside a unit square scaled to `s`, origin top-left.
const W = '#ffffff';
function disc(ctx, x, y, r, f) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = f; ctx.fill(); }
function line(ctx, pts, lw, col, cap = 'round') { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke(); }

const ICON = {
  facetime(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#5df07b'], [1, '#13c23d']]); c.fillRect(0, 0, s, s);
    rr(c, s * 0.17, s * 0.33, s * 0.44, s * 0.34, s * 0.08); c.fillStyle = W; c.fill();
    c.beginPath(); c.moveTo(s * 0.63, s * 0.45); c.lineTo(s * 0.82, s * 0.34); c.lineTo(s * 0.82, s * 0.66); c.lineTo(s * 0.63, s * 0.55); c.fill(); },
  calendar(c, s, d) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#ff3b30'; c.font = `600 ${s * 0.15}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(d.toLocaleDateString('en', { weekday: 'short' }), s / 2, s * 0.22);
    c.fillStyle = '#1c1c1e'; c.font = `300 ${s * 0.5}px ${FONT}`; c.fillText(String(d.getDate()), s / 2, s * 0.6); },
  photos(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    const cols = ['#fdbb2d', '#f78f1e', '#ee4037', '#c7348c', '#8e44ad', '#3f6fd8', '#29a8e0', '#58c157'];
    c.globalCompositeOperation = 'multiply';
    cols.forEach((col, i) => { c.save(); c.translate(s / 2, s / 2); c.rotate(i * Math.PI / 4); c.beginPath(); c.ellipse(0, -s * 0.17, s * 0.1, s * 0.17, 0, 0, Math.PI * 2); c.fillStyle = col; c.globalAlpha = 0.85; c.fill(); c.restore(); });
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; },
  camera(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#e8e8ed'], [1, '#a1a1a8']]); c.fillRect(0, 0, s, s);
    rr(c, s * 0.12, s * 0.3, s * 0.76, s * 0.5, s * 0.1); c.fillStyle = '#2c2c30'; c.fill();
    rr(c, s * 0.35, s * 0.22, s * 0.3, s * 0.12, s * 0.04); c.fill();
    disc(c, s / 2, s * 0.55, s * 0.17, '#e6e6ea'); disc(c, s / 2, s * 0.55, s * 0.12, '#1d2a44'); disc(c, s * 0.46, s * 0.51, s * 0.035, 'rgba(255,255,255,0.7)'); },
  mail(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#1fb1ff'], [1, '#0a6cf0']]); c.fillRect(0, 0, s, s);
    rr(c, s * 0.16, s * 0.28, s * 0.68, s * 0.46, s * 0.05); c.fillStyle = W; c.fill();
    line(c, [[s * 0.18, s * 0.31], [s / 2, s * 0.55], [s * 0.82, s * 0.31]], s * 0.035, '#5ab2f5'); },
  notes(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    c.fillStyle = lin(c, 0, 0, 0, s * 0.26, [[0, '#ffd84d'], [1, '#f9c623']]); c.fillRect(0, 0, s, s * 0.26);
    for (let i = 0; i < 4; i++) line(c, [[s * 0.1, s * (0.42 + i * 0.13)], [s * 0.9, s * (0.42 + i * 0.13)]], s * 0.012, '#c8c8cc', 'butt');
    c.fillStyle = '#d0d0d4'; for (let i = 0; i < 7; i++) disc(c, s * (0.12 + i * 0.127), s * 0.29, s * 0.012, '#bdbdc2'); },
  clock(c, s, d) { c.fillStyle = '#161618'; c.fillRect(0, 0, s, s); disc(c, s / 2, s / 2, s * 0.4, '#fff');
    c.fillStyle = '#111'; c.font = `500 ${s * 0.07}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; c.fillText(String(i), s / 2 + Math.sin(a) * s * 0.32, s / 2 - Math.cos(a) * s * 0.32); }
    const hA = ((d.getHours() % 12) + d.getMinutes() / 60) * Math.PI / 6, mA = d.getMinutes() * Math.PI / 30;
    line(c, [[s / 2, s / 2], [s / 2 + Math.sin(hA) * s * 0.18, s / 2 - Math.cos(hA) * s * 0.18]], s * 0.035, '#111');
    line(c, [[s / 2, s / 2], [s / 2 + Math.sin(mA) * s * 0.28, s / 2 - Math.cos(mA) * s * 0.28]], s * 0.025, '#111');
    line(c, [[s / 2, s / 2], [s / 2 + Math.sin(mA + 2) * s * 0.3, s / 2 - Math.cos(mA + 2) * s * 0.3]], s * 0.01, '#ff9500');
    disc(c, s / 2, s / 2, s * 0.025, '#ff9500'); },
  maps(c, s) { c.fillStyle = '#f3efe4'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#9bd79a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 0.55, 0); c.lineTo(0, s * 0.55); c.fill();
    c.fillStyle = '#7cc3ff'; c.beginPath(); c.moveTo(s, s * 0.55); c.lineTo(s, s); c.lineTo(s * 0.55, s); c.fill();
    line(c, [[s * 0.1, s * 1.0], [s * 1.0, s * 0.1]], s * 0.12, '#ffd34d', 'butt');
    line(c, [[0, s * 0.62], [s * 0.65, s * 0.0]], s * 0.05, '#fff', 'butt');
    c.fillStyle = '#1b84ff'; c.beginPath(); c.moveTo(s / 2, s * 0.25); c.lineTo(s * 0.68, s * 0.7); c.lineTo(s / 2, s * 0.6); c.lineTo(s * 0.32, s * 0.7); c.closePath(); c.fill(); },
  siri(c, s) { c.fillStyle = '#0b0b12'; c.fillRect(0, 0, s, s);
    disc(c, s / 2, s / 2, s * 0.36, rad(c, s * 0.45, s * 0.42, s * 0.4, [[0, '#d4f1ff'], [0.4, '#5f7fd6'], [0.75, '#2a1c55'], [1, '#0b0b12']]));
    c.globalAlpha = 0.7; disc(c, s * 0.42, s * 0.4, s * 0.12, '#ffffff'); c.globalAlpha = 1; },
  tv(c, s) { c.fillStyle = '#121214'; c.fillRect(0, 0, s, s);
    c.fillStyle = '#fff'; c.font = `600 ${s * 0.3}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('tv', s * 0.56, s * 0.53);
    c.beginPath(); c.arc(s * 0.3, s * 0.5, s * 0.08, 0, Math.PI * 2); c.fill(); },
  health(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    c.fillStyle = lin(c, 0, s * 0.25, 0, s * 0.8, [[0, '#ff5f6d'], [1, '#ff2d55']]);
    c.beginPath(); c.moveTo(s / 2, s * 0.78); c.bezierCurveTo(s * 0.1, s * 0.5, s * 0.2, s * 0.15, s / 2, s * 0.33); c.bezierCurveTo(s * 0.8, s * 0.15, s * 0.9, s * 0.5, s / 2, s * 0.78); c.fill(); },
  reminders(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    ['#0a84ff', '#ff3b30', '#ff9500'].forEach((col, i) => { const y = s * (0.27 + i * 0.23); c.beginPath(); c.arc(s * 0.24, y, s * 0.07, 0, Math.PI * 2); c.strokeStyle = col; c.lineWidth = s * 0.03; c.stroke(); line(c, [[s * 0.4, y], [s * 0.85, y]], s * 0.02, '#d6d6db', 'butt'); }); },
  shortcuts(c, s) { c.fillStyle = lin(c, 0, 0, s, s, [[0, '#3b3cf6'], [0.5, '#c546e8'], [1, '#ff4f89']]); c.fillRect(0, 0, s, s);
    c.globalAlpha = 0.9; rr(c, s * 0.24, s * 0.22, s * 0.36, s * 0.36, s * 0.1); c.fillStyle = '#ff9be0'; c.fill();
    rr(c, s * 0.4, s * 0.42, s * 0.36, s * 0.36, s * 0.1); c.fillStyle = '#6b8bff'; c.fill(); c.globalAlpha = 1; },
  appstore(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#1ec8ff'], [1, '#1170ff']]); c.fillRect(0, 0, s, s);
    line(c, [[s * 0.36, s * 0.24], [s * 0.62, s * 0.7]], s * 0.075, W); line(c, [[s * 0.64, s * 0.24], [s * 0.38, s * 0.7]], s * 0.075, W);
    line(c, [[s * 0.24, s * 0.58], [s * 0.76, s * 0.58]], s * 0.075, W); },
  wallet(c, s) { c.fillStyle = '#121214'; c.fillRect(0, 0, s, s);
    ['#3da7ff', '#ffb829', '#2fd27a', '#ff5a4a'].forEach((col, i) => { rr(c, s * 0.18, s * (0.24 + i * 0.07), s * 0.64, s * 0.24, s * 0.05); c.fillStyle = col; c.fill(); });
    rr(c, s * 0.16, s * 0.45, s * 0.68, s * 0.33, s * 0.06); c.fillStyle = '#d9cfbf'; c.fill(); },
  settings(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#d1d1d6'], [1, '#8e8e93']]); c.fillRect(0, 0, s, s);
    c.save(); c.translate(s / 2, s / 2);
    for (let i = 0; i < 36; i++) { c.rotate(Math.PI / 18); c.fillStyle = '#5b5b60'; c.fillRect(-s * 0.018, -s * 0.38, s * 0.036, s * 0.06); }
    disc(c, 0, 0, s * 0.32, '#5b5b60'); disc(c, 0, 0, s * 0.27, lin(c, 0, -s * 0.3, 0, s * 0.3, [[0, '#efeff2'], [1, '#a8a8ae']]));
    for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); line(c, [[0, 0], [0, -s * 0.22]], s * 0.04, '#6c6c71'); }
    disc(c, 0, 0, s * 0.09, '#6c6c71'); disc(c, 0, 0, s * 0.05, '#d4d4d8'); c.restore(); },
  weather(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#2f8ef7'], [1, '#7ec4ff']]); c.fillRect(0, 0, s, s);
    disc(c, s * 0.62, s * 0.36, s * 0.16, '#ffd43b');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 0.38, s * 0.6, s * 0.14, 0, 7); c.arc(s * 0.55, s * 0.52, s * 0.17, 0, 7); c.arc(s * 0.7, s * 0.62, s * 0.12, 0, 7); c.fill(); c.fillRect(s * 0.38, s * 0.6, s * 0.34, s * 0.14); },
  stocks(c, s) { c.fillStyle = '#111114'; c.fillRect(0, 0, s, s);
    line(c, [[s * 0.1, s * 0.62], [s * 0.25, s * 0.55], [s * 0.38, s * 0.66], [s * 0.5, s * 0.4], [s * 0.62, s * 0.48], [s * 0.75, s * 0.28], [s * 0.9, s * 0.35]], s * 0.035, '#34c759');
    line(c, [[s * 0.5, s * 0.15], [s * 0.5, s * 0.85]], s * 0.012, '#3a8bff', 'butt'); },
  findmy(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#f7f7fa'], [1, '#d8d8de']]); c.fillRect(0, 0, s, s);
    disc(c, s / 2, s / 2, s * 0.34, lin(c, 0, s * 0.15, 0, s * 0.85, [[0, '#52e07a'], [1, '#22b14c']]));
    disc(c, s / 2, s / 2, s * 0.2, '#f2f2f5'); disc(c, s / 2, s / 2, s * 0.1, '#1e9bff'); },
  podcasts(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#d27bff'], [1, '#8a2be2']]); c.fillRect(0, 0, s, s);
    for (const r of [0.3, 0.2]) { c.beginPath(); c.arc(s / 2, s * 0.44, s * r, Math.PI * 0.8, Math.PI * 2.2); c.strokeStyle = W; c.lineWidth = s * 0.05; c.stroke(); }
    disc(c, s / 2, s * 0.44, s * 0.08, W); rr(c, s * 0.45, s * 0.52, s * 0.1, s * 0.28, s * 0.05); c.fillStyle = W; c.fill(); },
  books(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#ffa94d'], [1, '#ff7a00']]); c.fillRect(0, 0, s, s);
    c.fillStyle = W; c.beginPath(); c.moveTo(s / 2, s * 0.32); c.quadraticCurveTo(s * 0.32, s * 0.24, s * 0.16, s * 0.3); c.lineTo(s * 0.16, s * 0.72); c.quadraticCurveTo(s * 0.32, s * 0.66, s / 2, s * 0.74); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(s / 2, s * 0.32); c.quadraticCurveTo(s * 0.68, s * 0.24, s * 0.84, s * 0.3); c.lineTo(s * 0.84, s * 0.72); c.quadraticCurveTo(s * 0.68, s * 0.66, s / 2, s * 0.74); c.closePath(); c.fillStyle = '#ffe7cc'; c.fill(); },
  fitness(c, s) { c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, s, s);
    [['#fa114f', 0.33], ['#92e82a', 0.24], ['#1ee3cf', 0.15]].forEach(([col, r]) => { c.beginPath(); c.arc(s / 2, s / 2, s * r, -Math.PI / 2, Math.PI * 1.25); c.strokeStyle = col; c.lineWidth = s * 0.075; c.lineCap = 'round'; c.stroke(); }); },
  files(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    rr(c, s * 0.14, s * 0.28, s * 0.36, s * 0.2, s * 0.05); c.fillStyle = '#1a8cff'; c.fill();
    rr(c, s * 0.14, s * 0.34, s * 0.72, s * 0.42, s * 0.06); c.fillStyle = lin(c, 0, s * 0.34, 0, s * 0.76, [[0, '#46b3ff'], [1, '#1a8cff']]); c.fill(); },
  preview(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#f8f8fb'], [1, '#d9dde6']]); c.fillRect(0, 0, s, s);
    rr(c, s * 0.2, s * 0.2, s * 0.6, s * 0.5, s * 0.06); c.fillStyle = lin(c, 0, s * 0.2, 0, s * 0.7, [[0, '#7fd3ff'], [1, '#4f8bff']]); c.fill();
    c.beginPath(); c.arc(s * 0.62, s * 0.62, s * 0.14, 0, 7); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill(); c.lineWidth = s * 0.05; c.strokeStyle = '#444'; c.stroke();
    line(c, [[s * 0.72, s * 0.72], [s * 0.84, s * 0.84]], s * 0.06, '#444'); },
  news(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    c.fillStyle = lin(c, 0, 0, s, s, [[0, '#ff5a6a'], [1, '#f2203a']]);
    c.beginPath(); c.moveTo(s * 0.2, s * 0.22); c.lineTo(s * 0.42, s * 0.22); c.lineTo(s * 0.8, s * 0.7); c.lineTo(s * 0.8, s * 0.22); c.lineTo(s * 0.8, s * 0.22);
    c.lineTo(s * 0.8, s * 0.78); c.lineTo(s * 0.58, s * 0.78); c.lineTo(s * 0.2, s * 0.3); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(s * 0.2, s * 0.42); c.lineTo(s * 0.45, s * 0.78); c.lineTo(s * 0.2, s * 0.78); c.fill(); c.beginPath(); c.moveTo(s * 0.55, s * 0.22); c.lineTo(s * 0.8, s * 0.22); c.lineTo(s * 0.8, s * 0.55); c.fill(); },
  folder(c, s) { c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(0, 0, s, s);
    const mini = ['calculator', 'voicememos', 'compass', 'measure', 'magnifier', 'contacts', 'home', 'translate', 'files'];
    for (let i = 0; i < 9; i++) { const x = s * (0.14 + (i % 3) * 0.25), y = s * (0.14 + Math.floor(i / 3) * 0.25); c.save(); c.translate(x, y); squircle(c, 0, 0, s * 0.2); c.clip(); (ICON[mini[i]] || ICON.settings)(c, s * 0.2, new Date()); c.restore(); } },
  translate(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#2aa6ff'], [1, '#0a6cf0']]); c.fillRect(0, 0, s, s);
    rr(c, s * 0.14, s * 0.18, s * 0.42, s * 0.36, s * 0.08); c.fillStyle = '#fff'; c.fill(); rr(c, s * 0.44, s * 0.44, s * 0.42, s * 0.36, s * 0.08); c.fillStyle = '#16233a'; c.fill();
    c.fillStyle = '#111'; c.font = `600 ${s * 0.22}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('A', s * 0.35, s * 0.37);
    c.fillStyle = '#fff'; c.font = `600 ${s * 0.2}px "Hiragino Sans", ${FONT}`; c.fillText('文', s * 0.65, s * 0.63); },
  freeform(c, s) { c.fillStyle = lin(c, 0, 0, s, s, [[0, '#0f6be0'], [1, '#0a3f99']]); c.fillRect(0, 0, s, s);
    line(c, [[s * 0.15, s * 0.6], [s * 0.3, s * 0.35], [s * 0.38, s * 0.6], [s * 0.5, s * 0.36], [s * 0.6, s * 0.62], [s * 0.72, s * 0.4], [s * 0.85, s * 0.5]], s * 0.06, '#7ff0ff'); },
  journal(c, s) { c.fillStyle = lin(c, 0, 0, s, s, [[0, '#6f4cff'], [1, '#2b1a7a']]); c.fillRect(0, 0, s, s);
    [['#ff5ea8', -0.5], ['#ffb84d', -0.15], ['#5ef0ff', 0.2], ['#b37bff', 0.55]].forEach(([col, a]) => { c.save(); c.translate(s / 2, s * 0.62); c.rotate(a); c.beginPath(); c.ellipse(0, -s * 0.2, s * 0.09, s * 0.22, 0, 0, 7); c.fillStyle = col; c.globalAlpha = 0.85; c.fill(); c.restore(); }); c.globalAlpha = 1; },
  keynote(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#2a9bff'], [1, '#0c58d6']]); c.fillRect(0, 0, s, s);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(s * 0.2, s * 0.25); c.lineTo(s * 0.8, s * 0.25); c.lineTo(s * 0.7, s * 0.55); c.lineTo(s * 0.3, s * 0.55); c.fill();
    c.fillRect(s * 0.47, s * 0.55, s * 0.06, s * 0.2); c.fillRect(s * 0.32, s * 0.74, s * 0.36, s * 0.05); },
  numbers(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#3ed66c'], [1, '#12a03e']]); c.fillRect(0, 0, s, s);
    [[0.22, 0.4], [0.4, 0.25], [0.58, 0.5], [0.76, 0.3]].forEach(([x, y]) => { rr(c, s * (x - 0.06), s * y, s * 0.12, s * (0.78 - y), s * 0.02); c.fillStyle = '#fff'; c.fill(); }); },
  pages(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#ff9d3c'], [1, '#ff6a00']]); c.fillRect(0, 0, s, s);
    c.save(); c.translate(s / 2, s / 2); c.rotate(-0.75); rr(c, -s * 0.07, -s * 0.36, s * 0.14, s * 0.6, s * 0.03); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.moveTo(-s * 0.07, s * 0.24); c.lineTo(0, s * 0.36); c.lineTo(s * 0.07, s * 0.24); c.fill(); c.restore(); },
  home(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#ffd04d'], [1, '#ff9f0a']]); c.fillRect(0, 0, s, s);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(s / 2, s * 0.2); c.lineTo(s * 0.82, s * 0.5); c.lineTo(s * 0.72, s * 0.5); c.lineTo(s * 0.72, s * 0.8); c.lineTo(s * 0.28, s * 0.8); c.lineTo(s * 0.28, s * 0.5); c.lineTo(s * 0.18, s * 0.5); c.closePath(); c.fill();
    rr(c, s * 0.44, s * 0.6, s * 0.12, s * 0.2, s * 0.02); c.fillStyle = '#ffb21e'; c.fill(); },
  voicememos(c, s) { c.fillStyle = '#111114'; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 13; i++) { const h = (0.08 + 0.32 * Math.abs(Math.sin(i * 1.7))) * s; rr(c, s * (0.12 + i * 0.06), s / 2 - h / 2, s * 0.03, h, s * 0.015); c.fillStyle = '#ff375f'; c.fill(); } },
  calculator(c, s) { c.fillStyle = '#1c1c1e'; c.fillRect(0, 0, s, s);
    [['#a5a5aa', 0.3, 0.3], ['#ff9f0a', 0.7, 0.3], ['#505055', 0.3, 0.7], ['#ff9f0a', 0.7, 0.7]].forEach(([col, x, y]) => disc(c, s * x, s * y, s * 0.15, col));
    c.fillStyle = '#fff'; c.font = `500 ${s * 0.2}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('−', s * 0.7, s * 0.29); c.fillText('=', s * 0.7, s * 0.69); c.fillText('+', s * 0.3, s * 0.69); },
  contacts(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#cfcfd4'], [1, '#9a9aa1']]); c.fillRect(0, 0, s, s);
    disc(c, s / 2, s * 0.4, s * 0.15, '#f2f2f5'); c.beginPath(); c.ellipse(s / 2, s * 0.86, s * 0.3, s * 0.26, 0, Math.PI, 0); c.fillStyle = '#f2f2f5'; c.fill(); },
  compass(c, s) { c.fillStyle = '#111'; c.fillRect(0, 0, s, s); disc(c, s / 2, s / 2, s * 0.33, '#fff'); c.fillStyle = '#ff3b30'; c.beginPath(); c.moveTo(s / 2, s * 0.22); c.lineTo(s * 0.56, s / 2); c.lineTo(s * 0.44, s / 2); c.fill(); },
  measure(c, s) { c.fillStyle = '#111'; c.fillRect(0, 0, s, s); rr(c, s * 0.15, s * 0.4, s * 0.7, s * 0.2, s * 0.03); c.fillStyle = '#ffd60a'; c.fill(); },
  magnifier(c, s) { c.fillStyle = '#111'; c.fillRect(0, 0, s, s); c.beginPath(); c.arc(s * 0.45, s * 0.45, s * 0.2, 0, 7); c.strokeStyle = '#fff'; c.lineWidth = s * 0.07; c.stroke(); line(c, [[s * 0.6, s * 0.6], [s * 0.78, s * 0.78]], s * 0.08, '#fff'); },
  phone(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#5df07b'], [1, '#13c23d']]); c.fillRect(0, 0, s, s);
    // handset glyph: Material Icons "call" path (Apache 2.0)
    c.save(); c.translate(s * 0.2, s * 0.2); c.scale(s * 0.6 / 24, s * 0.6 / 24); c.fillStyle = W;
    c.fill(new Path2D('M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z'));
    c.restore(); },
  safari(c, s) { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s);
    disc(c, s / 2, s / 2, s * 0.4, lin(c, 0, s * 0.1, 0, s * 0.9, [[0, '#1fd1ff'], [1, '#1564e8']]));
    c.save(); c.translate(s / 2, s / 2); for (let i = 0; i < 48; i++) { c.rotate(Math.PI / 24); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(-s * 0.004, -s * 0.37, s * 0.008, i % 4 ? s * 0.03 : s * 0.05); }
    c.rotate(0.75); c.fillStyle = '#ff3b30'; c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(s * 0.05, 0); c.lineTo(-s * 0.05, 0); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, s * 0.3); c.lineTo(s * 0.05, 0); c.lineTo(-s * 0.05, 0); c.fill(); c.restore(); },
  messages(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#5df07b'], [1, '#13c23d']]); c.fillRect(0, 0, s, s);
    c.fillStyle = W; c.beginPath(); c.ellipse(s / 2, s * 0.47, s * 0.32, s * 0.26, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(s * 0.3, s * 0.62); c.quadraticCurveTo(s * 0.26, s * 0.76, s * 0.18, s * 0.8); c.quadraticCurveTo(s * 0.36, s * 0.78, s * 0.44, s * 0.7); c.fill(); },
  music(c, s) { c.fillStyle = lin(c, 0, 0, 0, s, [[0, '#ff6b86'], [1, '#fa233b']]); c.fillRect(0, 0, s, s);
    c.fillStyle = W; c.beginPath(); c.ellipse(s * 0.36, s * 0.7, s * 0.11, s * 0.085, -0.4, 0, 7); c.fill(); c.beginPath(); c.ellipse(s * 0.68, s * 0.62, s * 0.11, s * 0.085, -0.4, 0, 7); c.fill();
    c.fillRect(s * 0.44, s * 0.26, s * 0.04, s * 0.44); c.fillRect(s * 0.76, s * 0.18, s * 0.04, s * 0.44);
    c.beginPath(); c.moveTo(s * 0.44, s * 0.26); c.lineTo(s * 0.8, s * 0.18); c.lineTo(s * 0.8, s * 0.28); c.lineTo(s * 0.44, s * 0.36); c.fill(); },
  flashlight(c, s) { rr(c, s * 0.4, s * 0.3, s * 0.2, s * 0.45, s * 0.04); c.fillStyle = W; c.fill(); rr(c, s * 0.33, s * 0.2, s * 0.34, s * 0.14, s * 0.04); c.fill(); },
};

function drawIcon(ctx, name, x, y, s, now) {
  ctx.save();
  // soft drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = s * 0.12; ctx.shadowOffsetY = s * 0.04;
  squircle(ctx, x, y, s); ctx.fillStyle = '#000'; ctx.fill();
  ctx.restore();
  ctx.save();
  squircle(ctx, x, y, s); ctx.clip();
  ctx.translate(x, y);
  (ICON[name] || ICON.settings)(ctx, s, now);
  ctx.restore();
  // Liquid Glass rim: bright upper-left edge, faint lower-right
  ctx.save();
  squircle(ctx, x + 1.5, y + 1.5, s - 3);
  ctx.strokeStyle = lin(ctx, x, y, x + s, y + s, [[0, 'rgba(255,255,255,0.75)'], [0.35, 'rgba(255,255,255,0.12)'], [0.75, 'rgba(255,255,255,0.05)'], [1, 'rgba(255,255,255,0.4)']]);
  ctx.lineWidth = Math.max(1.5, s * 0.022);
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, cx, y, size) {
  ctx.save();
  ctx.font = `500 ${size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = size * 0.35; ctx.shadowOffsetY = size * 0.04;
  ctx.fillStyle = '#fff';
  ctx.fillText(text, cx, y);
  ctx.restore();
}

function timeStr(d) {
  let h = d.getHours() % 12; if (h === 0) h = 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function wifi(ctx, cx, cy, s, col = '#fff') {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, s * (0.35 + i * 0.3), Math.PI * 1.22, Math.PI * 1.78); ctx.lineWidth = s * 0.16; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill(); ctx.restore();
}
function battery(ctx, x, y, s, col = '#fff') {
  ctx.save();
  rr(ctx, x, y, s * 2.1, s, s * 0.32); ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = s * 0.1; ctx.stroke(); ctx.globalAlpha = 1;
  rr(ctx, x + s * 0.16, y + s * 0.16, s * 1.5, s * 0.68, s * 0.18); ctx.fillStyle = col; ctx.fill();
  rr(ctx, x + s * 2.2, y + s * 0.32, s * 0.12, s * 0.36, s * 0.06); ctx.globalAlpha = 0.45; ctx.fill(); ctx.restore();
}

// left-half grid, right-half grid and dock (iOS 27 Duo inner layout)
const LEFT = [
  ['facetime', 'FaceTime'], ['calendar', 'Calendar'], ['photos', 'Photos'], ['camera', 'Camera'],
  ['mail', 'Mail'], ['notes', 'Notes'], ['clock', 'Clock'], ['maps', 'Maps'],
  ['siri', 'Siri'], ['tv', 'TV'], ['health', 'Health'], ['reminders', 'Reminders'],
  ['shortcuts', 'Shortcuts'], ['appstore', 'App Store'], ['wallet', 'Wallet'], ['settings', 'Settings'],
];
const RIGHT = [
  ['weather', 'Weather'], ['stocks', 'Stocks'], ['findmy', 'Find My'], ['podcasts', 'Podcasts'],
  ['books', 'Books'], ['fitness', 'Fitness'], ['files', 'Files'], ['preview', 'Preview'],
  ['news', 'News'], ['folder', 'Utilities'], ['translate', 'Translate'], ['freeform', 'Freeform'],
  ['journal', 'Journal'], ['keynote', 'Keynote'], ['numbers', 'Numbers'], ['pages', 'Pages'],
  ['home', 'Home'], ['voicememos', 'Voice Memos'], ['calculator', 'Calculator'], ['contacts', 'Contacts'],
];
const DOCK = ['phone', 'safari', 'messages', 'music'];

function paintPhotoWidget(ctx, x, y, w, h) {
  // a "memory": sunset over the sea with a figure, painted
  ctx.save(); rr(ctx, x, y, w, h, w * 0.12); ctx.clip();
  ctx.fillStyle = lin(ctx, x, y, x, y + h * 0.62, [[0, '#2b3d75'], [0.45, '#d9707a'], [1, '#ffc27a']]); ctx.fillRect(x, y, w, h);
  disc(ctx, x + w * 0.62, y + h * 0.56, w * 0.09, '#fff1c9');
  ctx.fillStyle = lin(ctx, x, y + h * 0.6, x, y + h, [[0, '#2f4f80'], [1, '#14233f']]); ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
  ctx.globalAlpha = 0.5; for (let i = 0; i < 8; i++) { ctx.fillStyle = '#ffd59a'; ctx.fillRect(x + w * (0.5 + Math.sin(i) * 0.08), y + h * (0.63 + i * 0.035), w * (0.25 - i * 0.02), 3); } ctx.globalAlpha = 1;
  ctx.fillStyle = '#16151c';
  ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + h * 0.5, w * 0.06, h * 0.07, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.18, y + h); ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.6, x + w * 0.3, y + h * 0.58); ctx.quadraticCurveTo(x + w * 0.42, y + h * 0.6, x + w * 0.44, y + h); ctx.fill();
  ctx.fillStyle = lin(ctx, x, y + h * 0.55, x, y + h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]); ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${h * 0.11}px ${FONT}`; ctx.fillText('Golden Hour', x + w * 0.08, y + h * 0.8);
  ctx.font = `600 ${h * 0.075}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText('AUG 23, 2026', x + w * 0.08, y + h * 0.9); ctx.globalAlpha = 1;
  ctx.restore();
}

function paintWeatherWidget(ctx, x, y, w, h) {
  ctx.save(); rr(ctx, x, y, w, h, w * 0.12); ctx.clip();
  ctx.fillStyle = lin(ctx, x, y, x, y + h, [[0, '#2f7fe8'], [1, '#5fa8f2']]); ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${h * 0.1}px ${FONT}`; ctx.fillText('Istanbul ➤', x + w * 0.09, y + h * 0.18);
  ctx.font = `300 ${h * 0.3}px ${FONT}`; ctx.fillText('23°', x + w * 0.07, y + h * 0.46);
  disc(ctx, x + w * 0.14, y + h * 0.7, h * 0.045, '#ffd43b');
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${h * 0.085}px ${FONT}`; ctx.fillText('Mostly Sunny', x + w * 0.09, y + h * 0.83);
  ctx.globalAlpha = 0.85; ctx.fillText('H:26°  L:17°', x + w * 0.09, y + h * 0.93); ctx.globalAlpha = 1;
}

export class Screens {
  constructor() {
    this.inner = document.createElement('canvas');
    this.inner.width = INNER_W; this.inner.height = INNER_H;
    this.outer = document.createElement('canvas');
    this.outer.width = OUTER_W; this.outer.height = OUTER_H;
    this.innerTex = new THREE.CanvasTexture(this.inner);
    this.outerTex = new THREE.CanvasTexture(this.outer);
    for (const t of [this.innerTex, this.outerTex]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.minFilter = THREE.LinearMipmapLinearFilter;
    }
    // Apple's iPhone Duo wallpapers (light), plus a cut-out of the mountains for the
    // Lock Screen depth effect (tools: see README).
    const img = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    this.ready = Promise.all([img('assets/wall-inner.jpg'), img('assets/wall-outer.jpg'), img('assets/wall-outer-fg.png')]).then(([wi, wo, fg]) => {
      this._wpInner = this._cover(wi, INNER_W, INNER_H);
      this._wpOuter = this._cover(wo, OUTER_W, OUTER_H);
      this._fgOuter = this._cover(fg, OUTER_W, OUTER_H);
      this._blurInner = blurred(this._wpInner);
      this._blurOuter = blurred(this._wpOuter);
      this.draw();
    });
  }

  _cover(im, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const k = Math.max(w / im.width, h / im.height);
    const dw = im.width * k, dh = im.height * k;
    c.getContext('2d').drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return c;
  }

  setCaught() { /* the Home Screen stays stock; score lives in the page HUD */ }

  draw() { if (!this._wpInner) return; this.drawInner(); this.drawOuter(); }

  drawInner() {
    const ctx = this.inner.getContext('2d');
    const Wd = INNER_W, H = INNER_H, now = new Date();
    ctx.drawImage(this._wpInner, 0, 0);

    const S = 132;                    // icon size
    const lab = 27;
    const half = Wd / 2;
    // --- left half: widgets (2x2 each) then a 4x4 grid
    const lx0 = 92, colStep = (half - 92 - 70 - S) / 3;
    const wTop = 96, wSize = colStep + S;      // widget spans two columns
    paintWeatherWidget(ctx, lx0, wTop, wSize, wSize * 0.94);
    label(ctx, 'Weather', lx0 + wSize / 2, wTop + wSize * 0.94 + 10, lab);
    paintPhotoWidget(ctx, lx0 + colStep * 2, wTop, wSize, wSize * 0.94);
    label(ctx, 'Photos', lx0 + colStep * 2 + wSize / 2, wTop + wSize * 0.94 + 10, lab);
    const gy0 = wTop + wSize * 0.94 + 92, rowStep = (H - 120 - gy0 - S) / 3;
    LEFT.forEach(([k, name], i) => {
      const x = lx0 + (i % 4) * colStep, y = gy0 + Math.floor(i / 4) * rowStep;
      drawIcon(ctx, k, x, y, S, now); label(ctx, name, x + S / 2, y + S + 9, lab);
    });
    // page dots
    for (let i = 0; i < 2; i++) disc(ctx, half - 14 + i * 28, H - 40, 7, i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)');

    // --- right half: 5 rows x 4, then the vertical dock on the right edge
    const dockW = 168, rx0 = half + 70, rightEdge = Wd - dockW - 96;
    const rColStep = (rightEdge - rx0 - S) / 3;
    const ry0 = 96, rRowStep = (H - 230 - ry0 - S) / 4;
    RIGHT.forEach(([k, name], i) => {
      const x = rx0 + (i % 4) * rColStep, y = ry0 + Math.floor(i / 4) * rRowStep;
      drawIcon(ctx, k, x, y, S, now); label(ctx, name, x + S / 2, y + S + 9, lab);
    });
    // dock
    const dx = Wd - dockW - 34, dy = H * 0.36, dh = H * 0.6;
    glassPanel(ctx, this._blurInner, dx, dy, dockW, dh, dockW * 0.42);
    const ds = 124, dStep = (dh - 60 - ds) / 3;
    DOCK.forEach((k, i) => drawIcon(ctx, k, dx + (dockW - ds) / 2, dy + 30 + i * dStep, ds, now));
    // search button, bottom right (left of the dock)
    const sx = dx - 120, sy = H - 132;
    glassPanel(ctx, this._blurInner, sx, sy, 92, 92, 46);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(sx + 42, sy + 42, 15, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx + 53, sy + 53); ctx.lineTo(sx + 64, sy + 64); ctx.stroke(); ctx.restore();

    // --- status, top right corner (time, then Wi-Fi + battery beneath)
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff'; ctx.font = `600 40px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(timeStr(now), Wd - 58, 64);
    ctx.restore();
    wifi(ctx, Wd - 140, 130, 34);
    battery(ctx, Wd - 120, 106, 22);

    this.innerTex.needsUpdate = true;
  }

  drawOuter() {
    // Lock Screen as on the Duo's outer display: date, a tall condensed clock that the
    // mountains overlap, Wi-Fi status bubble under the camera, stacked quick actions.
    const ctx = this.outer.getContext('2d');
    const Wd = OUTER_W, H = OUTER_H, now = new Date();
    ctx.drawImage(this._wpOuter, 0, 0);
    const cx = Wd * 0.47;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.font = `600 50px ${FONT}`;
    ctx.fillText(now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), cx, H * 0.085);
    // clock: condensed by scaling x; glassy white with a soft vertical falloff
    const t = timeStr(now);
    const size = Math.round(H * 0.34), sx = 0.6;
    ctx.font = `500 ${size}px ${FONT}`;
    const top = H * 0.105, base = H * 0.362;
    ctx.fillStyle = lin(ctx, 0, top, 0, base, [[0, 'rgba(255,255,255,0.97)'], [0.7, 'rgba(255,255,255,0.9)'], [1, 'rgba(250,246,240,0.82)']]);
    ctx.translate(cx, base); ctx.scale(sx, 1);
    ctx.fillText(t, 0, 0);
    ctx.restore();
    // mountains in front of the digits
    ctx.drawImage(this._fgOuter, 0, 0);
    // Wi-Fi status bubble under the front camera
    const bx = Wd * 0.865, by = H * 0.14, br = Wd * 0.052;
    glassPanel(ctx, this._blurOuter, bx - br, by - br, br * 2, br * 2, br, { tint: 'rgba(255,255,255,0.12)' });
    wifi(ctx, bx, by + br * 0.32, br * 0.62);
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(bx + Math.cos(Math.PI * (0.15 + i * 0.175)) * br * 0.72, by + Math.sin(Math.PI * (0.15 + i * 0.175)) * br * 0.72, br * 0.05, 0, 7); ctx.fill(); }
    ctx.restore();
    // flashlight + camera, stacked bottom right
    const qx = Wd * 0.88, qr = Wd * 0.058;
    for (const [qy, k] of [[H * 0.79, 'torch'], [H * 0.885, 'cam']]) {
      glassPanel(ctx, this._blurOuter, qx - qr, qy - qr, qr * 2, qr * 2, qr, { tint: 'rgba(255,255,255,0.14)' });
      ctx.save(); ctx.translate(qx, qy); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
      if (k === 'torch') {
        rr(ctx, -qr * 0.13, -qr * 0.05, qr * 0.26, qr * 0.5, qr * 0.05); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-qr * 0.22, -qr * 0.42); ctx.lineTo(qr * 0.22, -qr * 0.42); ctx.lineTo(qr * 0.13, -qr * 0.08); ctx.lineTo(-qr * 0.13, -qr * 0.08); ctx.closePath(); ctx.fill();
        disc(ctx, 0, qr * 0.08, qr * 0.04, '#9a9a9a');
      } else {
        rr(ctx, -qr * 0.4, -qr * 0.22, qr * 0.8, qr * 0.56, qr * 0.1); ctx.fill();
        rr(ctx, -qr * 0.14, -qr * 0.33, qr * 0.28, qr * 0.14, qr * 0.04); ctx.fill();
        disc(ctx, 0, qr * 0.06, qr * 0.17, '#8d8d8d'); disc(ctx, 0, qr * 0.06, qr * 0.11, '#fff');
      }
      ctx.restore();
    }
    // home indicator
    rr(ctx, Wd / 2 - Wd * 0.19, H - 34, Wd * 0.38, 11, 6); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    this.outerTex.needsUpdate = true;
  }
}
