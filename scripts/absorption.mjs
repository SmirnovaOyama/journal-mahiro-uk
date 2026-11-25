// How much of a dose gets into the blood, by route: each dose row's
// `absorbed` ({ min, max } in percent, with where it's from).
//
// The rows used to carry a text field, `bioavailability`, that held a figure
// for 18 of them and, for the rest, the name of the source ("PsychonautWiki
// ladder", "TripSit reference"), which isn't a figure at all. This turns the
// figures into numbers, drops the source names (each row says its source
// already), keeps the odd note, and fills in what Wikipedia's drug infobox
// says, route by route, for the routes each substance documents.
//
// A Wikipedia figure is only taken with its route named ("Oral: 43–80%",
// "21–75% (intranasal)"). One with no route is taken only for a substance
// whose only documented route is oral, which is what such a figure means.
//
//   node scripts/absorption.mjs            fetch (cached) and write
//   node scripts/absorption.mjs --write    write from the cache only

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'public/data/substances');
const CACHE = path.join(ROOT, 'scripts/.cache/infobox-bioavailability.json');
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const offline = process.argv.includes('--write');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
    for (let k = 0; k < 5; k++) {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': UA } });
            if (res.status === 429 || res.status >= 500) {
                await sleep(2000 * (k + 1));
                continue;
            }
            return await res.json();
        } catch {
            await sleep(2000 * (k + 1));
        }
    }
    throw new Error(`gave up on ${url}`);
}

/* ── the routes, as the text names them ─────────────────────────────── */

const ROUTE_WORDS = [
    ['Oral', /\b(oral(ly)?|by mouth|per os|p\.?o\.?|ingest(ed|ion)?|swallowed)\b/i],
    ['Insufflated', /\b(intra-?nasal(ly)?|nasal(ly)?|insufflat(ed|ion)|snort(ed|ing)?)\b/i],
    ['Sublingual', /\b(sub-?lingual(ly)?|s\.?l\.?)\b/i],
    ['Buccal', /\bbuccal(ly)?\b/i],
    ['Rectal', /\b(rectal(ly)?|p\.?r\.?)\b/i],
    ['Intravenous', /\b(intra-?venous(ly)?|i\.?v\.?)\b/i],
    ['Intramuscular', /\b(intra-?muscular(ly)?|i\.?m\.?)\b/i],
    ['Subcutaneous', /\b(sub-?cutaneous(ly)?|s\.?c\.?|subq)\b/i],
    ['Transdermal', /\b(trans-?dermal(ly)?|topical(ly)?|skin|patch)\b/i],
    ['Smoked', /\b(smok(ed|ing)|inhal(ed|ation)|vapou?ri[sz]ed|vaping)\b/i],
];
/** A route the text names in a segment, and our name for it. */
const routesIn = text => ROUTE_WORDS.filter(([, re]) => re.test(text)).map(([name]) => name);

/** "43–80%", "~20 %", "20 to 40%", "<5%", "100%": [min, max]. A mean with
 *  its spread ("52.7 ± 20.4%") is the mean. */
function percentIn(text) {
    const pm = /(\d{1,3}(?:\.\d+)?)\s*±\s*\d{1,3}(?:\.\d+)?\s*%/.exec(text);
    if (pm) {
        const v = Number(pm[1]);
        return v > 0 && v <= 100 ? [v, v] : null;
    }
    // "<35%", "–90%" (an upper bound with no lower one), "up to 90%".
    const upTo = /(?:^|[^\d.])(?:<|≤|up to|–|-)\s*(\d{1,3}(?:\.\d+)?)\s*%/i.exec(text);
    const m = /(?:[~≈<>]\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:%\s*)?(?:[–—-]|to)\s*(\d{1,3}(?:\.\d+)?)\s*%|(?:[~≈<>]\s*)?(\d{1,3}(?:\.\d+)?)\s*%/.exec(text);
    if (!m) return null;
    if (!m[2] && upTo && Number(upTo[1]) === Number(m[3])) {
        const v = Number(upTo[1]);
        return v > 0 && v <= 100 ? [0, v] : null;
    }
    let lo = Number(m[1] ?? m[3]);
    let hi = Number(m[2] ?? m[3]);
    if (lo > hi) [lo, hi] = [hi, lo];
    if (!(hi > 0 && hi <= 100 && lo >= 0)) return null;
    return [lo, hi];
}

