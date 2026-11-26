// Puts what scripts/fetch-zh.mjs fetched into public/data: each substance's
// name in 正體中文, the other names people search for it by (in Taiwan's,
// Hong Kong's and mainland China's writing, so a search in either script
// finds it), and the opening of its zh.wikipedia article as Wikipedia
// writes it for Taiwan.
//
//   node scripts/zh-data.mjs
//
// index.json entries gain `zh` (the name) and `zhAliases`; a substance's
// file gains `zh`, `summaryZh` and a link to its zh.wikipedia article.
// Run again after sync-wikidata.mjs, which takes them out.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'public/data');
const SUBS = path.join(DATA, 'substances');
const { items, wiki } = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/data/zh-wiki.json'), 'utf8'));

const CJK = /[㐀-鿿]/;
const cjkShare = s => [...s].filter(c => CJK.test(c)).length / Math.max(1, [...s].length);
// A title's disambiguation: "鴉片 (藥物)".
const bare = t => t?.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();

/** A name worth showing: mostly Chinese and short. A systematic name a
 *  line long ("3,4-亞甲二氧基甲基苯丙胺") reads worse than the catalogue's own. */
const showable = n => n && cjkShare(n) >= 0.5 && [...n].length <= 10 && !/[,，]/.test(n);
/** A name worth searching by: has Chinese in it at all. */
const searchable = n => n && CJK.test(n) && [...n].length <= 40;

/** An opening of up to about 160 characters, cut after a full sentence. */
function opening(text) {
    if (!text) return '';
    const para = text.split('\n').map(s => s.trim()).find(s => CJK.test(s)) ?? '';
    const clean = para
        .replace(/[（(][^（()）]*[）)]/g, m => (CJK.test(m) && m.length < 30 ? m : ''))
        .replace(/\s{2,}/g, ' ')
        .trim();
    const sentences = clean.match(/[^。！？]+[。！？]?/g) ?? [clean];
    let out = '';
    for (const s of sentences) {
        if (out && (out + s).length > 160) break;
        out += s;
    }
    return out.trim();
}

const index = JSON.parse(await fs.readFile(path.join(DATA, 'index.json'), 'utf8'));
let named = 0;
let summarised = 0;
for (const e of index) {
    delete e.zh;
    delete e.zhAliases;
    const file = path.join(SUBS, `${e.id}.json`);
    let d;
    try {
        d = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        continue;
    }
    delete d.zh;
    delete d.summaryZh;
    d.helpfulLinks = (d.helpfulLinks ?? []).filter(l => !/zh\.wikipedia\.org/.test(l.url));
    const it = d.wikidata && items[d.wikidata];
    if (it) {
        const w = it.zhwiki ? wiki[it.zhwiki] : undefined;
        const t = w?.titles ?? {};
        const L = it.labels;
        // Taiwan's name first, then Hong Kong's, then any traditional one.
        const name = [L['zh-tw'], bare(t['zh-tw']), L['zh-hant'], L['zh-hk'], bare(t['zh-hk'])].find(showable);
        // An acronym or a code ("LSD", "2C-B", "MDMA") is what people call it here too.
        const keepLatin = /^[A-Z0-9αβγ][A-Za-z0-9αβγ,()\-]{0,9}$/.test(e.name) && /[A-Z0-9]{2}/.test(e.name);
        if (name && !keepLatin) {
            e.zh = d.zh = name;
            named++;
        }
        const all = new Set(
            [
                ...Object.values(L),
                ...Object.values(t).map(bare),
                ...Object.values(it.aliases).flat(),
            ].filter(searchable),
        );
        if (e.zh) all.delete(e.zh);
        if (all.size) e.zhAliases = [...all].join(', ');
        const summary = opening(w?.['zh-tw']);
        if (summary) {
            d.summaryZh = summary;
            summarised++;
        }
        if (it.zhwiki)
            d.helpfulLinks.push({
                title: '維基百科',
                description: 'zh:Encyclopedia article',
                url: `https://zh.wikipedia.org/zh-tw/${encodeURIComponent(it.zhwiki.replace(/ /g, '_'))}`,
            });
    }
    await fs.writeFile(file, JSON.stringify(d));
}
await fs.writeFile(path.join(DATA, 'index.json'), JSON.stringify(index));
console.log(`${named} names, ${index.filter(e => e.zhAliases).length} with Chinese names to search by, ${summarised} openings`);
