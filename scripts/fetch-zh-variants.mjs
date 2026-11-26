// Writes every Chinese name scripts/fetch-zh.mjs found in Taiwan's and in
// mainland China's writing, as the Chinese Wikipedia itself converts it
// (its converter knows that 氯胺酮 is 愷他命 in Taiwan, which no
// character-by-character table does).
//
//   node scripts/fetch-zh-variants.mjs    writes scripts/data/zh-variants.json
//
// Run after fetch-zh.mjs and before zh-data.mjs, which uses both.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'scripts/data/zh-wiki.json');
const OUT = path.join(ROOT, 'scripts/data/zh-variants.json');
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const API = 'https://zh.wikipedia.org/w/api.php';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const { items } = JSON.parse(await fs.readFile(IN, 'utf8'));
const names = new Set();
for (const it of Object.values(items)) {
    for (const n of Object.values(it.labels)) names.add(n);
    for (const list of Object.values(it.aliases)) for (const n of list) names.add(n);
    if (it.zhwiki) names.add(it.zhwiki);
}
const all = [...names].filter(n => /[㐀-鿿]/.test(n) && !/[\n<>[\]{}|]/.test(n));
console.log(`${all.length} names to convert`);

/** One conversion request, waiting out a rate limit (429) or a server
 *  error the way fetch-zh.mjs does rather than giving up on the first one. */
async function post(body, tries = 6) {
    for (let k = 0; k < tries; k++) {
        let res;
        try {
            res = await fetch(API, {
                method: 'POST',
                headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
        } catch (e) {
            if (k === tries - 1) throw e;
            await sleep(5000 * (k + 1));
            continue;
        }
        if (res.status === 429 || res.status >= 500) {
            await sleep(Number(res.headers.get('retry-after')) * 1000 || 5000 * (k + 1));
            continue;
        }
        // Anything else is our own mistake, not a passing one: say so now.
        if (!res.ok) throw new Error(`parse ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return res;
    }
    throw new Error('parse: gave up after being rate-limited');
}

/** Wikipedia's own conversion of each line into one variant, in order. */
async function convert(lines, variant) {
    const body = new URLSearchParams({
        action: 'parse',
        format: 'json',
        formatversion: '2',
        contentmodel: 'wikitext',
        prop: 'text',
        disablelimitreport: '1',
        wrapoutputclass: '',
        variant,
        // One line each, so the answer's paragraphs line up with the input.
        text: lines.join('\n\n'),
    });
    const html = (await (await post(body)).json()).parse?.text ?? '';
    const out = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m =>
        m[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim(),
    );
    if (out.length !== lines.length) throw new Error(`asked for ${lines.length} lines, got ${out.length}`);
    return out;
}

const tw = {};
const cn = {};
const parts = chunks(all, 100);
for (const [i, part] of parts.entries()) {
    // One at a time: two at once is enough for zh.wikipedia to rate-limit us.
    const t = await convert(part, 'zh-tw');
    await sleep(800);
    const c = await convert(part, 'zh-cn');
    part.forEach((n, k) => {
        if (t[k] && t[k] !== n) tw[n] = t[k];
        if (c[k] && c[k] !== n) cn[n] = c[k];
    });
    process.stdout.write(`\r${Math.min((i + 1) * 100, all.length)}/${all.length}`);
    await sleep(800);
}
console.log();

await fs.writeFile(OUT, JSON.stringify({ fetched: new Date().toISOString(), tw, cn }));
console.log(`wrote ${path.relative(ROOT, OUT)}: ${Object.keys(tw).length} differ in Taiwan's writing, ${Object.keys(cn).length} in the mainland's`);
