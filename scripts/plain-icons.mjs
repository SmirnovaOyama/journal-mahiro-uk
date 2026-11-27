// Draws the plain icon (a grey page with three lines) at each size.
import { chromium } from 'playwright-core';
import path from 'node:path';

const out = process.argv[2] ?? "public";
const svg = size => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ecebe8"/>
  <rect x="136" y="104" width="240" height="304" rx="28" fill="#ffffff"/>
  <rect x="176" y="168" width="160" height="20" rx="10" fill="#8c8a85"/>
  <rect x="176" y="224" width="160" height="20" rx="10" fill="#b9b7b2"/>
  <rect x="176" y="280" width="104" height="20" rx="10" fill="#b9b7b2"/>
</svg>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
for (const size of [512, 192, 180, 64]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0">${svg(size)}</body>`);
    await page.screenshot({ path: path.join(out, `plain-${size}.png`), clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
