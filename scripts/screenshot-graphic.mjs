// Renders a featured-graphic mockup HTML to an exact 1024x500 PNG via headless Chromium.
// Usage:  node scripts/screenshot-graphic.mjs [variant]   (default: v1)
//
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const variant = process.argv[2] || 'v1';

const htmlPath = join(root, 'public', 'mockups', `featured-graphic-${variant}.html`);
const outPath = join(root, `feature-graphic.png`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1024, height: 500 },
  deviceScaleFactor: 1,
});

await page.goto('file://' + htmlPath);
await page.waitForLoadState('networkidle');
// Make sure web fonts (Inter) are fully loaded before capturing
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const el = await page.$('.canvas');
if (!el) throw new Error('.canvas element not found in ' + htmlPath);
await el.screenshot({ path: outPath });

await browser.close();
console.log(`Saved ${outPath} (variant ${variant})`);
