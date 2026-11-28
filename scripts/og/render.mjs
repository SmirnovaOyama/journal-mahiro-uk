// Draws the link preview cards into public/og/:
//   site.png              the home page and the pages without their own card
//   s/<id>.png            one per substance, and 寻寻's in each language it speaks
//   mix/<verdict>.png     one per answer the mix checker can give
//   report/<id>.png       one per report that closes on a wish
//
//   npm run og                    everything
//   npm run og -- --only=lsd,mdma just those substances (and the rest)
//   npm run og -- --out=<folder>  into another folder, to look before it's live
//   npm run og -- --strict        fail if any substance's card is listed (below)
//
// Every substance's card is measured as it is drawn: a name cut short, a
// line run into the foot or a drawing left no room is listed at the end.
// The catalogue is three thousand names nobody reads one by one; this
// reads them. A listed card is still drawn, cut with an ellipsis, so a
// deploy goes on with it: --strict is for checking by hand.
//
// The words come from src/lib/preview.ts, the same helpers the Worker uses
// for the text under the card, bundled here with esbuild so this script can
// use the app's TypeScript as it is. Each card is an SVG (card.mjs) that
// resvg draws, in the fonts kept in scripts/og/fonts: no browser and no
// font of the machine's, so the cards are the same wherever this runs.
// Cloudflare's build runs it on every push (vite.config.ts), as does
// `npm run deploy`.

