import * as THREE from 'three';

// Procedural screen content. The inner display (7.6", 1.41:1) spans both halves,
// the outer display (5.4") sits on the back of the swinging half.
// Nothing here copies Apple artwork: icons are generic glyph tiles.

const INNER_W = 2048, INNER_H = 1452;
const OUTER_W = 1024, OUTER_H = 1452;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wallpaper(ctx, w, h, seed = 0) {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, '#0c1630');
  g.addColorStop(0.55, '#16224a');
  g.addColorStop(1, '#2a1b3d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const blobs = [
    [0.18, 0.22, 0.55, 'rgba(64,140,255,0.55)'],
    [0.78, 0.30, 0.45, 'rgba(120,90,255,0.45)'],
    [0.52, 0.88, 0.60, 'rgba(255,120,150,0.35)'],
    [0.95, 0.85, 0.35, 'rgba(60,210,230,0.30)'],
  ];
  for (const [bx, by, br, c] of blobs) {
    const x = ((bx + seed * 0.07) % 1) * w, y = by * h, r = br * Math.max(w, h);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }
  // fine grain so the blur reveal has something to resolve
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function glass(ctx, x, y, w, h, r) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

function timeStr(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
}

function statusBar(ctx, x, y, w, scale, now) {
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${30 * scale}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(timeStr(now), x, y);
  // battery
  const bx = x + w - 62 * scale, by = y - 12 * scale;
  rr(ctx, bx, by, 50 * scale, 24 * scale, 7 * scale);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2.5 * scale; ctx.stroke();
  rr(ctx, bx + 4 * scale, by + 4 * scale, 36 * scale, 16 * scale, 4 * scale);
  ctx.fillStyle = '#fff'; ctx.fill();
  // signal bars
  for (let i = 0; i < 4; i++) {
    const bh = (8 + i * 5) * scale;
    rr(ctx, bx - 120 * scale + i * 11 * scale, y + 12 * scale - bh, 7 * scale, bh, 2 * scale);
    ctx.fill();
  }
  // wifi
  ctx.beginPath();
  ctx.lineWidth = 4 * scale; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(bx - 30 * scale, y + 12 * scale, (6 + i * 7) * scale, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
}

const ICONS = [
  ['#ff9f0a', '#ff6b00', 'sun'], ['#30d158', '#20a046', 'chat'], ['#0a84ff', '#0060df', 'compass'],
  ['#ff375f', '#d70040', 'note'], ['#64d2ff', '#2a9ad8', 'cloud'], ['#ffd60a', '#f2a900', 'bolt'],
  ['#bf5af2', '#8e3bd0', 'star'], ['#ffffff', '#d8d8de', 'cal'], ['#5e5ce6', '#3d3bc4', 'wave'],
  ['#ff453a', '#c0261d', 'play'], ['#32d74b', '#1f9e35', 'leaf'], ['#8e8e93', '#5c5c62', 'gear'],
  ['#0a84ff', '#5e5ce6', 'grid'], ['#ff9f0a', '#ff375f', 'cam'], ['#66d4cf', '#2a9a95', 'map'],
  ['#1c1c1e', '#3a3a3c', 'clock'],
];

function glyph(ctx, kind, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = kind === 'cal' ? '#ff3b30' : '#fff';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = s * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s * 0.28;
  switch (kind) {
    case 'sun': ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); ctx.stroke(); } break;
    case 'chat': rr(ctx, -r, -r * 0.8, r * 2, r * 1.5, r * 0.6); ctx.fill(); ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.5); ctx.lineTo(-r * 0.8, r * 1.1); ctx.lineTo(0, r * 0.6); ctx.fill(); break;
    case 'compass': ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.6); ctx.lineTo(-r * 0.2, -r * 0.2); ctx.lineTo(-r * 0.6, r * 0.6); ctx.lineTo(r * 0.2, r * 0.2); ctx.fill(); break;
    case 'note': ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.6, r * 0.38, 0, 7); ctx.fill(); ctx.fillRect(-r * 0.05, -r, r * 0.16, r * 1.6); ctx.fillRect(-r * 0.05, -r, r * 0.8, r * 0.3); break;
    case 'cloud': ctx.beginPath(); ctx.arc(-r * 0.4, r * 0.15, r * 0.5, 0, 7); ctx.arc(r * 0.15, -r * 0.15, r * 0.65, 0, 7); ctx.arc(r * 0.6, r * 0.25, r * 0.42, 0, 7); ctx.fill(); ctx.fillRect(-r * 0.4, r * 0.15, r * 1.0, r * 0.52); break;
    case 'bolt': ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 1.1); ctx.lineTo(-r * 0.6, r * 0.15); ctx.lineTo(0, r * 0.15); ctx.lineTo(-r * 0.2, r * 1.1); ctx.lineTo(r * 0.6, -r * 0.15); ctx.lineTo(0, -r * 0.15); ctx.fill(); break;
    case 'star': ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r * 1.05; ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.fill(); break;
    case 'cal': ctx.font = `600 ${s * 0.16}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(new Date().toLocaleDateString('en', { weekday: 'short' }).toUpperCase(), 0, -r * 0.85);
      ctx.fillStyle = '#111'; ctx.font = `300 ${s * 0.42}px ${FONT}`; ctx.fillText(String(new Date().getDate()), 0, r * 0.3); break;
    case 'wave': ctx.beginPath(); for (let i = -4; i <= 4; i++) { const h = (Math.cos(i * 0.9) * 0.5 + 0.6) * r; ctx.moveTo(i * r * 0.25, -h); ctx.lineTo(i * r * 0.25, h); } ctx.stroke(); break;
    case 'play': ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.75); ctx.lineTo(r * 0.8, 0); ctx.lineTo(-r * 0.5, r * 0.75); ctx.fill(); break;
    case 'leaf': ctx.beginPath(); ctx.ellipse(0, 0, r * 0.5, r, Math.PI / 5, 0, 7); ctx.fill(); break;
    case 'gear': ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, 7); ctx.lineWidth = s * 0.14; ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.fillRect(-r * 0.14, -r * 1.12, r * 0.28, r * 0.35); ctx.restore(); } break;
    case 'grid': for (let i = 0; i < 4; i++) { rr(ctx, (i % 2 ? 0.1 : -0.9) * r, (i > 1 ? 0.1 : -0.9) * r, r * 0.8, r * 0.8, r * 0.2); ctx.fill(); } break;
    case 'cam': rr(ctx, -r, -r * 0.6, r * 2, r * 1.4, r * 0.3); ctx.fill(); ctx.fillStyle = '#ff6b3d'; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.45, 0, 7); ctx.fill(); break;
    case 'map': ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.55, Math.PI, 0); ctx.lineTo(0, r * 0.9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2a9a95'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.22, 0, 7); ctx.fill(); break;
    case 'clock': ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.7); ctx.moveTo(0, 0); ctx.lineTo(r * 0.5, r * 0.15); ctx.stroke(); break;
  }
  ctx.restore();
}

function appIcon(ctx, x, y, s, i) {
  const [c0, c1, kind] = ICONS[i % ICONS.length];
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  rr(ctx, x, y, s, s, s * 0.23);
  ctx.fillStyle = g; ctx.fill();
  // liquid-glass rim highlight
  const hl = ctx.createLinearGradient(x, y, x, y + s * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.35)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  rr(ctx, x + 2, y + 2, s - 4, s * 0.5, s * 0.21);
  ctx.fillStyle = hl; ctx.fill();
  glyph(ctx, kind, x + s / 2, y + s / 2, s);
}

const LABELS = ['Weather', 'Messages', 'Compass', 'Music', 'Cloud', 'Power', 'Starred', 'Calendar', 'Podcasts', 'Videos', 'Garden', 'Settings', 'Apps', 'Camera', 'Maps', 'Clock'];

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
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
    }
    this.caught = 0;
    this._wpInner = this._makeWallpaper(INNER_W, INNER_H, 0);
    this._wpOuter = this._makeWallpaper(OUTER_W, OUTER_H, 3);
    this.draw();
  }

  _makeWallpaper(w, h, seed) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    wallpaper(c.getContext('2d'), w, h, seed);
    return c;
  }

  setCaught(n) { this.caught = n; this.drawInner(); }

  draw() { this.drawInner(); this.drawOuter(); }

  drawInner() {
    const ctx = this.inner.getContext('2d');
    const W = INNER_W, H = INNER_H, now = new Date();
    ctx.drawImage(this._wpInner, 0, 0);
    // In landscape-book layout the status bar spans the top
    statusBar(ctx, 64, 52, W - 128, 1.1, now);

    // ---- Left half: Today View widgets ----
    const L = 56, colW = W / 2 - 112;
    // big clock widget
    glass(ctx, L, 110, colW, 330, 54);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 34px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }), L + 44, 186);
    ctx.fillStyle = '#fff';
    ctx.font = `700 180px ${FONT}`;
    ctx.fillText(timeStr(now), L + 36, 380);

    // weather + fly counter row
    const half = (colW - 32) / 2;
    glass(ctx, L, 472, half, 330, 54);
    ctx.font = `600 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Living Room', L + 40, 538);
    ctx.font = `300 130px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText('23°', L + 34, 680);
    ctx.font = `500 32px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('1 fly detected', L + 40, 750);

    glass(ctx, L + half + 32, 472, half, 330, 54);
    const fx = L + half + 72;
    ctx.font = `600 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Swat Log', fx, 538);
    ctx.font = `700 150px ${FONT}`; ctx.fillStyle = '#ffd60a';
    ctx.fillText(String(this.caught), fx - 6, 700);
    ctx.font = `500 32px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(this.caught === 1 ? 'fly today' : 'flies today', fx, 750);

    // calendar widget
    glass(ctx, L, 834, colW, 300, 54);
    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#ff453a';
    ctx.fillText('UP NEXT', L + 44, 900);
    ctx.font = `600 50px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText('Open a window', L + 44, 972);
    ctx.font = `500 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Today · whenever the fly gives up', L + 44, 1028);
    rr(ctx, L + 30, 930, 8, 110, 4); ctx.fillStyle = '#ff453a'; ctx.fill();

    // page dots
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(W / 4 - 14, H - 70, 8, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(W / 4 + 14, H - 70, 8, 0, 7); ctx.fill();

    // ---- Right half: Home Screen grid + side dock ----
    const gx = W / 2 + 70, gy = 130, s = 150, cols = 4, rows = 4;
    const dockW = 190, gridW = W - gx - dockW - 70;
    const stepX = (gridW - s) / (cols - 1), stepY = 260;
    ctx.textAlign = 'center';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = gx + c * stepX, y = gy + r * stepY;
      appIcon(ctx, x, y, s, i);
      ctx.font = `500 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(LABELS[i], x + s / 2, y + s + 42);
    }
    // vertical dock on the right edge
    const dx = W - dockW - 40, dy = 150, dh = H - 300;
    glass(ctx, dx, dy, dockW, dh, 70);
    for (let i = 0; i < 4; i++) appIcon(ctx, dx + (dockW - 140) / 2, dy + 50 + i * ((dh - 240) / 3), 140, [1, 2, 13, 3][i]);

    this.innerTex.needsUpdate = true;
  }

  drawOuter() {
    const ctx = this.outer.getContext('2d');
    const W = OUTER_W, H = OUTER_H, now = new Date();
    ctx.drawImage(this._wpOuter, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `600 44px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }), W / 2, 270);
    ctx.fillStyle = '#fff';
    ctx.font = `700 290px ${FONT}`;
    ctx.fillText(timeStr(now), W / 2, 540);
    // notification
    glass(ctx, 60, H - 520, W - 120, 170, 46);
    ctx.textAlign = 'left';
    appIcon(ctx, 92, H - 487, 104, 0);
    ctx.font = `600 38px ${FONT}`; ctx.fillStyle = '#fff';
    ctx.fillText('Weather', 226, H - 438);
    ctx.font = `500 34px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Warm today. Flies are out.', 226, H - 390);
    // bottom hint bar
    rr(ctx, W / 2 - 150, H - 48, 300, 12, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    this.outerTex.needsUpdate = true;
  }
}
