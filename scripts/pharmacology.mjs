// How each substance works and what it's used for: `pharmacology` and `uses`
// on every substance an article or Wikidata says something about.
//
// The words are Wikipedia's: the opening of the article's section on its
// mechanism (Pharmacodynamics, Mechanism of action, Pharmacology) and of the
// one on its use (Medical uses, Uses, Recreational use), a few sentences
// each. An article too short to have such sections says both in its opening
// lines, and those sentences are taken instead. Where Wikipedia has nothing,
// PsychonautWiki's page on the substance is read the same way.
//
// Quoted, never rewritten: a sentence is taken whole or not at all, and the
// quote stops at the first that can't be read as plain words (see
// lib/wikitext.mjs). Never a dose: a sentence that gives an amount ends the
// quote too.
//
// Beside the words, rows of facts: the receptors, transporters and channels
// it binds to and what it does to each, from the IUPHAR/BPS Guide to
// Pharmacology; from the article's infobox, what kind of drug it is, what the
// body does with it, what it's sold as and how it's taken; its side effects
// as the article sums them up; and, where no article says what it's used
// for, the conditions Wikidata lists it for.
//
//   node scripts/pharmacology.mjs            fetch what isn't cached, then write
//   node scripts/pharmacology.mjs --refetch  fetch everything again
//   node scripts/pharmacology.mjs --fetch    only fetch what isn't cached
//   node scripts/pharmacology.mjs --write    only write, from the cache
//   node scripts/pharmacology.mjs --dry      write nothing; SHOW=lsd,diazepam prints theirs
//
// LIST_WITHOUT=file lists the substances left without one or the other;
// UNKNOWN=1 the templates the reader didn't know, the most common first.
//
// Run after sync-wikidata.mjs, which links each substance to its Wikidata
// item. Wikipedia's and PsychonautWiki's text is CC BY-SA, and each quote
// names its page and links to it; the Guide to Pharmacology's table is
// CC BY-SA too. Wikipedia answers about ten requests a minute, so a first
// run takes a quarter of an hour.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStructures } from './lib/structures.mjs';
import { fieldItems, plainText, sectionsOf, sentences, sound, unknownTemplates } from './lib/wikitext.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public/data/substances');
const CACHE = path.join(ROOT, 'scripts/.cache');
const PAGES = path.join(CACHE, 'pharmacology-pages.json');
const FACTS = path.join(CACHE, 'pharmacology-wikidata.json');
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const refetch = process.argv.includes('--refetch');
const dry = process.argv.includes('--dry');
const offline = process.argv.includes('--write') || dry;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const qid = uri => uri.slice(uri.lastIndexOf('/') + 1);

async function get(url, init = {}) {
    for (let k = 0; k < 8; k++) {
        try {
            const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
            if (res.status === 429 || res.status >= 500) {
                // Wikipedia allows about ten requests a minute, and says how long to wait.
                await sleep((Number(res.headers.get('retry-after')) || 20 * (k + 1)) * 1000 + 1000);
                continue;
            }
            return await res.json();
        } catch {
            await sleep(5000 * (k + 1));
        }
    }
    throw new Error(`gave up on ${url.slice(0, 120)}`);
}

async function sparql(query) {
    const json = await get('https://query.wikidata.org/sparql', {
        method: 'POST',
        headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `query=${encodeURIComponent(query)}`,
    });
    await sleep(500);
    return json.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

async function readJson(file, fallback) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        return fallback;
    }
}

