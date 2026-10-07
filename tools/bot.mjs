import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8765/', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));
const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
console.log('fps', fps);
const res = await page.evaluate(async (lag) => {
  const A = __app; const out = [];
  for (let i = 0; i < 12; i++) {
    // wait for open + fly flying
    while (!(A.game.mode === 'open' && A.fly.flying)) await new Promise(r => setTimeout(r, 50));
    // track the fly for 1.2s
    const t0 = performance.now();
    while (performance.now() - t0 < 1200) { A.aim.target.set(A.fly.pos.x, A.fly.pos.y, 0); await new Promise(r => setTimeout(r, 16)); }
    const before = A.game.caught;
    const w = A.phone.wedgeInfo(A.fly.pos);
    const info = `${w.inside?'IN':'out'} r=${w.r.toFixed(0)} phi=${(w.phi*57.3).toFixed(0)} y=${w.y.toFixed(0)}`;
    A.snap();
    const react = A.fly.reactAt;
    await new Promise(r => setTimeout(r, 400));
    out.push((A.game.caught > before ? 'C ' : 'm ') + info + ' react=' + (react===undefined?'-':react.toFixed(2)));
    await new Promise(r => setTimeout(r, 2200));
  }
  return out.join('\n');
}, 0);
console.log('results', res);
await browser.close();
