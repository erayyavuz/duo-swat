// usage: node seq.mjs <url> <outprefix> <setupJs> <t0,t1,...ms after setup> [actionJs] [actionAtMs] [w] [h]
import puppeteer from 'puppeteer-core';
const [url, prefix, setup, times, action, actionAt = '0', w = '1000', h = '640'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3500));
if (setup) { const r = await page.evaluate(setup); if (r !== undefined) logs.push('[setup] ' + JSON.stringify(r)); }
const t0 = Date.now();
let acted = !action;
for (const [i, t] of times.split(',').map(Number).entries()) {
  while (Date.now() - t0 < t) {
    if (!acted && Date.now() - t0 >= +actionAt) { const r = await page.evaluate(action); if (r !== undefined) logs.push('[action] ' + JSON.stringify(r)); acted = true; }
    await new Promise(r => setTimeout(r, 2));
  }
  await page.screenshot({ path: `${prefix}${i}.png` });
}
console.log(logs.filter(l => !l.includes('404')).join('\n'));
await browser.close();
