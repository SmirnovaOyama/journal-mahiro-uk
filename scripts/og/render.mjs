// Draws the link preview cards into public/og/:
//   site.png              the home page and the pages without their own card
//   s/<id>.png            one per substance
//   mix/<verdict>.png     one per answer the mix checker can give
//
//   npm run og                    everything
//   npm run og -- --only=lsd,mdma just those substances (and the rest)
//
// The words come from src/lib/preview.ts, the same helpers the Worker uses
// for the text under the card, bundled here with esbuild so this script can
// use the app's TypeScript as it is. Rendered in Chromium (Playwright) from
// scripts/og/card.html. Run it on a Mac, so the type is SF Pro and PingFang.

import { build } from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { readStructures } from '../lib/structures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/og');
const only = (process.argv.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);

// ── the app's own helpers, bundled for Node ──
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'og-'));
const entry = path.join(tmp, 'entry.ts');
await fs.writeFile(
    entry,
    [
        `export * from ${JSON.stringify(path.join(ROOT, 'src/lib/preview.ts'))};`,
        `export { describe, squash } from ${JSON.stringify(path.join(ROOT, 'src/lib/data.ts'))};`,
        `export { VERDICT } from ${JSON.stringify(path.join(ROOT, 'src/lib/mix.ts'))};`,
        `export { GLYPHS } from ${JSON.stringify(path.join(ROOT, 'src/components/icons/glyphs.ts'))};`,
        `export { molToSvg } from ${JSON.stringify(path.join(ROOT, 'src/lib/molsvg.ts'))};`,
    ].join('\n'),
);
const libFile = path.join(tmp, 'lib.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: libFile, logLevel: 'error' });
const lib = await import(pathToFileURL(libFile).href);

const readJson = async p => JSON.parse(await fs.readFile(path.join(ROOT, p), 'utf8'));
const index = await readJson('public/data/index.json');
const structures = await readStructures(ROOT);

const host = lib.SITE.host;

/** A substance's skeletal formula as SVG markup, drawn as the site draws it;
 *  none for a lone atom (lithium), which keeps the capsule as on the site. */
function moleculeMarkup(id) {
    const s = structures[id];
    if (!s) return null;
    const svg = lib.molToSvg(s);
    return /<line|<polygon/.test(svg) ? svg : null;
}

/** What the drawing is of, when it isn't the substance itself (as the page says it). */
function drawnCaption(id) {
    const s = structures[id];
    if (!s || s.role === 'self') return null;
    return (
        { active: `${s.name}, its active compound`, core: `${s.name}, the family’s parent structure`, example: `${s.name}, its best-known member` }[
            s.role
        ] ?? null
    );
}

/** The clover glyph as SVG markup, for the low-risk cards. */
function cloverMarkup() {
    return lib.GLYPHS.clover
        .map(s =>
            typeof s === 'string'
                ? `<path d="${s}"/>`
                : s.tint
                  ? `<path d="${s.d}" fill="currentColor" fill-opacity="0.28" stroke="none"/>`
                  : `<path d="${s.d}" stroke-width="0.6"/>`,
        )
        .join('');
}

// ── draw ──
await fs.mkdir(path.join(OUT, 's'), { recursive: true });
await fs.mkdir(path.join(OUT, 'mix'), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(ROOT, 'scripts/og/card.html')).href);
await page.evaluate('document.fonts.ready');

async function shoot(kind, data, file) {
    await page.evaluate(([k, d]) => window.draw(k, d), [kind, data]);
    await page.screenshot({ path: file, type: 'png' });
}

// The site's card: LSD drawn large, as the substances' cards are.
await shoot(
    'site',
    {
        host,
        name: lib.SITE.name,
        kind: `${lib.SITE.tagline}, for ${index.length.toLocaleString('en')} substances`,
        molecule: moleculeMarkup('lsd'),
    },
    path.join(OUT, 'site.png'),
);

// One card per answer the mix checker gives.
const TONE = {
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--info)',
    positive: 'var(--positive)',
    neutral: 'var(--text-muted)',
};
const clover = cloverMarkup();
for (const [verdict, v] of Object.entries(lib.VERDICT)) {
    await shoot(
        'mix',
        {
            host,
            word: v.label,
            meaning: v.meaning,
            color: TONE[v.tone],
            clover: v.tone === 'positive' ? clover : '',
        },
        path.join(OUT, lib.verdictCard(verdict).replace(/^\/og\//, '')),
    );
}

// One card per substance.
let n = 0;
for (const e of index) {
    if (only.length && !only.includes(e.id)) continue;
    const d = await readJson(`public/data/substances/${e.id}.json`).catch(() => null);
    if (!d) continue;
    await shoot(
        'substance',
        {
            host,
            name: d.name,
            kind: lib.kindLine(d, e),
            molecule: moleculeMarkup(e.id),
            drawn: drawnCaption(e.id),
        },
        path.join(OUT, 's', `${e.id}.png`),
    );
    if (++n % 50 === 0) process.stdout.write(`${n} substance cards\n`);
}

await browser.close();
await fs.rm(tmp, { recursive: true, force: true });
console.log(`done: the site card, ${Object.keys(lib.VERDICT).length} mix cards and ${n} substance cards in public/og`);