/** The infobox's bioavailability field, as it's written. */
function rawField(wikitext) {
    const m = /\|\s*bioavailability\s*=([\s\S]*?)(?=\n\s*\||\n\s*\}\})/i.exec(wikitext);
    return m ? m[1] : '';
}

/** Figures measured in animals, or in a dish, say nothing about people. */
const NOT_PEOPLE = /\b(rats?|mice|mouse|dogs?|monkeys?|primates?|animals?|rabbits?|horses?|pigs?|in vitro)\b/i;

/** The field as plain text, in segments, one figure each where it can. */
function bioField(raw) {
    let t = raw;
    t = t.replace(/<!--[\s\S]*?-->/g, '');
    // Dashes and spaces written as templates, before templates go.
    t = t.replace(/\{\{\s*(?:ndash|snd|spaced ndash|mdash|endash|–)\s*\}\}/gi, '–').replace(/\{\{\s*(?:nbsp|thinsp)\s*\}\}/gi, ' ');
    t = t.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
    // {{abbr|IV|intravenous}} and the like: keep what's read.
    for (let k = 0; k < 4; k++) t = t.replace(/\{\{\s*(?:abbr|abbrlink|nowrap|small)\s*\|([^{}|]*)(?:\|[^{}]*)?\}\}/gi, '$1');
    for (let k = 0; k < 4; k++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
    t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
    t = t.replace(/'''?/g, '').replace(/&nbsp;/g, ' ');
    return t
        .split(/<br\s*\/?>|\n|;|\*|,(?=\s*[A-Za-z][A-Za-z .-]*:)/i)
        .map(s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        // "<35% (by mouth), 44–61% (inhalation)": one figure a segment.
        .flatMap(s => ((s.match(/%/g) ?? []).length > 1 ? s.split(/,\s*/) : [s]))
        .filter(s => s && !NOT_PEOPLE.test(s));
}

/** What the field says for each route, as [min, max]. */
function figuresFor(segments, onlyOral) {
    const out = {};
    for (const seg of segments) {
        const pct = percentIn(seg);
        if (!pct) continue;
        const named = routesIn(seg);
        if (named.length === 1) out[named[0]] ??= pct;
        else if (named.length === 0 && onlyOral && segments.length === 1) out.Oral ??= pct;
    }
    return out;
}

/* ── what's there now ───────────────────────────────────────────────── */

const SOURCE_NAMES = new Set(['PsychonautWiki ladder', 'TripSit reference']);

/** The old text field, as a figure or a note. */
function fromOld(row) {
    const b = row.bioavailability;
    delete row.bioavailability;
    if (!b || SOURCE_NAMES.has(b)) return;
    const m = /^Bioavailability\s+(.*)$/.exec(b);
    const pct = m && percentIn(m[1]);
    if (pct) {
        const note = m[1].replace(/^[~≈<>–-]?\s*[\d.]+\s*(?:%\s*)?(?:[–—-]\s*[\d.]+\s*)?%\s*/, '').replace(/^\(|\)$/g, '').trim();
        row.absorbed = { min: pct[0], max: pct[1], source: row.source ?? 'PsychonautWiki', ...(note ? { note } : {}) };
    } else row.note = b;
}

const files = (await fs.readdir(DIR)).filter(f => f.endsWith('.json'));
const all = [];
for (const f of files) {
    const text = await fs.readFile(path.join(DIR, f), 'utf8');
    all.push({ f, d: JSON.parse(text) });
}

for (const { d } of all)
    for (const r of d.doseRows ?? []) {
        if ('bioavailability' in r) fromOld(r);
        // Wikipedia's figures are worked out afresh each run.
        if (r.absorbed?.source === 'Wikipedia') delete r.absorbed;
    }

/* ── Wikipedia ──────────────────────────────────────────────────────── */

let cache = {};
try {
    cache = JSON.parse(await fs.readFile(CACHE, 'utf8'));
} catch {
    /* first run */
}

const wanted = all.filter(({ d }) => d.wikidata && d.doseRows?.length && typeof cache[d.wikidata]?.raw !== 'string');
if (!offline && wanted.length) {
    console.log(`Fetching infoboxes for ${wanted.length} substances…`);
    // Their English Wikipedia pages, from Wikidata.
    const titles = {};
    for (let i = 0; i < wanted.length; i += 50) {
        const ids = wanted.slice(i, i + 50).map(({ d }) => d.wikidata);
        const r = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=sitelinks&sitefilter=enwiki&format=json`);
        for (const id of ids) titles[id] = r.entities?.[id]?.sitelinks?.enwiki?.title ?? null;
        await sleep(600);
    }
    // Their wikitext, fifty pages at a time.
    const byTitle = Object.entries(titles).filter(([, t]) => t);
    for (let i = 0; i < byTitle.length; i += 50) {
        const chunk = byTitle.slice(i, i + 50);
        const q = chunk.map(([, t]) => encodeURIComponent(t)).join('|');
        const r = await get(`https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles=${q}`);
        const redirect = Object.fromEntries((r.query?.redirects ?? []).map(x => [x.to, x.from]));
        const norm = Object.fromEntries((r.query?.normalized ?? []).map(x => [x.to, x.from]));
        const text = {};
        for (const p of r.query?.pages ?? []) {
            const t = p.title;
            const from = redirect[t] ?? t;
            text[norm[from] ?? from] = p.revisions?.[0]?.slots?.main?.content ?? '';
        }
        for (const [id, t] of chunk) cache[id] = { title: t, raw: rawField(text[t] ?? '') };
        await sleep(1200);
    }
    for (const [id, t] of Object.entries(titles)) if (!t) cache[id] = { title: null, raw: '' };
    await fs.writeFile(CACHE, JSON.stringify(cache));
}

/* ── put together ───────────────────────────────────────────────────── */

let filled = 0;
let kept = 0;
const report = [];
/** The page is about this substance, not a relative it's linked to
 *  (Ketamine to Esketamine, say): one of its names is one of the page's, or
 *  of the Wikidata item's (GHB is γ-hydroxybutyric acid's own alias). */
const plain = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
let wd = {};
for (const f of ['existing-details.json', 'details.json'])
    try {
        Object.assign(wd, JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/.cache', f), 'utf8')));
    } catch {
        /* not fetched */
    }
function samePage(d, title) {
    if (!title) return false;
    const ours = new Set([d.name, ...String(d.aliases ?? '').split(/[,;]/)].map(plain).filter(Boolean));
    const item = wd[d.wikidata] ?? {};
    const theirs = [title, item.en, ...(item.aliasEn ?? [])].filter(Boolean).map(plain);
    return theirs.some(n => ours.has(n));
}

const skipped = [];
for (const { d } of all) {
    const rows = d.doseRows ?? [];
    if (!rows.length) continue;
    const onlyOral = rows.length === 1 && rows[0].roa === 'Oral';
    const page = d.wikidata ? cache[d.wikidata] : undefined;
    if (page?.title && !samePage(d, page.title)) {
        skipped.push(`${d.name} (linked to ${page.title})`);
        continue;
    }
    const wiki = page ? figuresFor(bioField(page.raw ?? ''), onlyOral) : {};
    for (const r of rows) {
        if (r.absorbed) {
            kept++;
            continue;
        }
        // Smoked, vaporized and inhaled are one route as far as the text goes.
        const key = /^(Smoked|Vaporized|Inhaled)$/.test(r.roa) ? 'Smoked' : r.roa;
        const pct = wiki[key];
        if (!pct) continue;
        r.absorbed = { min: pct[0], max: pct[1], source: 'Wikipedia', page: cache[d.wikidata].title };
        filled++;
        report.push(`${d.name}: ${r.roa} ${pct[0] === pct[1] ? pct[0] : `${pct[0]}–${pct[1]}`}%`);
    }
}

for (const { f, d } of all) await fs.writeFile(path.join(DIR, f), JSON.stringify(d));

const rows = all.reduce((n, { d }) => n + (d.doseRows?.length ?? 0), 0);
const known = all.reduce((n, { d }) => n + (d.doseRows ?? []).filter(r => r.absorbed).length, 0);
console.log(report.sort().join('\n'));
if (skipped.length) console.log(`\nNot used, as the page is about something else: ${skipped.join(', ')}`);
console.log(`\n${kept} figures kept, ${filled} added from Wikipedia: ${known} of ${rows} dose rows say how much is absorbed.`);