const files = (await fs.readdir(DIR)).filter(f => f.endsWith('.json'));
const all = [];
for (const f of files) all.push({ f, d: JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8')) });
const linked = [...new Set(all.map(({ d }) => d.wikidata).filter(Boolean))];

/* ── Wikidata: the article, and what it treats ───────────────────────── */

const facts = refetch ? {} : await readJson(FACTS, {});
const unasked = linked.filter(q => !facts[q]);
if (unasked.length && !offline) {
    console.log(`Asking Wikidata about ${unasked.length} substances…`);
    for (const part of chunks(unasked, 200)) {
        const values = part.map(q => `wd:${q}`).join(' ');
        const at = Object.fromEntries(part.map(q => [q, { title: null, treats: [], roles: [] }]));
        for (const r of await sparql(`SELECT ?item ?title WHERE { VALUES ?item { ${values} }
          ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title }`))
            at[qid(r.item)].title = r.title;
        for (const r of await sparql(`SELECT ?item ?cl WHERE { VALUES ?item { ${values} }
          ?item wdt:P2175 ?c . ?c rdfs:label ?cl FILTER(LANG(?cl) = "en") }`))
            at[qid(r.item)].treats.push(r.cl);
        for (const r of await sparql(`SELECT ?item ?kl WHERE { VALUES ?item { ${values} }
          ?item wdt:P2868|wdt:P366 ?k . ?k rdfs:label ?kl FILTER(LANG(?kl) = "en") }`))
            at[qid(r.item)].roles.push(r.kl);
        Object.assign(facts, at);
        await fs.mkdir(CACHE, { recursive: true });
        await fs.writeFile(FACTS, JSON.stringify(facts));
        process.stdout.write(`Wikidata: ${Object.keys(facts).length}\n`);
    }
}

/* ── the Guide to Pharmacology: what it binds to, and what it does there ── */

// Wikidata copies the Guide's interactions (as "physically interacts with"),
// but with the kind of action often wrong: olanzapine and quetiapine are down
// as agonists of the receptors they block, buprenorphine as an antagonist of
// the receptor it partly activates. So the interactions are read from the
// Guide's own table, and only the Guide's number for each substance is taken
// from Wikidata.
const GUIDE = path.join(CACHE, 'pharmacology-guide.json');
const guide = refetch ? {} : await readJson(GUIDE, {});
guide.ids ??= {};
const numberless = linked.filter(q => !(q in guide.ids));
if (numberless.length && !offline) {
    console.log(`Asking Wikidata for the Guide to Pharmacology's number for ${numberless.length} substances…`);
    for (const part of chunks(numberless, 300)) {
        for (const q of part) guide.ids[q] = null;
        for (const r of await sparql(`SELECT ?item ?g WHERE { VALUES ?item { ${part.map(q => `wd:${q}`).join(' ')} } ?item wdt:P595 ?g }`)) guide.ids[qid(r.item)] ??= r.g;
    }
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(GUIDE, JSON.stringify(guide));
}

/** A table as rows of fields: quoted, with commas and line breaks inside the quotes. */
function csvRows(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') (row.push(field), (field = ''));
        else if (c === '\n') (row.push(field), rows.push(row), (row = []), (field = ''));
        else if (c !== '\r') field += c;
    }
    if (field || row.length) (row.push(field), rows.push(row));
    return rows;
}

// A substance with no number from Wikidata (amphetamine, cocaine, MDMA and
// fluoxetine aren't linked to an item) is the Guide's ligand of the same name.
const sameName = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '');
const ligandOf = d => guide.ids[d.wikidata] ?? guide.names?.[sameName(d.name)] ?? null;
const ligandsWanted = () => [...new Set(all.map(({ d }) => ligandOf(d)).filter(Boolean))];
if ((!guide.names || ligandsWanted().some(id => !guide.rows?.[id])) && !offline) {
    console.log(`Reading the Guide to Pharmacology's interactions…`);
    const res = await fetch('https://www.guidetopharmacology.org/DATA/interactions.csv', { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`the Guide's interactions: ${res.status}`);
    const table = csvRows(await res.text());
    const head = table.findIndex(r => r.includes('Ligand ID') && r.includes('Target'));
    const col = Object.fromEntries(table[head].map((name, i) => [name, i]));
    const body = table.slice(head + 1).filter(r => r[col['Ligand ID']] && r[col.Target]);
    guide.version = table[0]?.[0] ?? '';
    // Every ligand's name, so that a substance can be found by its own.
    guide.names = {};
    for (const r of body) if (sameName(r[col.Ligand]).length >= 4) guide.names[sameName(r[col.Ligand])] ??= r[col['Ligand ID']];
    const want = new Set(ligandsWanted());
    guide.rows = Object.fromEntries([...want].map(id => [id, []]));
    for (const r of body) {
        const id = r[col['Ligand ID']];
        if (!want.has(id)) continue;
        guide.rows[id].push({
            target: r[col.Target],
            species: r[col['Target Species']],
            type: r[col.Type],
            action: r[col.Action],
            primary: r[col['Primary Target']] === 'true',
            affinity: Number(r[col['Affinity Median']]) || 0,
        });
    }
    await fs.writeFile(GUIDE, JSON.stringify(guide));
    console.log(`${guide.version}: ${Object.values(guide.rows).filter(r => r.length).length} substances have interactions there`);
}

/* ── Wikipedia: what the drug's infobox says ─────────────────────────── */

// The box at the top of a drug's article holds, in a few words each, what a
// page of prose would: what it's sold as and how it's taken, how much gets
// in, what breaks it down and into what, how soon it works, for how long,
// its half-life, and how it leaves. Kept as written; read when put together.
const BOX_FIELDS = {
    brands: 'tradename|trade_?names?',
    routes: 'routes_of_administration|AdminRoutes',
    kind: 'class|drug_class',
    absorbed: 'bioavailability|Bioavail',
    brokenDown: 'metabolism',
    turnsInto: 'metabolites',
    onset: 'onset',
    halfLife: 'elimination_half-life|HalfLife',
    lasts: 'duration_of_action',
    leaves: 'excretion',
    addiction: 'addiction_liability',
    dependence: 'dependency_liability|dependence_liability',
};
/** The infobox's fields, each as it's written. */
function boxOf(wikitext) {
    const top = wikitext.slice(0, wikitext.search(/^==/m) >>> 0);
    const out = {};
    for (const [k, names] of Object.entries(BOX_FIELDS)) {
        const m = new RegExp(`^[ \\t]*\\|[ \\t]*(?:${names})[ \\t]*=([\\s\\S]*?)(?=\\n[ \\t]*\\||\\n[ \\t]*\\}\\})`, 'im').exec(top);
        const v = m?.[1].replace(/<!--[\s\S]*?-->/g, '').trim();
        if (v) out[k] = v.slice(0, 1500);
    }
    return out;
}

const BOXES = path.join(CACHE, 'pharmacology-infobox.json');
const boxes = refetch ? {} : await readJson(BOXES, {});

/* ── Wikipedia: the sections that say how it works and what it's for ── */

// A section is kept if its heading, or the heading it sits under, is one of these.
const KEEP = /pharmac|mechanism|mode of action|biolog|activit|\buses?\b|usage|medic|clinical|indication|therap|recreation|application|effects|research|veterinar|abuse|misuse|non-medical|illicit/i;
const NEVER = /^(references?|notes?|see also|external links|further reading|bibliography|footnotes|citations|sources)$/i;

/** Without what's never read: comments, references, tables, and the boxes
 *  that open a page (an infobox runs to thousands of characters). */
function bare(text, lead) {
    let t = text.replace(/<!--[\s\S]*?-->/g, '');
    t = t.replace(/<ref\b[^>]*\/\s*>/gi, '').replace(/<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, '');
    for (let k = 0; k < 12; k++) {
        const next = t.replace(/\{\|(?:(?!\{\||\|\})[\s\S])*\|\}/g, '\n');
        if (next === t) break;
        t = next;
    }
    if (!lead) return t;
    // A template that starts a line and runs over several: a box, not a sentence.
    let out = '';
    for (let i = 0; i < t.length; ) {
        const atLineStart = i === 0 || t[i - 1] === '\n';
        if (atLineStart && t.startsWith('{{', i)) {
            let depth = 0;
            let j = i;
            for (; j < t.length; j++) {
                if (t.startsWith('{{', j)) (depth++, j++);
                else if (t.startsWith('}}', j)) {
                    depth--;
                    j++;
                    if (!depth) break;
                }
            }
            const block = t.slice(i, j + 1);
            if (block.includes('\n') || /^\{\{\s*(?:short description|use |about|redirect|distinguish|for\b|other uses|hatnote|pp-|infobox|drugbox|chembox|cs1|italic|lowercase|good article|featured)/i.test(block)) {
                i = j + 1;
                continue;
            }
        }
        out += t[i++];
    }
    return out;
}

const CUT = 6000;
/** A long text cut at the end of a paragraph, or of a sentence: never mid-sentence. */
function cut(text) {
    if (text.length < CUT) return text;
    const para = text.lastIndexOf('\n', CUT - 1);
    return text.slice(0, para > CUT / 2 ? para : text.lastIndexOf('. ', CUT - 1) + 1);
}
/** What's kept of a page: its lead, its headings, and the kept sections, each cut to a few thousand characters. */
function keepOf(wikitext) {
    const secs = sectionsOf(wikitext);
    const out = { heads: secs.slice(1).map(s => `${s.level}:${s.title}`), secs: [] };
    const above = [];
    for (const s of secs) {
        while (above.length && above[above.length - 1].level >= s.level) above.pop();
        const under = above.some(a => /pharmac|mechanism|\buses?\b|usage|medic|indication|application/i.test(a.title));
        above.push(s);
        if (s.level > 1 && (NEVER.test(s.title) || !(KEEP.test(s.title) || under))) continue;
        out.secs.push({ level: s.level, title: s.title, text: cut(bare(s.text, s.level === 1).trim()) });
    }
    return out;
}

const pages = refetch ? {} : await readJson(PAGES, {});
const titles = [...new Set(linked.map(q => facts[q]?.title).filter(Boolean))];
const unread = titles.filter(t => !(t in pages));
if (unread.length && !offline) {
    console.log(`Reading ${unread.length} Wikipedia articles…`);
    let n = 0;
    for (const part of chunks(unread, 50)) {
        const text = {};
        const back = new Map();
        let more = {};
        // A batch too large to send at once comes in parts.
        for (let turn = 0; turn < 40 && more; turn++) {
            const r = await get(
                `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: part.join('|'), ...more })}`,
            );
            for (const x of r.query?.redirects ?? []) back.set(x.to, x.from);
            for (const x of r.query?.normalized ?? []) back.set(x.to, x.from);
            for (const p of r.query?.pages ?? []) {
                const content = p.revisions?.[0]?.slots?.main?.content;
                if (content == null) continue;
                let t = p.title;
                for (let k = 0; k < 4 && back.has(t); k++) t = back.get(t);
                text[t] = content;
                text[p.title] ??= content;
            }
            more = r.continue ?? null;
            await sleep(6500);
        }
        for (const t of part) {
            pages[t] = t in text ? keepOf(text[t]) : null;
            boxes[t] = t in text ? boxOf(text[t]) : null;
        }
        n += part.length;
        await fs.mkdir(CACHE, { recursive: true });
        await fs.writeFile(PAGES, JSON.stringify(pages));
        await fs.writeFile(BOXES, JSON.stringify(boxes));
        process.stdout.write(`Wikipedia: ${n} of ${unread.length}\n`);
    }
}

/* ── PsychonautWiki: its own page, for what Wikipedia doesn't say ────── */

const PW = path.join(CACHE, 'pharmacology-psychonautwiki.json');
const pw = refetch ? {} : await readJson(PW, {});
const pwTitle = d => {
    const url = (d.helpfulLinks ?? []).find(l => /^https:\/\/psychonautwiki\.org\/wiki\//.test(l.url))?.url;
    return url ? decodeURIComponent(url.slice(url.indexOf('/wiki/') + 6)).replace(/_/g, ' ') : null;
};
// A substance TripSit gave has no link to PsychonautWiki, which often has a page with its name all the same.
const pwTitles = [...new Set(all.filter(({ d }) => d.source !== 'Wikidata').map(({ d }) => pwTitle(d) ?? d.name))];
const pwUnread = pwTitles.filter(t => !(t in pw));
if (pwUnread.length && !offline) {
    console.log(`Reading ${pwUnread.length} PsychonautWiki pages…`);
    for (const part of chunks(pwUnread, 40)) {
        const r = await get(
            `https://psychonautwiki.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: part.join('|') })}`,
        );
        const back = new Map();
        for (const x of r.query?.redirects ?? []) back.set(x.to, x.from);
        for (const x of r.query?.normalized ?? []) back.set(x.to, x.from);
        const text = {};
        const titleOf = {};
        for (const p of r.query?.pages ?? []) {
            const content = p.revisions?.[0]?.slots?.main?.content;
            if (content == null) continue;
            let t = p.title;
            for (let k = 0; k < 4 && back.has(t); k++) t = back.get(t);
            text[t] = content;
            titleOf[t] = p.title;
            text[p.title] ??= content;
        }
        // Its links carry what they mean ([[chemical class::thienodiazepine]]); only the word is read.
        for (const t of part) pw[t] = t in text ? { title: titleOf[t] ?? t, ...keepOf(text[t].replace(/\[\[[^\]|:]+::/g, '[[')) } : null;
        await fs.writeFile(PW, JSON.stringify(pw));
        await sleep(3000);
    }
}

/* ── Wikipedia, by name ──────────────────────────────────────────────── */

const plain = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const wd = {};
for (const f of ['existing-details.json', 'details.json']) Object.assign(wd, await readJson(path.join(CACHE, f), {}));
/** One of the substance's names is one of the article's, or of its Wikidata item's. */
function namedAlike(d, title) {
    if (d.source === 'Wikidata') return true;
    const ours = new Set([d.name, d.name.replace(/\s*\((?:compound|drug|substance|medication)\)$/i, ''), d.id, ...String(d.aliases ?? '').split(/[,;]/)].map(plain).filter(Boolean));
    const item = wd[d.wikidata] ?? {};
    return [title, item.en, ...(item.aliasEn ?? [])].filter(Boolean).map(plain).some(n => ours.has(n));
}

// Some substances are looked up by their own name.
//
// One kind has no Wikidata item, or an item with no article: amphetamine,
// cocaine and MDMA aren't linked (Wikidata keeps the compound under one item
// and its PubChem entry under another), and Librium's item is the salt's.
// The other is linked to an article none of its names matches (3-CMC to
// "3-Chloromethcathinone", but also coca to "Cocaine"): the article is its
// own if that's where Wikipedia sends its name.
//
// What Wikipedia shows for a name isn't always the substance: "Cake" is a
// cake, "Lithium" the metal, "Cannabis" the plant's genus, and "2-FEA" and
// "PV-10" are other compounds that go by the same letters. ownByName() below
// says which pages are taken.
const BY_NAME = path.join(CACHE, 'pharmacology-by-name.json');
const byName = refetch ? {} : await readJson(BY_NAME, {});
const toLookUp = all.filter(({ d }) => !facts[d.wikidata]?.title || !namedAlike(d, facts[d.wikidata].title)).map(({ d }) => d.name);
const unlooked = toLookUp.filter(n => !(n in byName));
if (unlooked.length && !offline) {
    console.log(`Looking up ${unlooked.length} substances on Wikipedia by name…`);
    for (const part of chunks(unlooked, 50)) {
        const r = await get(
            `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: part.join('|') })}`,
        );
        const back = new Map();
        for (const x of r.query?.redirects ?? []) back.set(x.to, x.from);
        for (const x of r.query?.normalized ?? []) back.set(x.to, x.from);
        const found = {};
        for (const p of r.query?.pages ?? []) {
            const content = p.revisions?.[0]?.slots?.main?.content;
            if (content == null) continue;
            let t = p.title;
            for (let k = 0; k < 4 && back.has(t); k++) t = back.get(t);
            found[t] = { title: p.title, content };
            found[p.title] ??= found[t];
        }
        for (const n of part) {
            const f = found[n];
            if (!f) {
                byName[n] = null;
                continue;
            }
            // What its infobox says it is, and which compound: read before the first heading only.
            const top = f.content.slice(0, f.content.search(/^==/m) >>> 0);
            byName[n] = {
                title: f.title,
                box: /\{\{\s*(?:Infobox drug|Drugbox|Chembox|Infobox drug class|Infobox medical intervention|Infobox botanical product)\b/i.test(top),
                dab: /\{\{\s*(?:disambiguation|disambig|dab|hndis|chemistry disambiguation|chemdisambig|letter-number combination disambiguation|set index article|sia|chemistry index)\b/i.test(f.content),
                cid: Number(/\|\s*PubChem(?:CID)?\s*=\s*(\d+)/i.exec(top)?.[1]) || null,
                key: /\|\s*StdInChIKey\s*=\s*([A-Z]{14}-[A-Z]{10}-[A-Z])/.exec(top)?.[1] ?? null,
                ...keepOf(f.content),
            };
            boxes[f.title] ??= boxOf(f.content);
        }
        await fs.writeFile(BY_NAME, JSON.stringify(byName));
        await fs.writeFile(BOXES, JSON.stringify(boxes));
        await sleep(6500);
    }
}

/* ── Wikipedia: the infoboxes not read along with their articles ────── */

const boxTitles = [...new Set([...titles, ...Object.values(byName).filter(v => v?.secs).map(v => v.title)])];
const unboxed = boxTitles.filter(t => !(t in boxes));
if (unboxed.length && !offline) {
    console.log(`Reading the infobox of ${unboxed.length} Wikipedia articles…`);
    let n = 0;
    for (const part of chunks(unboxed, 50)) {
        const text = {};
        const back = new Map();
        let more = {};
        for (let turn = 0; turn < 40 && more; turn++) {
            const r = await get(
                `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: part.join('|'), ...more })}`,
            );
            for (const x of r.query?.redirects ?? []) back.set(x.to, x.from);
            for (const x of r.query?.normalized ?? []) back.set(x.to, x.from);
            for (const p of r.query?.pages ?? []) {
                const content = p.revisions?.[0]?.slots?.main?.content;
                if (content == null) continue;
                let t = p.title;
                for (let k = 0; k < 4 && back.has(t); k++) t = back.get(t);
                text[t] = content;
                text[p.title] ??= content;
            }
            more = r.continue ?? null;
            await sleep(6500);
        }
        for (const t of part) boxes[t] = t in text ? boxOf(text[t]) : null;
        n += part.length;
        await fs.writeFile(BOXES, JSON.stringify(boxes));
        process.stdout.write(`Infoboxes: ${n} of ${unboxed.length}\n`);
    }
}
if (process.argv.includes('--fetch')) process.exit(0);

const structures = await readStructures(ROOT);
const keyOf = await readJson(path.join(CACHE, 'existing-keys.json'), {});
const singular = s => plain(s).replace(/s$/, '');
const longWords = s => new Set(s.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5));
const DRUG_WORDS = /\b(?:drugs?|psychoactive|medications?|medicines?|stimulants?|depressants?|hallucinogen\w*|psychedelic\w*|entheogen\w*|opioids?|sedatives?|narcotics?|intoxicants?|dissociatives?|deliriants?|nootropics?|cannabinoids?|alkaloids?|inhalants?)\b/i;
// An article that tells of a drug has a section like one of these.
const DRUG_HEADS = /^(?:pharmacology|pharmacodynamics|mechanisms? of action|medical uses?|adverse effects|side effects|recreational use|effects)$/i;

/** The article Wikipedia shows for a substance's own name, if it's the substance's. */
function ownByName(d) {
    const p = byName[d.name];
    if (!p?.secs || p.dab) return null;
    const exact = singular(p.title) === singular(d.name);
    const alike = exact || [...longWords(p.title)].some(w => longWords(d.name).has(w));
    // Another compound that goes by the same letters: the article's is a different structure.
    const mine = structures[d.id];
    if (mine?.role === 'self' && p.cid && mine.cid !== p.cid && !alike) {
        const keys = [keyOf[mine.cid], ...(wd[d.wikidata]?.keys ?? [])].filter(Boolean).map(k => k.slice(0, 14));
        if (!p.key || !keys.includes(p.key.slice(0, 14))) return null;
    }
    // An article about a drug, by its infobox; or one with the very name that
    // opens by calling it a drug and has a drug article's sections ("Cannabis
    // is a genus of flowering plants" is the plant's).
    if (p.box) return p;
    const opening = sentences(leadOf(p)[0] ?? '')[0] ?? '';
    return exact && DRUG_WORDS.test(opening) && p.secs.some(x => x.level <= 3 && DRUG_HEADS.test(x.title)) ? p : null;
}

// Whatever was cached is cut the same way (a no-op for what already is).
for (const page of [...Object.values(pages), ...Object.values(pw), ...Object.values(byName)]) for (const s of page?.secs ?? []) s.text = cut(s.text);

/* ── choosing the words ──────────────────────────────────────────────── */

// An amount to take: "16–24 mg", "200 μg", "2 mg/kg". Not a concentration (ng/mL, μM).
const DOSE = /\d\s*(?:mg|μg|µg|mcg|ug|g|mL|ml|milligrams?|micrograms?|grams?)\b(?!\/(?:d?L|mL|ml|l)\b)|\b(?:micro|milli)grams?\b|\bdos(?:e|es|age)s? (?:of|range|is|are|was)\b/;
// A sentence that leans on the one before it can't stand alone.
const LEANS = /^(?:This|These|That|Those|Such|However|Thus|Therefore|Hence|Moreover|Furthermore|Additionally|In addition|Also|Consequently|As a result|As such|For this reason|Because of this|Similarly|Likewise|Conversely|On the other hand|In contrast|By contrast|Nevertheless|Nonetheless|Instead|Otherwise|Accordingly|He|She|They|Their|Both|Others?|Another|The latter|The former|In (?:this|these|that|such)|At (?:this|these|that|such)|For example|For instance|Specifically|Indeed|Again|Then|Subsequently|Later|Afterwards?|Since then|Despite this|Besides|Here|There|Its? (?:also|further)|Second|Third|Finally|Lastly|Yet|But|And|Or|So|Once|Meanwhile|Overall|Alternatively|Additionally|Notably|Importantly|Interestingly|(?:Among|Of|With|From|By|Under|After|Before|During|Because of|Due to|Despite|Unlike|Like|As with|Along with|Together with|Besides|Beyond) (?:these|this|that|those|them|such|which))\b/;

/** A paragraph's sentences, the last given the full stop the article left off it. */
const withStop = ss => ss.map((s, i) => (i === ss.length - 1 && /[A-Za-z0-9)\]%]$/.test(s) ? `${s}.` : s));

// How it gets in and out of the body, which isn't how it works.
const KINETICS = /\b(?:half-li(?:fe|ves)|bioavailab\w+|absorbed|absorption|plasma|peak (?:levels?|concentrations?)|excret\w+|eliminat\w+|protein[- ]bound|protein binding|volume of distribution|clearance|first-pass)\b/i;

/** The opening of a text: whole sentences, up to about `max` characters,
 *  ending at the first that can't be quoted as it stands. Sentences that
 *  match `past` at the start are passed over. */
function quote(paras, past = null, max = 460) {
    let out = [];
    let len = 0;
    let passed = false;
    for (const para of paras.slice(0, 3)) {
        let skipped = false;
        let stopped = false;
        for (const s of withStop(sentences(para))) {
            if (!sound(s)) {
                stopped = true;
                if (!out.length) passed = true;
                break;
            }
            if (DOSE.test(s) || (past?.test(s) && !out.length)) {
                if (out.length) {
                    stopped = true;
                    break;
                }
                skipped = true;
                passed = true;
                continue;
            }
            if ((skipped || !out.length) && LEANS.test(s)) {
                if (out.length) {
                    stopped = true;
                    break;
                }
                skipped = true;
                continue;
            }
            if (out.length ? len + s.length + 1 > max : s.length > 560) {
                stopped = true;
                break;
            }
            out.push(s);
            len += s.length + 1;
            skipped = false;
        }
        // A short opening paragraph runs on into the next; anything longer stands.
        if (out.length && (stopped || len > 220)) break;
    }
    return { text: out.join(' '), passed };
}

// How it's made isn't what it's used for ("not used for production"), nor is what a word is used to mean.
const MADE = /\b(?:total synthesis|biosynthesi[sz]\w*|not used|production|manufactur\w+|precursors?|the (?:word|term|name)|used to (?:refer|describe|denote|mean|name)|refers? to)\b/i;
// When it comes on and how long it lasts is drawn elsewhere on the page.
const TIMING = /\b(?:onset|duration) of\b|\b(?:onset|duration) (?:is|was|are)\b|\blasts? (?:for |about |around |up to )?\d/i;

/** The sentences of a page's opening lines that say a thing (how it works,
 *  what it's used for), in their order, a few of them. */
function mined(paras, says, max = 420, not = null, opens = null) {
    const out = [];
    let len = 0;
    for (const para of paras)
        for (const s of withStop(sentences(para))) {
            if (!says.test(s) || !sound(s) || DOSE.test(s) || LEANS.test(s) || TIMING.test(s)) continue;
            if ((says === USED && MADE.test(s)) || not?.test(s) || (opens && !opens.test(s))) continue;
            if (out.length ? len + s.length + 1 > max : s.length > 520) continue;
            out.push(s);
            len += s.length + 1;
            if (out.length === 3) return out.join(' ');
        }
    return out.join(' ');
}

// Words that say what a substance does to the body.
const WORKS = /\b(?:agonis[tm]s?|antagonis[tm]s?|inhibit(?:or|ors|s|ing|ion)|block(?:er|ers|s|ing|ade)|modulat(?:or|ors|es|ing|ion)|releasing agents?|releasers?|reuptake|receptors?|bind(?:s|ing)|affinit(?:y|ies)|prodrug|mechanisms? of action|acts? (?:as|by|on|through|via|at|primarily|mainly|similarly|centrally)|works? by|activat(?:es|ing|ion)|potentiat(?:es|ing|ion)|ligands?|transporters?|ion channels?|sympathomimetic|anticholinergic|antimuscarinic|GABAergic|serotonergic|dopaminergic|noradrenergic|active metabolite|metaboli[sz]ed (?:in)?to|neurotransmi\w+)\b/i;
// And what people do with it.
const USED = /\b(?:used|uses?d? (?:as|in|for)|treat(?:s|ed|ing|ment|ments)?|indicated|prescribed|approved|marketed|sold|licensed|medications?|medicines?|recreational(?:ly)?|designer drugs?|research chemicals?|drugs? of abuse|abused|misused|investigated|studied|under development|developed (?:as|for|by)|clinical trials?|never marketed|not marketed|withdrawn|discontinued|veterinary|an[ae]sthe\w+|entheogen\w*|consumed|smoked|chewed|taken (?:by|orally|as)|encountered|illicit\w*|street)\b/i;

// The sections on its mechanism, the most to the point first: what it does
// to the body (Pharmacodynamics), then how (Mechanism of action), then the
// Pharmacology section's own opening, which often starts elsewhere.
const HOW = [
    /^pharmacodynamics?$/i,
    /^(?:mechanisms? of action|modes? of action|mechanism|mechanism of effects?)$/i,
    /^(?:pharmacology|neuropharmacology|pharmacological (?:profile|properties|effects|activity|actions?)|pharmacology and (?:biochemistry|toxicology|chemistry)|biochemistry and pharmacology|chemistry and pharmacology)$/i,
    /^(?:biological activity|bioactivity|biological effects|activity|biochemistry|pharmacological effects|effects)$/i,
];
const NOT_HOW = /pharmacokinetic|metaboli|absorption|distribution|excretion|elimination|chemistry|synthesis|history|detection|interaction|overdose|toxic|adverse|side effect|legal|dosage|dosing|structure|analog|derivativ|subjective|experience|tolerance|dependence|withdrawal/i;

const FOR = [
    /^(?:(?:medical|clinical|therapeutic|medicinal) (?:uses?|applications?|usage|indications?)|indications?|therapeutic indications|uses? in medicine|medicine|medical|uses?|usage|applications?|medical and recreational uses?|uses? and effects|use and effects|effects and uses?|common usage|medical use and research)$/i,
];
// Words that say outright what it's used for.
const SAYS_USE = /\b(?:is|are|was|were|been|being|commonly|widely|mainly|primarily|mostly|also|sometimes|often|still|now|typically|usually) (?:\w+ )?used\b|\bused (?:to|for|in|as|recreationally|medically|clinically|off-label|by)\b|\b(?:indicated|prescribed|approved|licensed|marketed|sold|developed|investigated|studied) (?:for|to|as|in|under|by|online)\b|\btreatment of\b|\bto treat\b|\bdesigner drug\b|\bresearch chemical\b|\bnever marketed\b/i;
const FOR_FUN = /^(?:recreational (?:use|drug use|usage)|recreational|non-?medical use|use as a (?:recreational|designer|street) drug|illicit use|recreational use and abuse|abuse and recreational use|misuse and recreational use)$/i;
const FOR_STUDY = /^(?:research|clinical (?:trials|development|research|studies)|investigational uses?|research uses?|scientific research|veterinary (?:uses?|medicine)|other uses)$/i;
const NOT_FOR = /contraindication|adverse|side effect|overdose|interaction|pregnan|breastfeed|dos(?:e|age|ing)|administration|available forms|formulation|legal|history|chemistry|pharmac|toxic|detection|synthesis|withdrawal|dependence|tolerance|precaution|warning|risk/i;

/** A page's sections with the headings asked for, in the order asked. */
function* headed(page, heads) {
    for (const head of heads) for (const s of page.secs) if (s.level >= 2 && head.test(s.title)) yield s;
}
/** The sections beneath those, for when they say nothing themselves
 *  (Pharmacodynamics, then "Actions"; Medical uses, then "Epilepsy"). */
function* beneath(page, heads, not) {
    for (const head of heads)
        for (let i = 0; i < page.secs.length; i++) {
            const s = page.secs[i];
            if (s.level < 2 || !head.test(s.title)) continue;
            let skip = Infinity;
            for (let j = i + 1; j < page.secs.length && page.secs[j].level > s.level; j++) {
                const c = page.secs[j];
                if (c.level > skip) continue;
                skip = Infinity;
                if (not.test(c.title) || heads.some(h => h.test(c.title))) {
                    if (not.test(c.title)) skip = c.level;
                    continue;
                }
                yield c;
            }
        }
}

function leadOf(page) {
    return plainText(page.secs.find(s => s.level === 1)?.text ?? '');
}
const anchor = title => title.replace(/ /g, '_');

// Its effects, said as such: "possesses anxiolytic, anticonvulsant and sedative properties".
const DOES = /\b(?:possess(?:es)?|ha[sd]|have|produces?|exhibits?|shows?|displays?|exerts?|with|its|their)\b[^.;]{0,90}\b(?:properties|effects|activity|actions?)\b/i;
const SIDE = /\b(?:side|adverse|unwanted|toxic|withdrawal|no (?:known |significant )?(?:psychoactive |pharmacological )?(?:effects|activity))\b/i;
// The same, held to more: a page written loosely has to say it plainly.
const WORKS_PLAINLY = /\b(?:mechanisms? of action|acts? (?:as|by|on|through|via)|works? by|agonists?|antagonists?|reuptake inhibitors?|releasing agents?|binds? to|binding to)\b/i;

/** How it works, as this page tells it: { text, section } or null. A
 *  section on its mechanism that says so from its first line; else the
 *  article's opening lines, which sum it up; else a section read from
 *  further in, or one of the finer sections beneath; else what the opening
 *  lines say it does. `loose` is a page whose opening lines wander
 *  (PsychonautWiki's): of those, only a sentence that says it plainly. */
function howFrom(page, loose = false) {
    const later = [];
    for (const s of headed(page, HOW)) {
        const { text, passed } = quote(plainText(s.text), KINETICS);
        if (!text) continue;
        if (WORKS.test(text) && !passed) return { text, section: s.title };
        later.push({ text, section: s.title });
    }
    const lead = mined(leadOf(page), loose ? WORKS_PLAINLY : WORKS);
    if (lead) return { text: lead };
    const said = later.find(x => WORKS.test(x.text));
    if (said) return said;
    for (const s of beneath(page, HOW, NOT_HOW)) {
        const { text, passed } = quote(plainText(s.text), KINETICS);
        if (text && WORKS.test(text) && !passed) return { text, section: s.title };
    }
    if (loose) return null;
    if (later[0]) return later[0];
    // What it does, said of the substance itself and not of a relative: the
    // sentence opens with it ("It has…", "Clazolam possesses…", "The effects of…").
    const subject = new RegExp(`^(?:Its?|The (?:drug|compound|substance|effects of)|${(page.title ?? '').split(/[\s(,]/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || 'It'})\\b`, 'i');
    const does = mined(leadOf(page), DOES, 420, SIDE, subject);
    return does ? { text: does } : null;
}

/** What it's used for: { text, section, recreational } or null.
 *
 *  The article's own section on its use, if it opens by saying so outright.
 *  Where that section only holds finer ones (Uses: Medical, Recreational,
 *  Spiritual), the article's opening lines sum them up better than the first
 *  of them does, so those come next; then whatever else says anything.
 *  Of a `loose` page's opening lines, only the sentences that say it outright. */
function usesFrom(page, loose = false) {
    const saying = (sections, { outright = false, top = false } = {}) => {
        for (const [s, parent] of sections) {
            const { text, passed } = quote(plainText(s.text));
            if (!text || TIMING.test(text)) continue;
            // A section that opens on the dose and goes on to something else
            // (how soon it comes on) says little of what it's used for.
            if (passed && (top || !SAYS_USE.test(text))) continue;
            // Nor does a line or two before the sections that do the telling.
            if (top && (s.level > 2 || (parent && text.length < 160))) continue;
            if (!outright || SAYS_USE.test(text)) return { text, section: s.title };
        }
        return null;
    };
    /** Each section with the headings asked for, and whether it has sections of its own. */
    const withHeads = heads => [...headed(page, heads)].map(s => [s, page.secs[page.secs.indexOf(s) + 1]?.level > s.level]);
    const fun = saying(withHeads([FOR_FUN]));
    const also = main => ({ ...main, ...(fun && fun.text !== main.text ? { recreational: fun.text } : {}) });
    const lead = mined(leadOf(page), loose ? SAYS_USE : USED);
    const main =
        saying(withHeads(FOR), { outright: true, top: true }) ??
        (lead && SAYS_USE.test(lead) ? { text: lead } : null) ??
        saying(withHeads(FOR), { outright: true }) ??
        saying(withHeads(FOR)) ??
        (lead ? { text: lead } : null) ??
        saying([...beneath(page, FOR, NOT_FOR)].map(s => [s, false]));
    if (main) return also(main);
    return fun ?? saying(withHeads([FOR_STUDY]));
}

// What goes wrong: the opening lines' "Common side effects include…", which
// a medicine's article has by custom; else the opening of its section on them.
const SIDE_SAYS = /\b(?:side|adverse) effects? (?:include|may include|can include|are|of|such as)\b|\b(?:common|serious|severe|other|possible|rare|long-term|short-term) (?:side|adverse) effects\b/i;
const SIDE_HEADS = /^(?:adverse effects|side effects|adverse reactions|side effects and (?:risks|toxicity)|adverse effects and (?:risks|toxicity))$/i;
function sideFrom(page) {
    const lead = mined(leadOf(page), SIDE_SAYS);
    if (lead) return { text: lead };
    for (const s of headed(page, [SIDE_HEADS])) {
        const { text, passed } = quote(plainText(s.text));
        if (text && !passed) return { text, section: s.title };
    }
    return null;
}

/* ── the infobox, row by row ─────────────────────────────────────────── */

// Figures measured in animals, or in a dish, say nothing about people (as scripts/absorption.mjs holds).
const NOT_PEOPLE = /\b(?:rats?|mice|mouse|dogs?|monkeys?|primates?|animals?|rabbits?|horses?|pigs?|in vitro)\b/i;
const NOTHING = /^(?:\?+|unknown|not known|n\/a|none|tbd|—|–|-)$/i;

/** One field of the infobox as a line: its items, the ones that can be read, a few of them. */
function boxLine(raw, { keepNone = false, max = 220 } = {}) {
    if (!raw) return '';
    let out = '';
    for (const item of fieldItems(raw)) {
        // A bare number says nothing without its unit.
        if (DOSE.test(item) || NOT_PEOPLE.test(item) || (!keepNone && NOTHING.test(item)) || /^[\d.,\s]+$/.test(item) || item.length > 160) continue;
        // "IR dosing:" heads the item after it; a bracket goes with the one before.
        const next = out ? (out.endsWith(':') || /^\([^()]*\)$/.test(item) ? `${out} ${item}` : `${out}; ${item}`) : item;
        if (next.length > max) break;
        out = next;
    }
    return out.replace(/:$/, '');
}
// In the order they happen to a dose.
const IN_THE_BODY = ['absorbed', 'onset', 'lasts', 'halfLife', 'brokenDown', 'turnsInto', 'leaves'];

/* ── what the Guide records, in the site's words ─────────────────────── */

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', kappa: 'κ', mu: 'μ', sigma: 'σ', theta: 'θ', rho: 'ρ', pi: 'π', omega: 'ω' };
// The Guide names a target as pharmacologists write it ("D<sub>2</sub> receptor", "&mu; receptor", "NET");
// these are the names in full, the subunits of one receptor or channel under one name.
const TARGETS = [
    [/^5-HT3/i, () => '5-HT3 receptor'],
    [/^5-ht(\d[a-f]?) receptor$/i, m => `5-HT${m[1].toUpperCase()} receptor`],
    [/^acetylcholinesterase/i, () => 'Acetylcholinesterase'],
    [/^vesicular monoamine transporter/i, () => 'Vesicular monoamine transporter'],
    [/^sigma receptor chaperone 1$/i, () => 'Sigma-1 receptor'],
    [/^OT receptor$/, () => 'Oxytocin receptor'],
    [/^V(?:1A|1B|2) receptor$/, () => 'Vasopressin receptor'],
    [/^GlyT\d$/, () => 'Glycine transporter'],
    [/^thyroid hormone receptor/i, () => 'Thyroid hormone receptor'],
    [/^peroxisome proliferator-activated receptor-(.+)$/i, m => `PPAR-${m[1]}`],
    [/^TAS2R\d+$/, () => 'Bitter taste receptors'],
    [/^D(\d) receptor$/, m => `Dopamine D${m[1]} receptor`],
    [/^H(\d) receptor$/, m => `Histamine H${m[1]} receptor`],
    [/^M(\d) receptor$/, m => `Muscarinic M${m[1]} receptor`],
    [/^A(1|2A|2B|3) receptor$/, m => `Adenosine A${m[1]} receptor`],
    [/^([μκδ]) receptor$/, m => `${m[1]}-opioid receptor`],
    [/^NOP receptor$/, () => 'Nociceptin receptor'],
    [/^([αβ])(\d)[A-D]?-adrenoceptor$/, m => `${m[1]}${m[2]}-adrenoceptor`],
    [/^MT(\d) receptor$/, m => `MT${m[1]} melatonin receptor`],
    [/^OX(\d) receptor$/, m => `Orexin OX${m[1]} receptor`],
    [/^TA1 receptor$/, () => 'TAAR1'],
    [/^DAT$/, () => 'Dopamine transporter'],
    [/^SERT$/, () => 'Serotonin transporter'],
    [/^NET$/, () => 'Noradrenaline transporter'],
    [/^VMAT\d$/, () => 'Vesicular monoamine transporter'],
    [/^GAT\d$/, () => 'GABA transporter'],
    [/^GABAA receptor .*ρ\d/, () => 'GABA-A-rho receptor'],
    [/^GABAA receptor/, () => 'GABA-A receptor'],
    [/^GABAB/, () => 'GABA-B receptor'],
    [/^GluN/, () => 'NMDA receptor'],
    [/^GluA/, () => 'AMPA receptor'],
    [/^GluK/, () => 'Kainate receptor'],
    [/^nicotinic acetylcholine receptor/i, () => 'Nicotinic acetylcholine receptor'],
    [/^glycine receptor/i, () => 'Glycine receptor'],
    [/^Nav\d/, () => 'Voltage-gated sodium channels'],
    [/^Cav\d/, () => 'Voltage-gated calcium channels'],
    [/^Kv11\.1$/, () => 'hERG potassium channel'],
    [/^K(?:v|ir|Ca|2P|Na)\d/, () => 'Potassium channels'],
    [/^HCN\d$/, () => 'HCN channels'],
    [/^RyR\d$/, () => 'Ryanodine receptor'],
    [/^IP3R\d$/, () => 'IP3 receptor'],
    [/^ASIC\d/, () => 'Acid-sensing ion channels'],
    [/^(?:Cx\d+|Px\d)$/, () => 'Gap junctions'],
    [/^CatSper\d$/, () => 'CatSper channels'],
    [/^TAS2R\d+$/, () => 'Bitter taste receptors'],
    [/^(?:σ1|sigma non-opioid intracellular) receptor(?: 1)?$/i, () => 'Sigma-1 receptor'],
    [/^(?:σ2|sigma-2) receptor$/i, () => 'Sigma-2 receptor'],
    [/^monoamine oxidase ([AB])$/i, m => `MAO-${m[1]}`],
    [/^phosphodiesterase (\d+)[A-D]?$/i, m => `PDE${m[1]}`],
    [/^PDE(\d+)[A-D]$/, m => `PDE${m[1]}`],
    [/^carbonic anhydrase/i, () => 'Carbonic anhydrase'],
    [/^(Estrogen receptor)-[αβ]$/i, () => 'Estrogen receptor'],
];
const targetName = label => {
    // "&alpha;<sub>1A</sub>-adrenoceptor" as "α1A-adrenoceptor".
    const plainName = label
        .replace(/<[^>]+>/g, '')
        .replace(/&([a-z]+);/gi, (whole, name) => GREEK[name.toLowerCase()] ?? whole)
        .replace(/\s+/g, ' ')
        .trim();
    for (const [re, name] of TARGETS) {
        const m = re.exec(plainName);
        if (m) return name(m);
    }
    return plainName.charAt(0).toUpperCase() + plainName.slice(1);
};

/** What it does to a target, in one of the few words the page knows, from the Guide's type and action. */
function howOf(row) {
    const type = row.type.toLowerCase();
    const action = row.action.toLowerCase();
    if (type === 'agonist') return /partial/.test(action) ? 'partial agonist' : /inverse/.test(action) ? 'inverse agonist' : 'agonist';
    if (type === 'antagonist') return /inverse/.test(action) ? 'inverse agonist' : /partial/.test(action) ? 'partial agonist' : 'antagonist';
    if (type === 'activator') return 'activator';
    if (type === 'inhibitor' || type === 'gating inhibitor') return 'inhibitor';
    if (type === 'channel blocker') return 'blocker';
    // At a site beside the main one (the benzodiazepines' on the GABA-A receptor), an
    // "agonist" strengthens the receptor, an "inverse agonist" weakens it, an "antagonist" blocks the site.
    if (type === 'allosteric modulator')
        return /inverse|negative|inhibition/.test(action) ? 'negative modulator' : /\bantagonist/.test(action) ? 'antagonist' : /\bagonist|positive|potentiation|activation/.test(action) ? 'positive modulator' : 'modulator';
    return 'ligand';
}
// The receptors and transporters of the brain's own messengers: a drug's hold
// on one of these is worth a line even where the Guide gives no figure for it.
const MESSENGERS = /^5-HT|Dopamine|Histamine|Muscarinic|adrenoceptor|opioid|GABA|NMDA|AMPA|Kainate|^CB\d|Adenosine|Nicotinic|transporter$|Sigma|Orexin|melatonin|TAAR|^mGlu|Glycine receptor|Nociceptin/;

/** [{ how: 'antagonist', on: ['Dopamine D2 receptor', …] }] from the Guide's
 *  rows for a substance, or [] if the Guide doesn't say what its main target is.
 *
 *  The Guide is a catalogue of targets, each with what binds to it, so a
 *  substance's rows can be a stray finding and not how it works: lorazepam's
 *  one row is an orphan receptor, amphetamine's two are carbonic anhydrases,
 *  cocaine's is the 5-HT3 receptor. What it does mark is a drug's primary
 *  target. So a substance gets rows only if it has one marked, and they are:
 *  its primary targets; what else it binds tightly (to within a few hundred
 *  nanomolar); and, with no figure given, a messenger's receptor or
 *  transporter. The kind of action that holds a primary target comes first. */
function actsOf(rows) {
    const human = rows.filter(r => !r.species || r.species === 'Human');
    if (!human.some(r => r.primary)) return [];
    const ranked = human.sort((a, b) => Number(b.primary) - Number(a.primary) || b.affinity - a.affinity);
    // A target counts once, as the first thing said of it.
    const how = new Map();
    for (const r of ranked) {
        const name = targetName(r.target);
        if (how.has(name)) continue;
        if (r.primary || r.affinity >= 6.5 || (!r.affinity && MESSENGERS.test(name))) how.set(name, howOf(r));
    }
    const groups = new Map();
    for (const [name, h] of [...how].slice(0, 14)) groups.set(h, [...(groups.get(h) ?? []), name]);
    const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
    return [...groups].map(([h, on]) => ({ how: h, on: on.sort(natural) }));
}

// Conditions Wikidata lists that aren't conditions a drug is given for.
const NOT_TREATED = /susceptibility|^substance abuse$|^mental disorder$|^disease$|^syndrome$/i;

/* ── put together ───────────────────────────────────────────────────── */

/** The names an article gives its subject: what's in bold in its opening lines. */
function boldNames(page) {
    const lead = page?.secs?.find(s => s.level === 1)?.text ?? '';
    return [...lead.slice(0, 2500).matchAll(/'''(.+?)'''/g)].map(m => m[1].replace(/'{2,}|\[\[|\]\]|\{\{[^{}]*\}\}/g, ''));
}
/** The article is about this substance, not a relative it's linked to: they
 *  share a name, or it's where Wikipedia sends the substance's name, or the
 *  article gives the name as one of its subject's ("1,3-DMAA" for DMAA). */
function samePage(d, title) {
    if (namedAlike(d, title) || byName[d.name]?.title === title) return true;
    const name = plain(d.name);
    return name.length >= 3 && boldNames(pages[title]).some(b => plain(b) === name || b.split(/[^A-Za-z0-9α-ω]+/).some(w => plain(w) === name));
}

const wikiUrl = (title, section) => `https://en.wikipedia.org/wiki/${encodeURIComponent(anchor(title))}${section ? `#${encodeURIComponent(anchor(section))}` : ''}`;
const pwUrl = (title, section) => `https://psychonautwiki.org/wiki/${encodeURIComponent(anchor(title))}${section ? `#${encodeURIComponent(anchor(section))}` : ''}`;

const count = { how: 0, uses: 0, side: 0, howText: 0, usesText: 0, acts: 0, body: 0, brands: 0, routes: 0, either: 0, both: 0 };
const from = {};
const skipped = [];
for (const { d } of all) {
    delete d.pharmacology;
    delete d.uses;
    delete d.sideEffects;
    const fact = d.wikidata ? facts[d.wikidata] : null;
    // Its Wikipedia article: the one its Wikidata item names, or the one with its own name.
    let wiki = null;
    if (fact?.title && pages[fact.title] && samePage(d, fact.title)) wiki = { title: fact.title, page: { title: fact.title, ...pages[fact.title] } };
    else {
        if (fact?.title && pages[fact.title]) skipped.push(`${d.name} (linked to ${fact.title})`);
        const own = ownByName(d);
        if (own) wiki = { title: own.title, page: own };
    }
    const pwT = d.source === 'Wikidata' ? null : (pwTitle(d) ?? d.name);
    const own = pwT && pw[pwT] ? { title: pw[pwT].title ?? pwT, page: pw[pwT] } : null;

    const sources = [wiki && { ...wiki, source: 'Wikipedia', url: wikiUrl }, own && { ...own, source: 'PsychonautWiki', url: pwUrl, loose: true }].filter(Boolean);
    let how = null;
    let uses = null;
    for (const s of sources) {
        if (!how) {
            const got = howFrom(s.page, s.loose);
            if (got) how = { text: got.text, source: s.source, page: s.title, url: s.url(s.title, got.section) };
        }
        if (!uses) {
            const got = usesFrom(s.page, s.loose);
            if (got) uses = { text: got.text, ...(got.recreational ? { recreational: got.recreational } : {}), source: s.source, page: s.title, url: s.url(s.title, got.section) };
        }
    }
    // Side effects, from Wikipedia only: PsychonautWiki's are the page's own "Effects people report".
    const sideGot = wiki ? sideFrom(wiki.page) : null;
    const side = sideGot ? { text: sideGot.text, source: 'Wikipedia', page: wiki.title, url: wikiUrl(wiki.title, sideGot.section) } : null;

    // The infobox of the same article.
    const box = (wiki && boxes[wiki.title]) || {};
    const figures = wiki?.title;
    // What the page already says from PsychonautWiki or TripSit isn't said twice,
    // in other figures: how much gets in (drawn route by route where doses are
    // given), how soon and how long (its timeline), its half-life.
    const said = { absorbed: d.doseRows?.length, onset: d.durationRows?.length, lasts: d.durationRows?.length, halfLife: d.halfLife };
    const body = IN_THE_BODY.filter(k => !said[k]).map(k => ({ what: k, says: boxLine(box[k]) })).filter(r => r.says);
    const kind = boxLine(box.kind, { max: 160 });
    // "Valium, others": the others aren't names.
    const brands = boxLine(box.brands).replace(/[,;]?\s*(?:and |among )?(?:many )?others?$/i, '');
    const routes = boxLine(box.routes);
    const addiction = d.addictionPotential ? '' : boxLine(box.addiction, { keepNone: true, max: 120 });
    const dependence = d.addictionPotential ? '' : boxLine(box.dependence, { keepNone: true, max: 120 });

    // What the Guide to Pharmacology records it binding to, if the Wikidata item is the substance's own.
    const mine = fact && (!fact.title || samePage(d, fact.title));
    const ligand = !fact || mine ? ligandOf(d) : null;
    const acts = ligand && guide.rows?.[ligand]?.length ? actsOf(guide.rows[ligand]) : [];
    if (how || acts.length || body.length || kind)
        d.pharmacology = { ...(how ?? {}), ...(acts.length ? { acts, guide: Number(ligand) } : {}), ...(kind ? { kind } : {}), ...(body.length ? { body } : {}), ...(body.length || kind ? { figures } : {}) };
    // Where no article says what it's used for, what Wikidata lists it for.
    const treats = !uses && mine ? [...new Set(fact.treats)].filter(c => !NOT_TREATED.test(c)).slice(0, 12) : [];
    if (uses || treats.length || brands || routes)
        d.uses = { ...(uses ?? {}), ...(treats.length ? { treats } : {}), ...(brands ? { brands } : {}), ...(routes ? { routes } : {}), ...(brands || routes ? { figures } : {}) };
    if (side || addiction || dependence)
        d.sideEffects = { ...(side ?? {}), ...(addiction ? { addiction } : {}), ...(dependence ? { dependence } : {}), ...(addiction || dependence ? { figures } : {}) };

    if (d.pharmacology) count.how++;
    if (d.uses) count.uses++;
    if (d.sideEffects) count.side++;
    if (how) count.howText++;
    if (uses) count.usesText++;
    if (acts.length) count.acts++;
    if (body.length) count.body++;
    if (brands) count.brands++;
    if (routes) count.routes++;
    if (d.pharmacology || d.uses) count.either++;
    if (d.pharmacology && d.uses) count.both++;
    for (const x of [how, uses, side]) if (x) from[x.source] = (from[x.source] ?? 0) + 1;
}

if (!dry) for (const { f, d } of all) await fs.writeFile(path.join(DIR, f), JSON.stringify(d));
if (process.env.SHOW) {
    const ids = process.env.SHOW.split(',');
    for (const { d } of all) if (ids.includes(d.id)) console.log(d.name, JSON.stringify({ pharmacology: d.pharmacology, uses: d.uses, sideEffects: d.sideEffects }, null, 1));
}

if (skipped.length) console.log(`Not used, as the page is about something else: ${skipped.join(', ')}`);
console.log(`${all.length} substances: ${count.how} say how they work (${count.howText} in words, ${count.acts} with what they bind to, ${count.body} with what the body does with them), ${count.uses} what they're used for (${count.usesText} in words, ${count.brands} with brand names, ${count.routes} with how they're taken), ${count.side} their side effects; ${count.both} say both of the first two, ${all.length - count.either} neither.`);
console.log(Object.entries(from).map(([k, v]) => `${v} quotes from ${k}`).join(', '));
if (process.env.LIST_WITHOUT) await fs.writeFile(process.env.LIST_WITHOUT, all.filter(({ d }) => !d.pharmacology || !d.uses).map(({ d }) => `${d.pharmacology ? ' ' : 'P'}${d.uses ? ' ' : 'U'} ${d.name}`).join('\n'));
if (process.env.UNKNOWN) console.log([...unknownTemplates].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([k, n]) => `${n} ${k}`).join('; '));
