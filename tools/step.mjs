// usage: node step.mjs <url> <outprefix> <setupJs> <actionJs> <stepMs> <n> [w] [h]
import puppeteer from 'puppeteer-core';
const [url, prefix, setup, action, stepMs, n, w = '900', h = '600'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3500));
if (setup) await page.evaluate(setup);
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => { __app.game.manualDt = 0; });
await new Promise(r => setTimeout(r, 100));
if (action) await page.evaluate(action);
for (let i = 0; i < +n; i++) {
  await page.evaluate((d) => { __app.game.manualDt = d; }, +stepMs / 1000);
  await new Promise(r => setTimeout(r, 120));
  await page.screenshot({ path: `${prefix}${i}.png` });
}
await browser.close();
