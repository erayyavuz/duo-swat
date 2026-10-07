import puppeteer from 'puppeteer-core';
import fs from 'fs';
const js = fs.readFileSync('fitgrip.js', 'utf8');
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 480 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8765/?a=118&rx=0&ry=0', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));
await page.evaluate((v) => { window.__ref = JSON.parse(v); }, process.argv[3]);
let out;
for (let i = 0; i < +(process.argv[2] ?? 3); i++) { out = await page.evaluate(js); console.log(JSON.stringify(out)); }
await browser.close();
