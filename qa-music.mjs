import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.addInitScript(() => {
  window.__osc = 0; window.__gainSets = 0;
  const orig = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function(...a) { window.__osc++; return orig.apply(this, a); };
});
await page.goto('http://127.0.0.1:4174/', { waitUntil: 'networkidle' });
const before = await page.evaluate(()=>window.__osc);
await page.click('.title-stage');
await page.waitForTimeout(3000);
const after = await page.evaluate(()=>window.__osc);
console.log('oscillators before click:', before, 'after 3s:', after);
await browser.close();
