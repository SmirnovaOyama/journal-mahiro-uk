// Adds to public/data the psychoactive substances and nervous-system
// medicines that Wikidata knows and PsychonautWiki and TripSit
// (scripts/sync-substances.mjs) don't, and gives every substance, old or
// new, its Wikipedia article where Wikidata has one. English only.
//
// A new entry holds only what is known for sure: its names, what kind of
// drug it is, its PubChem compound (for the drawing), the opening of its
// Wikipedia article, and the interactions Wikidata lists. Never a dose:
// doses come from PsychonautWiki and TripSit only.
//
//   node scripts/sync-wikidata.mjs            fetch what isn't cached, then write
//   node scripts/sync-wikidata.mjs --refetch  fetch everything again
//   node scripts/sync-wikidata.mjs --write    only write, from the cache
//
// Run after sync-substances.mjs (which rewrites the PsychonautWiki/TripSit
// entries) and before fetch-structures.mjs. Wikidata is CC0; Wikipedia's
// text is CC BY-SA, and each page links back to its article.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStructures } from './lib/structures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'public/data');
const SUBS = path.join(DATA, 'substances');
const CACHE = path.join(ROOT, 'scripts/.cache');
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const SPARQL = 'https://query.wikidata.org/sparql';
const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

const refetch = process.argv.includes('--refetch');
const writeOnly = process.argv.includes('--write');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const qid = uri => uri.slice(uri.lastIndexOf('/') + 1);