import { Resvg } from '@resvg/resvg-js';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readStructures } from '../lib/structures.mjs';
import * as card from './card.mjs';
import { missing } from './type.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = name => (process.argv.find(a => a.startsWith(`--${name}=`)) ?? '').slice(name.length + 3);
const OUT = arg('out') ? path.resolve(arg('out')) : path.join(ROOT, 'public/og');
const only = arg('only').split(',').filter(Boolean);

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
        `export { speak } from ${JSON.stringify(path.join(ROOT, 'src/lib/i18n.ts'))};`,
        `export { PICTURES, XUNXUN_ID, xunxunName, xunxunWhat } from ${JSON.stringify(path.join(ROOT, 'src/lib/xunxun.ts'))};`,
        // The doodle of a dosage form, as the site draws it where there is no structure.
        `import { createElement } from 'react';`,
        `import { renderToStaticMarkup } from 'react-dom/server';`,
        `import { FormDoodle } from ${JSON.stringify(path.join(ROOT, 'src/components/doodles/index.tsx'))};`,
        `export const formDoodle = form => renderToStaticMarkup(createElement(FormDoodle, { form }));`,
    ].join('\n'),
);
const libFile = path.join(tmp, 'lib.mjs');
await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: libFile,
    logLevel: 'error',
    nodePaths: [path.join(ROOT, 'node_modules')],
    // react-dom's server build is CommonJS and asks for Node's own modules.
    banner: { js: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);` },
});
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

/** A picture as the address an SVG holds it by. resvg reads PNG, JPEG and
 *  GIF; a picture kept as anything else (WebP) needs a PNG of the same name
 *  in scripts/og/pictures, and the run stops if there is none: a card with
 *  a hole where its picture goes must not be drawn. */
async function embed(file) {
    let bytes = await fs.readFile(file);
    const kind = b => (b[0] === 0x89 && b[1] === 0x50 ? 'png' : b[0] === 0xff && b[1] === 0xd8 ? 'jpeg' : b[0] === 0x47 && b[1] === 0x49 ? 'gif' : null);
    if (!kind(bytes)) {
        const png = path.join(ROOT, 'scripts/og/pictures', `${path.basename(file, path.extname(file))}.png`);
        bytes = await fs.readFile(png).catch(() => {
            throw new Error(`${path.relative(ROOT, file)} is not a PNG, JPEG or GIF, which is all the cards can hold: save a PNG of it as ${path.relative(ROOT, png)}`);
        });
    }
    return `data:image/${kind(bytes)};base64,${bytes.toString('base64')}`;
}
// The logo as scripts/icons.py cuts it for the cards: at the size it is drawn.
const logo = await embed(path.join(ROOT, 'scripts/og/pictures/logo.png'));

/** Draws a card and writes its picture; gives back how its name was set. */
async function shoot(kind, data, file) {
    const made = card[kind]({ host, logo, ...data });
    const png = new Resvg(made.svg, { font: { fontFiles: made.fonts, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng();
    await fs.writeFile(file, png);
    return made.set;
}

// The site's card: LSD drawn large, as the substances' cards are.
await shoot(
    'site',
    {
        name: lib.SITE.name,
        kind: `${lib.SITE.tagline}, for ${index.length.toLocaleString('en')} substances`,
        molecule: moleculeMarkup('lsd'),
    },
    path.join(OUT, 'site.png'),
);

// One card per answer the mix checker gives.
const TONE = {
    danger: card.INK.danger,
    warning: card.INK.warning,
    info: card.INK.info,
    positive: card.INK.positive,
    neutral: card.INK.muted,
};
const clover = cloverMarkup();
for (const [verdict, v] of Object.entries(lib.VERDICT)) {
    await shoot(
        'mix',
        {
            word: v.label,
            meaning: v.meaning,
            color: TONE[v.tone],
            clover: v.tone === 'positive' ? clover : '',
        },
        path.join(OUT, lib.verdictCard(verdict).replace(/^\/og\//, '')),
    );
}

// One card per report that closes on a wish: its picture and the wish. The
// picture is the report's own line drawing, or its closing picture if it has
// no drawing. The card cuts a drawing square about its middle; where that
// would slice through something (RP-74's blossom branches), a square cut by
// hand sits in scripts/og/report/<id>.png and is used instead.
// The wish's first line is the one it was written in, a clause to a line;
// the lines after it are its English.
await fs.mkdir(path.join(OUT, 'report'), { recursive: true });
let reports = 0;
for (const f of await fs.readdir(path.join(ROOT, 'public/data/reports'))) {
    if (!/^[^.]+\.json$/.test(f)) continue;
    const r = await readJson(`public/data/reports/${f}`);
    const wish = r.closing?.[0];
    const picture = r.picture ?? r.closingPicture;
    if (!wish?.length || !picture) continue;
    const cut = path.join(ROOT, 'scripts/og/report', `${r.id}.png`);
    const hasCut = !!r.picture && (await fs.access(cut).then(() => true, () => false));
    const file = hasCut ? cut : path.join(ROOT, 'public', picture.src);
    await shoot(
        'report',
        {
            picture: await embed(file),
            line: !!r.picture,
            wish: wish[0].split(/[，,]\s*/).filter(Boolean),
            verse: wish.slice(1),
        },
        path.join(OUT, 'report', `${r.id}.png`),
    );
    reports++;
}

// One card per substance. How each name was set is counted, and a card
// that doesn't hold what it should is kept for the list at the end.
let n = 0;
const set = {};
const wrong = [];
async function substance(id, data, file) {
    const how = await shoot('substance', data, path.join(OUT, 's', file));
    set[how.mode] = (set[how.mode] ?? 0) + 1;
    if (!how.ok) wrong.push(`${id} (${how.mode}, ${how.size}px, ${how.lines} line${how.lines > 1 ? 's' : ''}): ${data.name}`);
}
const doodles = {};
for (const e of index) {
    if (only.length && !only.includes(e.id)) continue;
    const d = await readJson(`public/data/substances/${e.id}.json`).catch(() => null);
    if (!d) continue;
    const molecule = moleculeMarkup(e.id);
    await substance(
        e.id,
        {
            name: d.name,
            kind: lib.kindLine(d, e),
            molecule,
            // No structure to draw: the form it comes in, as on its page.
            doodle: molecule ? null : (doodles[d.form] ??= lib.formDoodle(d.form)),
            drawn: drawnCaption(e.id),
        },
        `${e.id}.png`,
    );
    if (++n % 50 === 0) process.stdout.write(`${n} substance cards\n`);
}

// 寻寻, shared as a substance is (src/lib/xunxun.ts): its name, the line
// that says what it is, a clause to a line, and its picture where a
// structure is drawn. One language to a reader, so one card in each; the
// Worker picks (xunxunPreview in src/lib/preview.ts).
if (!only.length || only.includes(lib.XUNXUN_ID)) {
    for (const [lang, variant] of [['en', ''], ['zh-Hant', '.zh']]) {
        lib.speak(lang, null);
        await substance(
            lib.XUNXUN_ID,
            {
                name: lib.xunxunName(),
                kind: lib.xunxunWhat().split(/(?<=[，,])\s*/),
                picture: await embed(path.join(ROOT, 'public', lib.PICTURES[lib.XUNXUN_ID])),
                lang,
            },
            `${lib.XUNXUN_ID}${variant}.png`,
        );
        n++;
    }
    lib.speak('en', null);
}

await fs.rm(tmp, { recursive: true, force: true });
console.log(`done: the site card, ${Object.keys(lib.VERDICT).length} mix cards, ${reports} report cards and ${n} substance cards in ${path.relative(ROOT, OUT) || OUT}`);
console.log(
    `names set ${Object.entries(set)
        .map(([mode, count]) => `${mode}: ${count}`)
        .join(', ')}`,
);
if (missing.size) console.error(`letters no font here has, drawn as nothing: ${[...missing].join(' ')}`);
if (wrong.length) {
    console.error(`${wrong.length} card${wrong.length > 1 ? 's' : ''} that don’t hold their name or their line:\n  ${wrong.join('\n  ')}`);
    if (process.argv.includes('--strict')) process.exitCode = 1;
}
