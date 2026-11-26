// Fetches what Wikidata and the Chinese Wikipedia say about each substance
// in Chinese: its labels and other names in each Chinese variant, and the
// opening of its zh.wikipedia article as Wikipedia itself writes it for
// Taiwan (variant=zh-tw, phrase by phrase, not character by character),
// with the article's title in each variant.
//
//   node scripts/fetch-zh.mjs     writes scripts/data/zh-wiki.json
//
// scripts/zh-data.mjs then puts it into public/data. Wikidata is CC0;
// Wikipedia's text is CC BY-SA, and each page links back to its article.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUBS = path.join(ROOT, 'public/data/substances');
const OUT = path.join(ROOT, 'scripts/data/zh-wiki.json');
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const SPARQL = 'https://query.wikidata.org/sparql';
const VARIANTS = ['zh-tw', 'zh-hk', 'zh-hant', 'zh', 'zh-hans', 'zh-cn'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function fetchRetry(url, init = {}, tries = 6) {
    for (let k = 0; k < tries; k++) {
        try {
            const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
            if (res.status === 429 || res.status >= 500) {
                await sleep(Number(res.headers.get('retry-after')) * 1000 || 3000 * (k + 1));
                continue;
            }
            return res;
        } catch {
            await sleep(3000 * (k + 1));
        }
    }
    throw new Error(`gave up on ${url.slice(0, 120)}`);
}

async function sparql(query) {
    const res = await fetchRetry(SPARQL, {
        method: 'POST',
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `query=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`SPARQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    await sleep(400);
    return json.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { v: v.value, l: v['xml:lang'] }])));
}

/* Which Wikidata item each substance is: the one sync-wikidata.mjs linked,
   or, for a substance it couldn't link (Cannabis, Cocaine, MDMA and 160-odd
   more), the item behind its English Wikipedia article of the same name. */
const qids = [];
const byId = {};
const unlinked = [];
for (const f of await fs.readdir(SUBS)) {
    const d = JSON.parse(await fs.readFile(path.join(SUBS, f), 'utf8'));
    if (d.wikidata) {
        qids.push(d.wikidata);
        byId[d.id] = d.wikidata;
    } else if (d.name) unlinked.push({ id: d.id, name: d.name });
}

/** Each title's Wikidata item on the English Wikipedia, redirects followed. */
async function itemsForTitles(titles) {
    const found = {};
    for (const part of chunks(titles, 40)) {
        const url =
            `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
            `&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(part.join('|'))}`;
        const json = await (await fetchRetry(url)).json();
        const back = new Map();
        for (const r of json.query?.redirects ?? []) back.set(r.to, r.from);
        for (const r of json.query?.normalized ?? []) back.set(r.to, r.from);
        for (const p of json.query?.pages ?? []) {
            let t = p.title;
            while (back.has(t)) t = back.get(t);
            const q = p.pageprops?.wikibase_item;
            if (q) found[t] = q;
        }
        await sleep(600);
    }
    return found;
}

if (unlinked.length) {
    // "Datura (botany)" is asked for as "Datura": the catalogue's own titles.
    const titles = [...new Set(unlinked.map(u => u.name.replace(/\s*\([^()]*\)\s*$/, '')))];
    const found = await itemsForTitles(titles);
    for (const u of unlinked) {
        const q = found[u.name.replace(/\s*\([^()]*\)\s*$/, '')];
        if (q) {
            byId[u.id] = q;
            qids.push(q);
        }
    }
    console.log(`${unlinked.length} substances had no Wikidata item; ${unlinked.filter(u => byId[u.id]).length} were found by their Wikipedia article`);
}

const wanted = [...new Set(qids)];
console.log(`${wanted.length} Wikidata items`);

/** QID → { labels: {variant: name}, aliases: {variant: [names]}, zhwiki } */
const items = {};
const langs = VARIANTS.map(v => `"${v}"`).join(',');
for (const [i, part] of chunks(wanted, 150).entries()) {
    const values = part.map(q => `wd:${q}`).join(' ');
    const rows = await sparql(`SELECT ?item ?label ?alias ?zhwiki WHERE {
      VALUES ?item { ${values} }
      { ?item rdfs:label ?label FILTER(LANG(?label) IN (${langs})) }
      UNION { ?item skos:altLabel ?alias FILTER(LANG(?alias) IN (${langs})) }
      UNION { ?a schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> ; schema:name ?zhwiki } }`);
    for (const r of rows) {
        const q = r.item.v.slice(r.item.v.lastIndexOf('/') + 1);
        const it = (items[q] ??= { labels: {}, aliases: {} });
        if (r.label) it.labels[r.label.l] = r.label.v;
        if (r.alias) (it.aliases[r.alias.l] ??= []).push(r.alias.v);
        if (r.zhwiki) it.zhwiki = r.zhwiki.v;
    }
    process.stdout.write(`\rWikidata ${Math.min((i + 1) * 150, wanted.length)}/${wanted.length}`);
}
console.log();

/* zh.wikipedia: the opening as Taiwan reads it, and the title in each variant. */
const titles = [...new Set(Object.values(items).map(it => it.zhwiki).filter(Boolean))];
const wiki = {};
for (const [i, part] of chunks(titles, 20).entries()) {
    for (const variant of ['zh-tw', 'zh-hk', 'zh-cn']) {
        const url =
            `https://zh.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
            `&prop=extracts|info&inprop=varianttitles&exintro=1&explaintext=1&exlimit=20&redirects=1` +
            `&variant=${variant}&titles=${encodeURIComponent(part.join('|'))}`;
        const json = await (await fetchRetry(url)).json();
        const back = new Map();
        for (const r of json.query?.redirects ?? []) back.set(r.to, r.from);
        for (const r of json.query?.normalized ?? []) back.set(r.to, r.from);
        for (const p of json.query?.pages ?? []) {
            let t = p.title;
            while (back.has(t)) t = back.get(t);
            const w = (wiki[t] ??= {});
            w.titles ??= p.varianttitles;
            if (p.extract) w[variant] = p.extract;
        }
        await sleep(600);
    }
    process.stdout.write(`\rzh.wikipedia ${Math.min((i + 1) * 20, titles.length)}/${titles.length}`);
}
console.log();

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({ fetched: new Date().toISOString(), byId, items, wiki }));
console.log(`wrote ${path.relative(ROOT, OUT)}: ${Object.keys(items).length} items, ${Object.keys(wiki).length} articles`);