async function fetchRetry(url, init = {}, tries = 6) {
    for (let k = 0; k < tries; k++) {
        try {
            const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
            if (res.status === 429 || res.status >= 500) {
                const wait = Number(res.headers.get('retry-after')) * 1000 || 3000 * (k + 1);
                await sleep(wait);
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
    return json.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

/** A cached step: the value is read from scripts/.cache unless asked to fetch again. */
async function cached(name, make) {
    const file = path.join(CACHE, `${name}.json`);
    if (!refetch) {
        try {
            return JSON.parse(await fs.readFile(file, 'utf8'));
        } catch {
            if (writeOnly) throw new Error(`nothing cached for ${name}: run without --write first`);
        }
    }
    const value = await make();
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(file, JSON.stringify(value));
    return value;
}

/* ── which items ─────────────────────────────────────────────────────── */

// The kinds of drug a substance can be said to be (with every subclass).
const ROOTS = [
    'Q3706669', // psychoactive drug
    'Q12830468', // psychotropic drug
    'Q310491', // entheogen
    'Q1200715', // designer drug
    'Q19904200', // synthetic cannabinoid
    'Q900394', // dissociative
    'Q194270', // hallucinogen
    'Q211036', // stimulant
    'Q3255015', // central nervous system stimulant
    'Q1976211', // depressant
    'Q427523', // opioid
];
// And these by name, whose ids weren't looked up by hand.
const ROOT_LABELS = ['nootropic', 'deliriant', 'cannabinoid', 'gabapentinoid', 'opiate', 'barbiturate', 'nonbenzodiazepine'];

// Chemical families the new psychoactive substances are filed under.
const FAMILY_LABELS = [
    'substituted phenethylamine',
    'substituted amphetamine',
    'substituted cathinone',
    'substituted tryptamine',
    'substituted methylenedioxyphenethylamine',
    'substituted benzofuran',
    'substituted aminorex',
    'substituted phenidate',
    'substituted aminoindane',
    'lysergamide',
    'arylcyclohexylamine',
    'benzodiazepine',
    'thienodiazepine',
    'triazolobenzodiazepine',
    'designer benzodiazepine',
    'nitazene',
    'fentanyl analogue',
    'fentanyl analog',
    '2C (psychedelics)',
    'NBOMe',
    '25-NB',
];

// Classes that sit under the roots but aren't psychoactive substances.
const NOT_KINDS = /tobacco|snus|cigar|brand|strain|in japan|drug scene|convulsant|aphrodisiac|truth drug|^hydrazine$|local anesthetic|topical anesthetic|kykeon|flying ointment|zombie|rodent|bud$|kush|skunk|domenico|corojo|burley|aroma|morning star|lucky strike|dissolvable|khaini|akoin/i;

// Medicines, by ATC code: anaesthetics (general), opioids, antiepileptics,
// anti-parkinson drugs, psycholeptics, psychoanaleptics, other nervous system
// drugs, muscle relaxants, appetite suppressants, sedating antihistamines,
// opium alkaloids for cough.
const ATC = ['N01A', 'N02A', 'N03', 'N04', 'N05', 'N06', 'N07', 'M03B', 'A08A', 'R06AA', 'R06AD', 'R05DA'];

// Wikipedia's lists of drugs, and what each says of the compounds it links.
const LISTS = [
    ['List of designer drugs', ''],
    ['List of psychedelic drugs', 'psychedelic'],
    ['List of entactogens', 'entactogen'],
    ['List of opioids', 'opioid'],
    ['List of fentanyl analogues', 'fentanyl opioid'],
    ['List of benzodiazepines', 'benzodiazepine'],
    ['List of antidepressants', 'antidepressant'],
    ['List of antipsychotics', 'antipsychotic'],
    ['List of substituted amphetamines', 'amphetamine'],
    ['List of substituted cathinones', 'substituted cathinone stimulant'],
    ['List of methylphenidate analogues', 'phenidate stimulant'],
    ['List of cocaine analogues', 'stimulant'],
    ['List of phenyltropanes', 'stimulant'],
    ['List of investigational hallucinogens and entactogens', ''],
    ['List of investigational antidepressants', 'antidepressant'],
    ['List of investigational antipsychotics', 'antipsychotic'],
    ['List of investigational anxiolytics', 'anxiolytic'],
    ['List of investigational sleep drugs', 'hypnotic'],
    ['List of miscellaneous 5-HT2A receptor agonists', 'psychedelic'],
    ['Designer benzodiazepine', 'benzodiazepine'],
    ['Nitazene', 'nitazene opioid'],
    ['Substituted phenethylamine', ''],
    ['Substituted tryptamine', ''],
    ['Substituted cathinone', 'substituted cathinone stimulant'],
    ['Substituted amphetamine', 'amphetamine'],
    ['Arylcyclohexylamine', 'arylcyclohexylamine dissociative'],
    ['Lysergamide', 'lysergamide psychedelic'],
    ['Synthetic cannabinoid', 'synthetic cannabinoid'],
    ['PiHKAL', 'phenethylamine psychedelic'],
    ['TiHKAL', 'tryptamine psychedelic'],
    ['List of investigational analgesics', ''],
    ['List of investigational attention deficit hyperactivity disorder drugs', 'stimulant'],
    ['List of investigational narcolepsy and hypersomnia drugs', 'stimulant'],
    ['List of investigational obesity drugs', ''],
    ['List of investigational substance-related disorder drugs', ''],
    ['List of investigational insomnia drugs', 'hypnotic'],
    ['List of investigational bipolar disorder drugs', ''],
    ['Nootropic', 'nootropic'],
    ['Racetam', 'racetam nootropic'],
    ['Deliriant', 'deliriant'],
    ['Dissociative', 'dissociative'],
    ['Entactogen', 'entactogen'],
    ['Eugeroic', 'eugeroic stimulant'],
    ['Z-drug', 'nonbenzodiazepine hypnotic'],
    ['Thienodiazepine', 'thienodiazepine'],
    ['Barbiturate', 'barbiturate'],
    ['Gabapentinoid', 'gabapentinoid'],
    ['Ergoline', ''],
    ['Substituted benzofuran', ''],
    ['Substituted methylenedioxyphenethylamine', 'entactogen'],
    ['List of Schedule I controlled substances (U.S.)', ''],
    ['List of Schedule II controlled substances (U.S.)', ''],
    ['List of Schedule III controlled substances (U.S.)', ''],
    ['List of Schedule IV controlled substances (U.S.)', ''],
    ['List of Schedule V controlled substances (U.S.)', ''],
];

/** The pages the first runs read, kept in scripts/.cache/lists.json. */
const LEGACY_PAGES = [
    'List of designer drugs', 'List of psychedelic drugs', 'List of entactogens', 'List of opioids', 'List of fentanyl analogues',
    'List of benzodiazepines', 'List of antidepressants', 'List of antipsychotics', 'List of substituted amphetamines',
    'List of substituted cathinones', 'List of methylphenidate analogues', 'List of cocaine analogues', 'List of phenyltropanes',
    'List of investigational hallucinogens and entactogens', 'List of investigational antidepressants',
    'List of investigational antipsychotics', 'List of investigational anxiolytics', 'List of investigational sleep drugs',
    'List of miscellaneous 5-HT2A receptor agonists', 'Designer benzodiazepine', 'Nitazene', 'Substituted phenethylamine',
    'Substituted tryptamine', 'Substituted cathinone', 'Substituted amphetamine', 'Arylcyclohexylamine', 'Lysergamide',
    'Synthetic cannabinoid', 'List of Schedule I controlled substances (U.S.)', 'List of Schedule II controlled substances (U.S.)',
    'List of Schedule III controlled substances (U.S.)', 'List of Schedule IV controlled substances (U.S.)',
    'List of Schedule V controlled substances (U.S.)',
];

/** The Wikidata items of the articles a Wikipedia page links to in its own
 *  text. Read from the wikitext, so the navigation boxes at the foot of the
 *  page (which list hundreds of unrelated drugs) don't count. */
async function linkedItems(title) {
    const res = await fetchRetry(
        `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', page: title, prop: 'wikitext', redirects: '1' })}`,
    );
    const json = await res.json().catch(() => ({}));
    const text = json.parse?.wikitext ?? '';
    await sleep(1500);
    const titles = new Set();
    for (const m of text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
        const t = m[1].trim();
        if (!t || /^(file|image|category|wikipedia|template|help|portal|wikt|w|special|talk|user|:)/i.test(t) || t.includes(':')) continue;
        titles.add(t.charAt(0).toUpperCase() + t.slice(1));
    }
    const out = new Set();
    for (const part of chunks([...titles], 50)) {
        const r = await fetchRetry(
            `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', titles: part.join('|'), redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item' })}`,
        );
        const j = await r.json().catch(() => ({}));
        for (const p of j.query?.pages ?? []) if (p.pageprops?.wikibase_item) out.add(p.pageprops.wikibase_item);
        await sleep(1200);
    }
    return [...out];
}

/** Of these items, the ones that are a compound PubChem knows. */
async function compoundsAmong(qids) {
    const keep = [];
    for (const part of chunks(qids, 250)) {
        const rows = await sparql(`SELECT DISTINCT ?item WHERE { VALUES ?item { ${part.map(q => `wd:${q}`).join(' ')} } ?item wdt:P662 [] . }`);
        keep.push(...rows.map(r => qid(r.item)));
    }
    return keep;
}

async function fromLists() {
    const file = path.join(CACHE, 'list-pages.json');
    let pages = {};
    try {
        if (!refetch) pages = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        /* none yet */
    }
    const hints = {};
    // The pages fetched before they were cached one by one: their compounds
    // and what they said of them, as they were then.
    let legacy = {};
    try {
        legacy = JSON.parse(await fs.readFile(path.join(CACHE, 'lists.json'), 'utf8'));
    } catch {
        /* none */
    }
    for (const [q, hs] of Object.entries(legacy)) for (const h of hs) (hints[q] ??= []).push(h);
    const fetchedBefore = new Set(Object.keys(legacy).length ? LEGACY_PAGES : []);
    for (const [title, hint] of LISTS) {
        if (fetchedBefore.has(title) && !pages[title]) continue;
        if (!pages[title] && !writeOnly) {
            pages[title] = await compoundsAmong(await linkedItems(title));
            await fs.mkdir(CACHE, { recursive: true });
            await fs.writeFile(file, JSON.stringify(pages));
            process.stdout.write(`${title}: ${pages[title].length} compounds\n`);
        }
        for (const q of pages[title] ?? []) (hints[q] ??= []).push(hint || 'listed');
    }
    return hints;
}

/** Items a country's drug law controls (US schedules, UK classes, German Anlagen…). */
async function controlled() {
    const statuses = await sparql(`SELECT DISTINCT ?s ?l WHERE { ?item wdt:P3493 ?s ; wdt:P662 [] . ?s rdfs:label ?l FILTER(LANG(?l) = "en") }`);
    const law = /schedule|class [abc]\b|anlage|controlled|psychotropic|narcotic|misuse of drugs|opium act|betäubungsmittel|stupéfiant|poison standard|neue psychoaktive|psychoactive substances act/i;
    const picked = statuses.filter(r => law.test(r.l)).map(r => qid(r.s));
    console.log(`${picked.length} controlled-drug statuses: ${statuses.filter(r => law.test(r.l)).map(r => r.l).slice(0, 12).join('; ')}…`);
    const items = new Set();
    for (const part of chunks(picked, 30)) {
        const rows = await sparql(`SELECT DISTINCT ?item WHERE { VALUES ?s { ${part.map(q => `wd:${q}`).join(' ')} } ?item wdt:P3493 ?s ; wdt:P662 [] . }`);
        rows.forEach(r => items.add(qid(r.item)));
    }
    return [...items];
}

/** Every item filed under one of these classes (or their subclasses) with a PubChem compound. */
async function itemsUnder(roots) {
    const classes = new Set();
    for (const part of chunks(roots, 12)) {
        const rows = await sparql(`SELECT DISTINCT ?c ?l WHERE {
          VALUES ?root { ${part.map(q => `wd:${q}`).join(' ')} }
          ?c wdt:P279* ?root .
          OPTIONAL { ?c rdfs:label ?l FILTER(LANG(?l) = "en") } }`);
        rows.filter(r => !NOT_KINDS.test(r.l ?? '')).forEach(r => classes.add(qid(r.c)));
    }
    const items = new Set();
    for (const part of chunks([...classes], 40)) {
        const rows = await sparql(`SELECT DISTINCT ?item WHERE {
          VALUES ?k { ${part.map(q => `wd:${q}`).join(' ')} }
          { ?item wdt:P31 ?k } UNION { ?item wdt:P279 ?k } UNION { ?item wdt:P2868 ?k } UNION { ?item wdt:P366 ?k }
          ?item wdt:P662 [] . }`);
        rows.forEach(r => items.add(qid(r.item)));
    }
    return [...items];
}

/** Compounds that are only in a chemical family (a benzodiazepine ring makes
 *  an antibiotic a "benzodiazepine"): such an item counts as a drug only if
 *  something else says so too (an ATC code, a Wikipedia list of drugs). */
async function familyOnly() {
    const byLabel = async labels =>
        (await sparql(`SELECT DISTINCT ?c WHERE { VALUES ?l { ${labels.map(l => `"${l}"@en`).join(' ')} } ?c rdfs:label ?l . }`)).map(r => qid(r.c));
    const drugs = new Set(await itemsUnder([...ROOTS, ...(await byLabel(ROOT_LABELS))]));
    const family = await itemsUnder(await byLabel(FAMILY_LABELS));
    return family.filter(q => !drugs.has(q));
}

async function candidates() {
    const rootsByLabel = await sparql(`SELECT DISTINCT ?c WHERE {
      VALUES ?l { ${[...ROOT_LABELS, ...FAMILY_LABELS].map(l => `"${l}"@en`).join(' ')} }
      ?c rdfs:label ?l . }`);
    const roots = [...ROOTS, ...rootsByLabel.map(r => qid(r.c))];

    const classes = [];
    for (const part of chunks(roots, 12)) {
        const rows = await sparql(`SELECT DISTINCT ?c ?l WHERE {
          VALUES ?root { ${part.map(q => `wd:${q}`).join(' ')} }
          ?c wdt:P279* ?root .
          OPTIONAL { ?c rdfs:label ?l FILTER(LANG(?l) = "en") } }`);
        classes.push(...rows);
    }
    const kinds = [...new Map(classes.map(r => [qid(r.c), r.l ?? ''])).entries()]
        .filter(([, l]) => !NOT_KINDS.test(l))
        .map(([q]) => q);
    console.log(`${roots.length} roots, ${kinds.length} kinds of drug`);

    const items = new Set();
    for (const part of chunks(kinds, 40)) {
        const rows = await sparql(`SELECT DISTINCT ?item WHERE {
          VALUES ?k { ${part.map(q => `wd:${q}`).join(' ')} }
          { ?item wdt:P31 ?k } UNION { ?item wdt:P279 ?k } UNION { ?item wdt:P2868 ?k } UNION { ?item wdt:P366 ?k }
          ?item wdt:P662 [] . }`);
        rows.forEach(r => items.add(qid(r.item)));
    }
    // A kind that is itself one compound (alprazolam is filed as a class).
    const selfKinds = await sparql(`SELECT DISTINCT ?item WHERE {
      VALUES ?item { ${kinds.map(q => `wd:${q}`).join(' ')} } ?item wdt:P662 [] . }`);
    selfKinds.forEach(r => items.add(qid(r.item)));
    console.log(`${items.size} by kind`);

    const atc = await sparql(`SELECT DISTINCT ?item WHERE {
      ?item wdt:P267 ?atc ; wdt:P662 [] .
      FILTER(${ATC.map(p => `STRSTARTS(?atc, "${p}")`).join(' || ')}) }`);
    atc.forEach(r => items.add(qid(r.item)));
    console.log(`${items.size} with medicines`);
    return [...items];
}

/* ── what each item says ─────────────────────────────────────────────── */

async function details(ids) {
    const out = {};
    const at = id => (out[id] ??= { q: id, cids: [], keys: [], aliasEn: [], kinds: [], atc: [], ix: [] });
    let n = 0;
    for (const part of chunks(ids, 120)) {
        const values = part.map(q => `wd:${q}`).join(' ');
        const main = await sparql(`SELECT ?item ?en ?dEn ?cid ?ik ?enwiki WHERE {
          VALUES ?item { ${values} }
          OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
          OPTIONAL { ?item schema:description ?dEn FILTER(LANG(?dEn) = "en") }
          OPTIONAL { ?item wdt:P662 ?cid }
          OPTIONAL { ?item wdt:P235 ?ik }
          OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?enwiki } }`);
        for (const r of main) {
            const d = at(qid(r.item));
            d.en ??= r.en;
            d.dEn ??= r.dEn;
            d.enwiki ??= r.enwiki;
            if (r.cid && !d.cids.includes(+r.cid)) d.cids.push(+r.cid);
            if (r.ik && !d.keys.includes(r.ik)) d.keys.push(r.ik);
        }
        const aliases = await sparql(`SELECT ?item ?a WHERE { VALUES ?item { ${values} }
          ?item skos:altLabel ?a FILTER(LANG(?a) = "en") }`);
        for (const r of aliases) {
            const d = at(qid(r.item));
            if (!d.aliasEn.includes(r.a)) d.aliasEn.push(r.a);
        }
        const kinds = await sparql(`SELECT ?item ?k ?l WHERE { VALUES ?item { ${values} }
          ?item wdt:P31|wdt:P279|wdt:P2868|wdt:P366 ?k .
          OPTIONAL { ?k rdfs:label ?l FILTER(LANG(?l) = "en") } }`);
        for (const r of kinds) at(qid(r.item)).kinds.push(r.l ?? qid(r.k));
        const atc = await sparql(`SELECT ?item ?atc WHERE { VALUES ?item { ${values} } ?item wdt:P267 ?atc }`);
        for (const r of atc) at(qid(r.item)).atc.push(r.atc);
        const ix = await sparql(`SELECT ?item ?o ?l WHERE { VALUES ?item { ${values} } ?item wdt:P769 ?o .
          OPTIONAL { ?o rdfs:label ?l FILTER(LANG(?l) = "en") } }`);
        for (const r of ix) if (r.l) at(qid(r.item)).ix.push(r.l);
        n += part.length;
        process.stdout.write(`details: ${n} of ${ids.length}\n`);
    }
    return out;
}

/* ── the existing entries, as Wikidata knows them ────────────────────── */

async function existingKeys(structures) {
    // InChIKeys for the compounds already drawn as the substance itself.
    const cids = [...new Set(Object.values(structures).filter(s => s && s.role === 'self').map(s => s.cid))];
    const keyOf = {};
    for (const part of chunks(cids, 150)) {
        const res = await fetchRetry(`${PUG}/compound/cid/property/InChIKey/JSON`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `cid=${part.join(',')}`,
        });
        const json = await res.json();
        for (const p of json.PropertyTable?.Properties ?? []) keyOf[p.CID] = p.InChIKey;
        await sleep(300);
    }
    return keyOf;
}

async function itemsForKeys(keys) {
    const found = [];
    for (const part of chunks(keys, 150)) {
        const rows = await sparql(`SELECT DISTINCT ?item ?ik WHERE { VALUES ?ik { ${part.map(k => `"${k}"`).join(' ')} } ?item wdt:P235 ?ik . }`);
        found.push(...rows.map(r => ({ q: qid(r.item), ik: r.ik })));
    }
    return found;
}

/* ── Wikipedia's opening lines ───────────────────────────────────────── */

async function extracts(lang, titles) {
    const out = {};
    for (const part of chunks(titles, 20)) {
        const url =
            `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts` +
            `&exintro=1&explaintext=1&exlimit=20&redirects=1` +
            `&titles=${encodeURIComponent(part.join('|'))}`;
        const res = await fetchRetry(url);
        const json = await res.json();
        const back = new Map();
        for (const r of json.query?.redirects ?? []) back.set(r.to, r.from);
        for (const r of json.query?.normalized ?? []) back.set(r.to, r.from);
        for (const p of json.query?.pages ?? []) {
            let t = p.title;
            while (back.has(t)) t = back.get(t);
            if (p.extract) out[t] = p.extract;
        }
        await sleep(1000);
    }
    return out;
}

/** The first few sentences, up to about 420 characters, never cut mid-sentence. */
const FOREIGN = /[\u3000-\u9fff\uff00-\uffef]/;
function opening(text) {
    if (!text) return '';
    text = text
        .replace(/\s*\([^()]*[\u3000-\u9fff\uff00-\uffef][^()]*\)/g, '')
        .replace(/[\u3000-\u9fff\uff00-\uffef]+\s*\(("[^"]+"|'[^']+')\)/g, '$1')
        .replace(/[\u3000-\u9fff\uff00-\uffef]+/g, '')
        .replace(/\s{2,}/g, ' ');
    if (FOREIGN.test(text)) return '';
    const para = text.split('\n').map(s => s.trim()).filter(Boolean)[0] ?? '';
    const clean = para.replace(/\s*\([^()]*\)/g, m => (m.length > 60 ? '' : m)).replace(/\s{2,}/g, ' ');
    const sentences = clean.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g) ?? [clean];
    let out = '';
    for (const s of sentences) {
        if (out && (out + s).length > 420) break;
        out += s;
    }
    return out.trim();
}

/* ── sorting each item into the site's kinds ─────────────────────────── */

const SALT = /\b(hydrochloride|dihydrochloride|hydrobromide|hydroiodide|sulfate|sulphate|bisulfate|maleate|citrate|tartrate|bitartrate|fumarate|mesylate|mesilate|besylate|besilate|phosphate|succinate|oxalate|nitrate|lactate|pamoate|napsylate|tosylate|hydrate|monohydrate|dihydrate|HCl|sodium|potassium|calcium|magnesium|bromide salt)\b/i;
const NOT_SUBSTANCE = /pharmaceutical product|brand|trade name|mixture|combination drug|taxon|clinical trial|chemical reaction|protein|gene|receptor$/i;

const kindText = d => [...d.kinds, ...(d.hints ?? [])].join(' | ').toLowerCase();

/* When Wikidata doesn't say what kind of drug a compound is, its name
   often does: new psychoactive substances are named by family (…PINACA,
   NBOMe, …azolam, …fentanyl). Parent rings and plain chemicals don't count. */
const NAME_KINDS = [
    [/mitragyn|akuamm|\bnormeperidine\b/i, 'Opioid'],
    [/coronaridine|iboga|tabernanth|harm(?:ine|aline|alol|an)\b|tetrahydroharmine|\b(?:lampa|etfela|eipla|mipla|lsm-775|lsz)\b|\bidnna\b|t-tris\b|\bemdt\b|methylserotonin|trimethylserotonin/i, 'Psychedelic'],
    [/aminopropyl\)?benzofuran|\bapb\b|\bapdb\b|homarylamine|methylenedioxy/i, 'Empathogen'],
    [/benzofuranylpropylaminopentane|\bbpap\b|\bppap\b|phenylmorpholine|phenmetrazine|tametraline|phacetoperane|nicotine|anatabine|anabasine|n-methylphenethylamine|dimethyl-2-phenethylamine|hordenine|etafedrine|clofenciclan/i, 'Stimulant'],
    [/gabalin|baclofen|diplon\b|zolpidem|zaleplon|zopiclone|pellotine|anhalinine|lophophorine|anhalonidine/i, 'Depressant'],
    [/neramexane|memantine|amantadine/i, 'Dissociative'],
    [/lysergic acid [\w-]+ ?amide|fly\b|nbome|nboh|\bnbf\b|\b2c-|^2c[a-z]|\bdo[a-z]{1,3}\b|^25[a-z]{1,2}-|mescaline|escaline|proscaline/i, 'Psychedelic'],
    [/pinaca|\bpica\b|fubinaca|chmica|chminaca|jwh-?\d|\bam-?\d{3,4}\b|\bcp\s?-?(?:47,?497|55,?940|55,?244|50,?556)|\bhu-?\d{3}\b|ur-144|xlr-11|mdmb|\badb-|apinaca|pb-22|cumyl|^5f-/i, 'Cannabinoid'],
    [/\bpc[epy]\b|phencyclidine|pcp|\bmx[ep]\b|methoxetamine|ketamine|\bdck\b|deschloro|dizocilpine|\bmk-?801\b/i, 'Dissociative'],
    [/fentanyl|nitazene|\bu-?4\d{4}\b|ah-?7921|\bmt-?45\b|tilidine|morphin|codeine|oxycod|hydrocod|methadon|\bbuprenorph/i, 'Opioid'],
    [/azepam|azolam|zolam|benzodiazepin|barbit|qualone|\bsl-164\b|hydroxyvaleric|hydroxybutyr|valerolactone|butyrolactone|\bgh[bv]\b|\bgbl\b|\bgvl\b|-2-ol\b/i, 'Depressant'],
    [/\bmda\b|mdma|mdea|\bapb\b|apdb|mapb|mapdb|\bedma\b|mbdb|methylone|ethylone|butylone/i, 'Empathogen'],
    [/cocaine|tropane|\brti-?\d|\bwin\s?\d{2}|piperazine|\bbzp\b|tfmpp|mcpp|meopp|cathinone|drone\b|hexen|\bpvp\b|\bphp\b|mdpv|mdphp|phenidate|aminorex|amphetamine/i, 'Stimulant'],
    [/baeocystin|aeruginascin|psilocin|psilocybin|bufotenin|\bpyr-t\b|indol-3-yl|tryptamine|\bdmt\b|\bdpt\b|\bdipt\b|\bmipt\b|\bamt\b|\d-ho-|\d-meo-|lysergamide|\blsd\b|\blsa\b|\blad\b|eth-lad|al-lad|\b1p-|\b1cp-|\b1v-/i, 'Psychedelic'],
];
// Plain chemicals some list or role brings in: not drugs, however they're filed.
const NOT_DRUGS = /^(butyric acid|piperazine|carnosine|anserine|estrane|benzocyclobutene|glycine|taurine)$/i;
const PARENTS = /^(1h-)?(piperazine|indole|pyrrolidine|morpholine|benzofuran|indane|tetralin|thiophene|piperidine|tropane|ergoline|phenethylamine|tryptamine|amphetamine|cathinone|indazole|oxazolidine|lysergic acid)$/i;

function kindByName(d) {
    const names = [d.en, ...d.aliasEn].filter(Boolean);
    if (names.some(n => PARENTS.test(n.trim()))) return 'Other';
    for (const [re, k] of NAME_KINDS) if (names.some(n => re.test(n))) return k;
    return 'Other';
}

/** What the Wikipedia article's first sentence says it is ("…is a dissociative anaesthetic"). */
const firstSentence = d => (enText[d.enwiki] ?? '').split(/(?<=[.!?])\s/)[0].toLowerCase();

/** What a compound does, when nothing says what kind of drug it is. */
const MECHANISMS = [
    [/[μµ]-opioid|mu-opioid|[κk]appa-opioid|κ-opioid|δ-opioid|opioid receptor/, 'Opioid'],
    [/nmda/, 'Dissociative'],
    [/5-ht2a|serotonin 2a|5-ht 2a/, 'Psychedelic'],
    [/cb1|cannabinoid/, 'Cannabinoid'],
    [/monoamine oxidase|\bmaoi\b|serotonin reuptake/, 'Antidepressant'],
    [/dopamine reuptake|dopamine transporter|norepinephrine.{0,24}dopamine|dopamine.{0,24}norepinephrine|dopamine releas|monoamine releas|catecholaminergic|psychostimulant|anorectic/, 'Stimulant'],
    [/gaba[- ]?a\b|gabaa|gaba-b|gabab|gaba receptor|anticonvulsant|antiepileptic|sedative|hypnotic/, 'Depressant'],
];
const byMechanism = text => MECHANISMS.find(([re]) => re.test(text))?.[1] ?? 'Other';

function kindOf(d) {
    const own = kindFrom(d.kinds.join(' | ').toLowerCase(), d);
    if (own !== 'Other') return own;
    const byName = kindByName(d);
    if (byName !== 'Other') return byName;
    const sentence = firstSentence(d);
    const bySentence = sentence ? kindFrom(sentence, d) : 'Other';
    if (bySentence !== 'Other') return bySentence;
    const byHint = kindFrom(kindText(d), d);
    if (byHint !== 'Other') return byHint;
    return byMechanism(`${d.kinds.join(' | ')} ${sentence}`.toLowerCase());
}

function kindFrom(k, d) {
    if (/local anesthetic|local anaesthetic/.test(k) && !/cocaine/i.test(d.en ?? '')) return 'Other';
    const atc = d.atc.join(' ');
    const a = p => d.atc.some(c => c.startsWith(p));
    if (/(?<!non-)opioid|opiate|nitazene|fentanyl|morphinan|morphine/.test(k) || a('N02A') || a('N07BC') || a('R05DA')) return 'Opioid';
    if (/dissociative|nmda receptor antagonist|nmda receptor|arylcyclohexylamine/.test(k) || /N01AX03|N01AX14/.test(atc)) return 'Dissociative';
    if (/entactogen|empathogen|methylenedioxyphenethylamine/.test(k)) return 'Empathogen';
    if (/psychedelic|hallucinogen|entheogen|lysergamide|psychotomimetic|serotonin 2a|5-ht2a/.test(k)) return 'Psychedelic';
    if (/cannabinoid|cannabis/.test(k)) return 'Cannabinoid';
    if (/deliriant/.test(k)) return 'Deliriant';
    if (/antipsychotic|neuroleptic/.test(k) || a('N05A')) return 'Antipsychotic';
    if (/antidepressant|serotonin reuptake inhibitor|monoamine oxidase inhibitor/.test(k) || a('N06A')) return 'Antidepressant';
    if (/nootropic|racetam|cognitive enhancer/.test(k) || a('N06BX') || a('N06D')) return 'Nootropic';
    if (/stimulant|cathinone|amphetamine|pyrrolidinophenone|phenidate|aminoindane|wakefulness|eugeroic|anorectic|appetite suppressant/.test(k) || a('N06B') || a('A08A')) return 'Stimulant';
    if (/depressant|benzodiazepine|thienodiazepine|barbiturate|hypnotic|sedative|anxiolytic|tranquil|gabapentinoid|nonbenzodiazepine|anesthetic|anaesthetic|muscle relaxant|antiepileptic|anticonvulsant|gaba/.test(k) || a('N05B') || a('N05C') || a('N01A') || a('N03') || a('M03B') || a('R06A')) return 'Depressant';
    if (/tryptamine|phenethylamine/.test(k)) return 'Psychedelic';
    return 'Other';
}

// The family a substance is in, as the site names families ("Benzodiazepines").
const FAMILIES = [
    [/triazolobenzodiazepine|benzodiazepine/, 'Benzodiazepines'],
    [/thienodiazepine/, 'Thienodiazepines'],
    [/barbiturate/, 'Barbiturates'],
    [/nitazene/, 'Nitazenes'],
    [/fentanyl/, 'Fentanyl analogues'],
    [/cathinone|pyrrolidinophenone/, 'Substituted cathinones'],
    [/methylenedioxyphenethylamine/, 'Substituted methylenedioxyphenethylamines'],
    [/amphetamine/, 'Substituted amphetamines'],
    [/tryptamine/, 'Substituted tryptamines'],
    [/lysergamide/, 'Lysergamides'],
    [/arylcyclohexylamine/, 'Arylcyclohexylamines'],
    [/phenethylamine|nbome|\b2c\b/, 'Substituted phenethylamines'],
    [/synthetic cannabinoid|cannabinoid/, 'Cannabinoids'],
    [/benzofuran/, 'Substituted benzofurans'],
    [/aminoindane/, 'Substituted aminoindanes'],
    [/phenidate/, 'Substituted phenidates'],
    [/racetam/, 'Racetams'],
    [/gabapentinoid/, 'Gabapentinoids'],
    [/phenothiazine/, 'Phenothiazines'],
    [/tricyclic/, 'Tricyclic antidepressants'],
    [/selective serotonin reuptake inhibitor/, 'SSRIs'],
    [/serotonin.norepinephrine reuptake inhibitor/, 'SNRIs'],
    [/monoamine oxidase inhibitor/, 'MAOIs'],
    [/butyrophenone/, 'Butyrophenones'],
    [/morphinan/, 'Morphinans'],
    [/xanthine/, 'Xanthines'],
];
function familyOf(d) {
    const k = kindText(d);
    return FAMILIES.find(([re]) => re.test(k))?.[1] ?? '';
}

/** The groups TripSit's matrix and the combination lists speak of. */
function groupsOf(d, kind, family) {
    const k = kindText(d);
    const g = new Set();
    if (kind === 'Opioid') g.add('opioids');
    if (/benzodiazepine|thienodiazepine/i.test(family)) g.add('benzodiazepines');
    if (family === 'Barbiturates') g.add('barbiturates');
    if (/selective serotonin reuptake inhibitor/.test(k) || d.atc.some(c => c.startsWith('N06AB'))) g.add('ssris');
    if (/monoamine oxidase inhibitor/.test(k) || d.atc.some(c => c.startsWith('N06AF') || c.startsWith('N06AG'))) g.add('maois');
    if (family === 'Substituted amphetamines') g.add('amphetamines');
    if (/nbome/i.test(d.en ?? '')) g.add('nbomes');
    return [...g];
}

const slug = s =>
    s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[α]/g, 'a')
        .replace(/[β]/g, 'b')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
const squash = s => s.toLowerCase().replace(/[^a-z0-9À-￿]+/g, '');
const STEREO = /^\s*(\(\s*[+\-−±RSrsEZ,\s]*\)|[dl]-|levo|dextro|rac-|\(rs\)-|\(r\)-|\(s\)-|\(±\)-)/i;

/** The name to show: the label, unless it's a systematic name a line long
 *  and the item has a short code people use (JWH-018). */
function displayName(d) {
    const en = d.en ?? '';
    const systematic = /[[\]()]|\d,\d|\d-[a-z]{2,}/i.test(en) && en.length > 18;
    if (systematic) {
        const code = d.aliasEn.filter(a => a.length <= 14 && /^[A-Za-z0-9][A-Za-z0-9 .\-]*$/.test(a) && /[A-Za-z]/.test(a) && !SALT.test(a)).sort((x, y) => x.length - y.length)[0];
        if (code) return code;
    }
    // "(+)-butaclamol" is listed as butaclamol: the isomer is in its aliases.
    let plain = en.replace(/^\((?:[+\-−±]|R|S|RS|[RS](?:,\s*[RS])+)\)-/i, '');
    // "lecozotan hydrochloride" is lecozotan.
    const base = plain.replace(SALT, '').replace(/\s{2,}/g, ' ').trim();
    if (base.length >= 3 && base !== plain && !/[(,]$/.test(base)) plain = base;
    plain = plain.replace(/\s+free base$/i, '');
    // "ORPHENADRINE" as a word, Orphenadrine; a code (MDMA) keeps its capitals.
    if (/^[A-Z]{8,}$/.test(plain)) plain = plain.charAt(0) + plain.slice(1).toLowerCase();
    // "aad-2004" as people write it, AAD-2004.
    const cased = /^[a-z0-9-]+$/.test(plain) ? d.aliasEn.find(a => a.toLowerCase() === plain.toLowerCase() && a !== plain && /[A-Z]/.test(a) && !/^[A-Z]{7,}$/.test(a)) : undefined;
    if (cased) plain = cased;
    if (plain.length <= 36) return /^[a-z]/.test(plain) ? plain.charAt(0).toUpperCase() + plain.slice(1) : plain;
    const short = d.aliasEn.filter(a => a.length <= 24 && /[A-Za-z]/.test(a) && !SALT.test(a)).sort((x, y) => x.length - y.length)[0];
    return short ?? en;
}

/* ── run ─────────────────────────────────────────────────────────────── */

const index = JSON.parse(await fs.readFile(path.join(DATA, 'index.json'), 'utf8')).filter(e => e.src !== 'wd');
const structures = await readStructures(ROOT);

const byKind = await cached('candidates', candidates);
const listHints = await fromLists();
const lawItems = await cached('controlled', controlled);
const ids = [...new Set([...byKind, ...Object.keys(listHints), ...lawItems])];
console.log(`${byKind.length} by kind and medicine, ${Object.keys(listHints).length} from lists, ${lawItems.length} controlled: ${ids.length} candidates`);

// Each item's details are cached; only the ones not seen before are fetched.
const info = await cached('details', () => details(ids));
const missing = ids.filter(q => !info[q]);
if (missing.length) {
    if (writeOnly) throw new Error(`${missing.length} items have no details cached: run without --write`);
    Object.assign(info, await details(missing));
    await fs.writeFile(path.join(CACHE, 'details.json'), JSON.stringify(info));
}
// What a list said of an item counts as one more thing it is.
for (const [q, hints] of Object.entries(listHints))
    if (info[q]) {
        info[q].hints = hints.filter(h => h !== 'listed');
        info[q].listed = true;
    }
const controlledSet = new Set(lawItems);
const kindSet = new Set(byKind);
// Words that say a compound acts on the mind, or is taken as a drug.
const DRUGGY = /\b(drugs?|psychedelic|hallucinogen\w*|opioid|opiate|analgesic|stimulant|depressant|sedative|hypnotic|anxiolytic|antidepressant|antipsychotic|neuroleptic|entactogen|empathogen|dissociative|cannabinoid|deliriant|agonist|antagonist|reuptake|recreational|designer|medication|anaesthetic|anesthetic|narcotic|psychoactive|research chemical|nootropic|anticonvulsant|antiepileptic|benzodiazepine|barbiturate|psychotropic|euphori\w*|serotonergic|dopaminergic|cannabis|nmda)\b/i;
const onlyFamily = new Set(await cached('family-only', familyOnly));
const keyOf = await cached('existing-keys', () => existingKeys(structures));

// Existing entries: their Wikidata item, by InChIKey of the compound drawn for them.
const existingByBlock = new Map();
for (const e of index) {
    const s = structures[e.id];
    if (!s || s.role !== 'self') continue;
    const key = keyOf[s.cid];
    if (key) existingByBlock.set(key.slice(0, 14), e.id);
}
const existingItems = await cached('existing-items', () => itemsForKeys(Object.values(keyOf)));
const extraIds = [...new Set(existingItems.map(r => r.q))].filter(q => !info[q]);
if (extraIds.length && !writeOnly) Object.assign(info, await cached('existing-details', () => details(extraIds)));
else Object.assign(info, await cached('existing-details', async () => ({})));

const existingNames = new Map();
for (const e of index) {
    existingNames.set(squash(e.name), e.id);
    existingNames.set(squash(e.id), e.id);
}

/** How well an item describes an existing entry. Items share the first block
 *  of an InChIKey with their isomers and labelled copies (ketamine and
 *  esketamine, mescaline and 4-D, its deuterated twin), so the block alone
 *  picked whichever came last. The entry's own name counts most, then the
 *  exact key and an article of its own; an isomer or a salt counts against.
 *  Below 2, it isn't linked:
 *  no link beats a wrong one. */
const entryById = new Map(index.map(e => [e.id, e]));
function fit(d, id) {
    const e = entryById.get(id);
    if (!e) return 0;
    const names = new Set([e.name, e.id, ...String(e.aliases ?? '').split(',')].map(squash).filter(n => n.length >= 3));
    const s = structures[id];
    const key = s && s.role === 'self' ? keyOf[s.cid] : null;
    return (
        ([d.en, d.enwiki, ...(d.aliasEn ?? [])].some(n => n && names.has(squash(n))) ? 4 : 0) +
        (key && d.keys.includes(key) ? 2 : 0) -
        (STEREO.test(d.en) || SALT.test(d.en) ? 1 : 0) +
        // The item with the encyclopedia article is the substance's own.
        (d.enwiki ? 1.5 : 0)
    );
}

// What each item is to the site: an existing entry it describes, or a new one.
const enrich = new Map(); // existing id → item
const fresh = new Map(); // structure block → items
for (const d of Object.values(info)) {
    if (!d.en || !d.cids.length) continue;
    if (d.kinds.some(k => NOT_SUBSTANCE.test(k))) continue;
    if (d.atc.length && d.atc.every(c => /^N01B|^N02B|^N02C/.test(c)) && !/cocaine/i.test(d.en)) continue;
    const block = d.keys[0]?.slice(0, 14);
    const sameBlock = block && existingByBlock.get(block);
    const sameName = existingNames.get(squash(d.en));
    const target = sameBlock ?? sameName;
    if (target) {
        const prev = enrich.get(target);
        if (fit(d, target) >= 2 && (!prev || fit(d, target) > fit(prev, target))) enrich.set(target, d);
        continue;
    }
    const g = block ?? `cid${Math.min(...d.cids)}`;
    if (!fresh.has(g)) fresh.set(g, []);
    fresh.get(g).push(d);
}

// One entry per compound: its isomers and salts are names of the same thing.
const added = [];
const taken = new Set(index.map(e => e.id));
const takenNames = new Set(index.map(e => squash(e.name)));
for (const group of fresh.values()) {
    group.sort(
        (a, b) =>
            Number(!a.enwiki) - Number(!b.enwiki) ||
            Number(STEREO.test(a.en)) - Number(STEREO.test(b.en)) ||
            Number(SALT.test(a.en)) - Number(SALT.test(b.en)) ||
            a.en.length - b.en.length,
    );
    const d = group[0];
    if (SALT.test(d.en) && group.length === 1 && !d.enwiki) continue; // a lone salt of something listed elsewhere
    const name = displayName(d);
    if (takenNames.has(squash(name))) continue;
    for (const o of group.slice(1)) {
        for (const a of [o.en, ...o.aliasEn]) if (a && !d.aliasEn.includes(a)) d.aliasEn.push(a);
        d.enwiki ??= o.enwiki;
        d.kinds.push(...o.kinds);
        d.atc.push(...o.atc);
        d.ix.push(...o.ix);
        d.listed ||= o.listed;
        (d.hints ??= []).push(...(o.hints ?? []));
    }
    let id = slug(name);
    if (!id || id.length > 48 || taken.has(id)) id = d.q.toLowerCase();
    if (taken.has(id)) continue;
    taken.add(id);
    takenNames.add(squash(name));
    added.push({ id, name, d });
}

// Wikipedia's opening lines, for the new entries and the old ones it covers.
const wanted = [...added.map(a => a.d), ...enrich.values()];
const enTitles = [...new Set(wanted.map(d => d.enwiki).filter(Boolean))];
/** Extracts are cached by title; only titles not asked for before are fetched. */
async function extractsCached(lang, titles) {
    const file = path.join(CACHE, `extracts-${lang}.json`);
    let have = {};
    try {
        if (!refetch) have = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        /* none yet */
    }
    const todo = titles.filter(t => !(t in have));
    if (todo.length && !writeOnly) {
        const got = await extracts(lang, todo);
        for (const t of todo) have[t] = got[t] ?? '';
        await fs.mkdir(CACHE, { recursive: true });
        await fs.writeFile(file, JSON.stringify(have));
    }
    return have;
}
const enText = await extractsCached('en', enTitles);

const plainAliases = (d, name) =>
    [...new Set(d.aliasEn.filter(a => a.length <= 40 && squash(a) !== squash(name) && !SALT.test(a)))].slice(0, 8);

function links(d, name) {
    const out = [];
    if (d.enwiki)
        out.push({ title: 'Wikipedia', description: 'Encyclopedia article', url: `https://en.wikipedia.org/wiki/${encodeURIComponent(d.enwiki.replace(/ /g, '_'))}` });
    out.push({ title: 'Wikidata', description: `Structured data on ${name}`, url: `https://www.wikidata.org/wiki/${d.q}` });
    out.push({ title: 'PubChem', description: 'Chemistry, safety and literature', url: `https://pubchem.ncbi.nlm.nih.gov/compound/${Math.min(...d.cids)}` });
    return out;
}

await fs.mkdir(SUBS, { recursive: true });
// Clear out the entries this script wrote last time.
for (const f of await fs.readdir(SUBS)) {
    const p = path.join(SUBS, f);
    try {
        const j = JSON.parse(await fs.readFile(p, 'utf8'));
        if (j.source === 'Wikidata') await fs.unlink(p);
    } catch {
        /* not ours */
    }
}

const newEntries = [];
const excluded = {};
for (const { id, name, d } of added) {
    const kind = kindOf(d);
    if (NOT_DRUGS.test(name)) continue;
    const drop = why => {
        (excluded[why] ??= []).push(name);
        return true;
    };
    if (kind === 'Other' && !d.atc.length && !controlledSet.has(d.q) && drop(kindSet.has(d.q) ? 'other-kind' : 'other-list')) continue;
    if (onlyFamily.has(d.q) && !d.atc.length && !d.listed && drop('family-only')) continue;
    // Its description, its kinds, or the sentence that says what it is ("Thiophene is a heterocyclic compound" doesn't).
    const says = `${d.dEn ?? ''} ${d.kinds.join(' ')} ${(enText[d.enwiki] ?? '').split(/(?<=[.!?])\s/)[0]}`;
    if (!kindSet.has(d.q) && !d.atc.length && !DRUGGY.test(says) && kindByName(d) === 'Other' && drop('not-druggy')) continue;
    const family = familyOf(d);
    const groups = groupsOf(d, kind, family);
    const aliases = plainAliases(d, name);
    const summary = opening(enText[d.enwiki]);
    const ix = [...new Set(d.ix)].slice(0, 24);
    const detail = {
        id,
        name,
        form: d.atc.length ? 'tablet' : 'capsule',
        status: 'Reference',
        source: 'Wikidata',
        wikidata: d.q,
        aliases: aliases.join(', '),
        category: kind,
        chemicalClass: family,
        groups,
        atc: [...new Set(d.atc)],
        summary,
        summarySources: summary ? 'Wikipedia' : '',
        doseUnit: '',
        doseRows: [],
        durationRows: [],
        subjectiveEffects: [],
        combinations: ix.map(o => ({
            substance: o,
            status: 'Caution',
            note: 'Listed as a significant drug interaction on Wikidata.',
        })),
        citations: [],
        helpfulLinks: links(d, name),
    };
    await fs.writeFile(path.join(SUBS, `${id}.json`), JSON.stringify(detail));
    newEntries.push({
        id,
        name,
        aliases: aliases.join(', '),
        category: kind,
        form: detail.form,
        status: 'Reference',
        chemicalClass: family,
        primaryBand: null,
        primaryDuration: null,
        richness: summary ? 2 : 0,
        ...(groups.length ? { groups } : {}),
        src: 'wd',
        cid: Math.min(...d.cids),
    });
}

// The old entries gain Wikipedia's opening lines and links. Anything an
// earlier run wrote in another language comes out.
const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
// Names a source wrote in capitals that are words, not codes.
const RENAME = { 'yerba-mate': 'Yerba mate', 'huperzine-a': 'Huperzine A' };
let linked = 0;
for (const e of index) {
    delete e.zh;
    if (RENAME[e.id]) e.name = RENAME[e.id];
    e.aliases = e.aliases
        .split(',')
        .map(a => a.trim())
        .filter(a => a && !CJK.test(a))
        .join(', ');
    const file = path.join(SUBS, `${e.id}.json`);
    let detail;
    try {
        detail = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        continue;
    }
    if (RENAME[e.id]) detail.name = RENAME[e.id];
    delete detail.zh;
    delete detail.summaryZh;
    delete detail.zhAliases;
    detail.helpfulLinks = (detail.helpfulLinks ?? []).filter(l => !/zh\.wikipedia\.org/.test(l.url) && !CJK.test(l.title));
    // This script's own links from before go; the item linked now adds its own.
    detail.helpfulLinks = detail.helpfulLinks.filter(
        l => !(l.description === 'Encyclopedia article' || /^Structured data on /.test(l.description) || l.description === 'Chemistry, safety and literature'),
    );
    delete detail.wikidata;
    const d = enrich.get(e.id);
    if (d) {
        linked++;
        detail.wikidata = d.q;
        if (!detail.summary) {
            const en = opening(enText[d.enwiki]);
            if (en) {
                detail.summary = en;
                detail.summarySources = 'Wikipedia';
            }
        }
        const have = new Set(detail.helpfulLinks.map(l => l.url));
        for (const l of links(d, e.name)) if (!have.has(l.url) && l.title !== 'PubChem') detail.helpfulLinks.push(l);
    }
    await fs.writeFile(file, JSON.stringify(detail));
}

// The old entries keep their order (best documented first); the new ones follow, A to Z.
newEntries.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
const all = [...index, ...newEntries];
await fs.writeFile(path.join(DATA, 'index.json'), JSON.stringify(all));

const added_ = {};
for (const e of newEntries) added_[e.category] = (added_[e.category] ?? 0) + 1;
console.log(`${index.length} entries kept, ${linked} linked to Wikidata, ${newEntries.length} added: ${all.length} in all`);
console.log(added_);
for (const [why, names] of Object.entries(excluded)) console.log(`left out (${why}): ${names.length}, e.g. ${names.slice(0, 14).join('; ')}`);
if (process.env.LIST_LEFT_OUT) await fs.writeFile(process.env.LIST_LEFT_OUT, JSON.stringify(excluded, null, 1));
