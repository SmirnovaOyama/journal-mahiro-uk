// Doses and timings from FreeODwiki, for the substances that have none here.
//
// FreeODwiki (freeodwiki.org, CC BY-SA 4.0, github.com/SalviaSWC/FreeODwiki)
// is a Chinese-language wiki of drug entries. Most are laid out as
// PsychonautWiki's pages are, each with a table of doses and timings by
// route, and most of those are PsychonautWiki's own in translation,
// including drafts PsychonautWiki hasn't published: its API, which
// sync-substances.mjs reads, has no olanzapine, clozapine or amantadine.
//
// Only figures are taken, never prose: a route's ladder (threshold, light,
// common, strong, heavy) and its timings; and with them, said in English,
// the warnings the entry sets beside its doses. Only for a substance with
// no doses of its own: PsychonautWiki's and TripSit's stay as they are. Only
// where the entry is surely the substance's: by the name it gives itself, in
// English or, through Wikidata, in Chinese. A ladder that doesn't rise, mixes
// its units, or has a step that can't be read is left out whole.
//
// Its "OverdoseWiki" archive (文档/补档/Overdosewiki) is fetched with the rest
// and read, but its ladders aren't taken: they are in tablets for a 60 kg
// person, by its own account partly guessed, and for several medicines it
// refuses to give one.
//
//   node scripts/freeodwiki.mjs            fetch what isn't cached, then write
//   node scripts/freeodwiki.mjs --refetch  fetch everything again
//   node scripts/freeodwiki.mjs --write    only write, from the cache
//   node scripts/freeodwiki.mjs --dry      write nothing; says what it would give to what
//
// Run after sync-wikidata.mjs (which makes the reference entries) and before
// absorption.mjs and pharmacology.mjs, which read the dose rows.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'public/data');
const DIR = path.join(DATA, 'substances');
const CACHE = path.join(ROOT, 'scripts/.cache/freeodwiki');
const REPO = 'SalviaSWC/FreeODwiki';
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const refetch = process.argv.includes('--refetch');
const dry = process.argv.includes('--dry');
const offline = process.argv.includes('--write') || dry;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function readJson(file, fallback) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        return fallback;
    }
}

/* ── the entries, as their source ────────────────────────────────────── */

// Each entry's Markdown, at one commit, so a run can be repeated.
const store = refetch ? {} : await readJson(path.join(CACHE, 'pages.json'), {});
let sha = refetch ? '' : (await fs.readFile(path.join(CACHE, 'sha.txt'), 'utf8').catch(() => '')).trim();
if (!sha && !offline) {
    const api = async url => {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } });
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return res.json();
    };
    sha = (await api(`https://api.github.com/repos/${REPO}/commits/main`)).sha;
    const tree = await api(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
    const paths = tree.tree.filter(t => t.type === 'blob' && /^药物\/[^/]*\.md$|^文档\/补档\/Overdosewiki\/Drugs\/[^/]*\.md$/.test(t.path)).map(t => t.path);
    console.log(`Reading ${paths.length} FreeODwiki entries at ${sha.slice(0, 7)}…`);
    for (let i = 0; i < paths.length; i += 6) {
        await Promise.all(
            paths.slice(i, i + 6).map(async p => {
                const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${p.split('/').map(encodeURIComponent).join('/')}`, { headers: { 'User-Agent': UA } });
                store[p] = res.ok ? await res.text() : null;
            }),
        );
        await sleep(250);
    }
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(path.join(CACHE, 'pages.json'), JSON.stringify(store));
    await fs.writeFile(path.join(CACHE, 'sha.txt'), sha);
}

/* ── reading an entry ────────────────────────────────────────────────── */

const ROUTES = [
    [/口服|吞服/, 'Oral'],
    [/鼻吸|鼻腔|吸入鼻/, 'Insufflated'],
    [/舌下/, 'Sublingual'],
    [/颊/, 'Buccal'],
    [/直肠|塞肛/, 'Rectal'],
    [/静脉/, 'Intravenous'],
    [/肌内|肌肉/, 'Intramuscular'],
    [/皮下/, 'Subcutaneous'],
    [/透皮|经皮/, 'Transdermal'],
    [/蒸发|雾化|气化|汽化/, 'Vapourized'],
    [/抽吸|烟吸|吸烟|燃吸/, 'Smoked'],
    [/吸入/, 'Inhaled'],
];
const routeOf = text => ROUTES.find(([re]) => re.test(text))?.[1] ?? null;

const TIERS = [
    [/^(?:轻-)?(?:阈值|起效剂量)$/, 'threshold'],
    [/^(?:轻微|轻度|轻度剂量|轻-正常剂量)$/, 'light'],
    [/^(?:中等|中度|普通|中度剂量|中-正常剂量)$/, 'common'],
    [/^(?:强烈|强|高度剂量|重-正常剂量)$/, 'strong'],
    [/^(?:严重|重度|重度剂量|重-中毒剂量)$/, 'heavy'],
];
const TIMES = [
    [/^(?:药效发作|发作|起效|起效时)$/, 'onset'],
    [/^(?:药效上升|上升|来效时)$/, 'comeup'],
    [/^(?:药效达峰|达峰|顶峰时)$/, 'peak'],
    [/^(?:药效褪去|褪去|消退|退效时)$/, 'offset'],
    [/^(?:药效残余|残余|余效|残效时)$/, 'afterEffects'],
    [/^(?:总时长|总计|总效时)$/, 'total'],
];

/** A cell or a label without its Markdown: links, emphasis, escapes, arrows. */
const bare = s =>
    s
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[*_`\\]|🔽|⇣|⚠️|¶/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const UNITS = { mg: 'mg', 毫克: 'mg', g: 'g', 克: 'g', μg: 'μg', µg: 'μg', ug: 'μg', mcg: 'μg', 微克: 'μg', ml: 'mL', mL: 'mL', 毫升: 'mL', t: 't', 片: 't' };
const UNIT = '(毫克|微克|毫升|mg|mcg|μg|µg|ug|ml|mL|克|g|片|t)';
/** "20 ~ 50 mg", "< 1 mg", "500 mg +", "3+ 毫升", "1t~2t", "500mg以上": { min, max, unit }.
 *  The top of a ladder often carries a warning after its figure ("4 mL + 警告：…"):
 *  with `open`, what follows the plus is let be. A unit of something else
 *  ("mg THC", "毫克/千克体重") is no amount of the substance, and gives null. */
function amount(text, open = false) {
    const t = bare(text).replace(/&lt;|&gt;/g, '').replace(/^[<>≤≥=\s]+/, '').trim();
    const m = new RegExp(`^([\\d.]+)\\s*(\\+)?\\s*${UNIT}?\\s*(?:[-~～–—至到]\\s*([\\d.]+)\\s*${UNIT}?)?\\s*(\\+|以上)?(.*)$`).exec(t);
    if (!m) return null;
    const [, a, plusA, unitA, b, unitB, plusB, rest] = m;
    const unit = UNITS[unitB ?? unitA];
    if (!unit || (unitA && unitB && UNITS[unitA] !== UNITS[unitB])) return null;
    // What's left must be nothing, or (at the top of a ladder) come after a plus.
    if (rest.trim() && !(open && (plusA || plusB)) ) return null;
    if (/^\s*(?:THC|CBD|\/|每|／)/i.test(rest)) return null;
    const min = Number(a);
    const max = b != null ? Number(b) : min;
    if (!(min >= 0) || !(max >= min)) return null;
    return { min, max, unit };
}

/** "2 ~ 5 小时", "45 - 70 分钟", "1h~1h30min", "24h": minutes [min, max]. */
function span(text) {
    const t = bare(text).replace(/\s+/g, '');
    const one = s => {
        // "1h30min", "90min", "1.5小时", "45": hours and minutes, added up.
        let total = 0;
        let any = false;
        for (const m of s.matchAll(/([\d.]+)(小时|h|hr|分钟|min|秒|s|天|d)?/gi)) {
            const n = Number(m[1]);
            const u = (m[2] ?? '').toLowerCase();
            if (!(n >= 0)) return null;
            any = true;
            total += u === '' ? NaN : /小时|h/.test(u) ? n * 60 : /分钟|min/.test(u) ? n : /秒|^s$/.test(u) ? n / 60 : n * 1440;
        }
        return any ? total : null;
    };
    const parts = t.split(/[~～–—至到-]/);
    if (parts.length > 2 || !parts[0]) return null;
    // "2~5小时": the unit is said once, after the second figure.
    const unitOf = s => /(小时|h|hr|分钟|min|秒|天|d)$/i.exec(s)?.[1];
    let [a, b] = parts;
    if (b != null && /^[\d.]+$/.test(a) && unitOf(b)) a += unitOf(b);
    const lo = one(a);
    const hi = b != null ? one(b) : lo;
    if (lo == null || hi == null || Number.isNaN(lo) || Number.isNaN(hi) || hi < lo) return null;
    return [lo, hi];
}

/** What an entry says: its names, and for each route its ladder and timings as written. */
function read(file, md) {
    const archive = /Overdosewiki/.test(file);
    const lines = md.split('\n');
    const title = bare((/^#\s+(.+)$/m.exec(md)?.[1] ?? '').replace(/\^.*\^/, '').replace(/[（(].*$/, '')) || path.basename(file, '.md');
    const wiki = new Set();
    // The Wikipedia article the entry gives as its own.
    for (const m of md.matchAll(/\[([^\]]*)\]\(https?:\/\/en\.(?:m\.)?wikipedia\.org\/wiki\/([^)#\s]+)\)/g))
        if (archive ? /^wikipedia$/i.test(m[1].trim()) : /Wikipedia|维基/.test(m[1]) && (!title || m[1].includes(title))) wiki.add(decodeURIComponent(m[2]).replace(/_/g, ' '));
    // Its name in English, where the entry names itself, the surest first: the
    // file's own name ("2C-B.md"); after the Chinese in its heading ("# 苯海索
    // （Trihexyphenidyl, Benzhexol）") or in the bold that opens it ("**奥氮平
    // (Olanzapine, OZP)**"); the Wikipedia article it gives as its own; and
    // last its table's row of common names, where street names sit too.
    const english = text =>
        text
            .split(/[,，、;；/]/)
            .map(n => n.trim())
            .filter(n => /^[A-Za-z0-9α-ωΑ-Ω][A-Za-z0-9 .'’+α-ωΑ-Ω-]{2,50}$/.test(n) && /[A-Za-z]{3}/.test(n) && !/\.(md|png|jpg|svg)$/i.test(n));
    const stem = path.basename(file, '.md');
    const own = !archive && /^[\x20-\x7eα-ωΑ-Ω]+$/.test(stem) ? [stem] : [];
    const said = [];
    const heading = /^#\s+(.+)$/m.exec(md)?.[1] ?? '';
    for (const m of heading.matchAll(/[（(]([^（()）]+)[)）]/g)) said.push(...english(m[1]));
    const opening = /\*\*([^*\n]{1,40}?)[（(]([^（()）\n]+)[)）]\*\*/.exec(md.slice(0, 2500));
    if (opening) said.push(...english(opening[2]));
    const common = [];
    for (const m of md.slice(0, 4000).matchAll(/^\s*-?\s*\|\s*\**(?:常见名称|通用名|常用名称|俗名)\**\s*\|([^|\n]+)\|/gm)) for (const part of bare(m[1]).split(/[（()）]/)) common.push(...english(part));
    const names = [own, said, [...wiki], common];

    const routes = new Map();
    const at = r => routes.get(r) ?? routes.set(r, { roa: r, dose: {}, time: {} }).get(r);
    // The archive's ladders are for tablets by mouth, of a strength its heading gives ("10mg为1t").
    let cols = archive ? ['Oral'] : [];
    let tablet = null;
    let basis = null;
    for (const line of lines) {
        const h = /^#{2,5}\s*(.+)$/.exec(line.trim());
        if (h) {
            const r = routeOf(bare(h[1]));
            if (r && !archive && bare(h[1]).length < 12) cols = [r];
            const t = /([\d.]+)\s*(mg|g|μg|毫克)为1t/.exec(h[1]);
            if (t) tablet = { n: Number(t[1]), unit: UNITS[t[2]] };
            if (/剂量/.test(h[1]) && /60\s*kg/i.test(h[1])) basis = 60;
        }
        if (!archive && !line.includes('|') && /⇣|🔽/.test(line) && routeOf(bare(line))) {
            cols = [routeOf(bare(line))];
            continue;
        }
        const cells = line.includes('|')
            ? line
                  .replace(/^\s*-?\s*\|/, '')
                  .replace(/\|\s*$/, '')
                  .split('|')
                  .map(bare)
            : (() => {
                  // The archive writes a ladder as lines: "轻度剂量：1t~2t".
                  const m = /^\s*[*-]?\s*([^：:]{2,10})[：:]\s*(.+?)\s*$/.exec(bare(line));
                  return m ? [m[1], m[2]] : null;
              })();
        if (!cells || cells.length < 2) continue;
        // A row that is only a route's name ("| **抽吸** | |"), or ends on one after an arrow, heads that route's rows.
        if (!archive && cells.slice(1).every(c => !c)) {
            const raw = line.split('|').find(c => c.trim()) ?? '';
            const after = /(?:⇣|🔽)([^|]*)$/.exec(raw);
            const r = after ? routeOf(bare(after[1])) : cells[0].length <= 8 ? routeOf(cells[0]) : null;
            if (r) {
                cols = [r];
                continue;
            }
        }
        // A row that names the routes its columns are for.
        const named = cells.slice(1).map(routeOf);
        if (!archive && (/给药途径|警告|注意/.test(cells[0]) || cells.slice(1).every(c => c.length < 14)) && named.some(Boolean) && named.filter(Boolean).length === cells.slice(1).filter(c => c).length) {
            cols = named.filter(Boolean);
            continue;
        }
        const label = cells[0].replace(/\s/g, '');
        const tier = TIERS.find(([re]) => re.test(label))?.[1];
        const time = TIMES.find(([re]) => re.test(label))?.[1];
        if (!tier && !time) continue;
        cells.slice(1).forEach((cell, i) => {
            const roa = cols[i];
            if (!roa || !cell) return;
            if (tier) at(roa).dose[tier] ??= cell;
            else at(roa).time[time] ??= cell;
        });
    }
    // The warnings it sets beside its doses: the boxes under a death's head, and what a ladder's top says.
    const warned = lines.filter(l => l.includes('|') && (/Skull_and_crossbones|警告图标|致命|危及生命/.test(l) || /^\s*\|[^|]*(?:严重|重度)[^|]*\|/.test(l))).map(bare).join(' ');
    return { file, title, names, routes: [...routes.values()], tablet, basis, archive, warned };
}

/* ── a ladder, as the site keeps one ─────────────────────────────────── */

const formatNum = n => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

/** A dose row built as sync-substances.mjs builds PsychonautWiki's, or null
 *  if the ladder isn't whole: it needs its common band, one unit throughout,
 *  and steps that rise. */
function doseRow(route, tablet) {
    const tier = {};
    for (const k of ['threshold', 'light', 'common', 'strong', 'heavy']) {
        if (!route.dose[k]) continue;
        const a = amount(route.dose[k], k === 'heavy');
        // A top tier that is only a warning ("may be fatal") is as if not given; any other tier unread spoils the ladder.
        if (!a && k === 'heavy' && !/\d/.test(bare(route.dose[k]).slice(0, 6))) continue;
        if (!a) return null;
        // Tablets, at the strength the entry gives.
        if (a.unit === 't') {
            if (!tablet) return null;
            a.min *= tablet.n;
            a.max *= tablet.n;
            a.unit = tablet.unit;
        }
        tier[k] = a;
    }
    const units = new Set(Object.values(tier).map(a => a.unit));
    if (!tier.common || units.size !== 1) return null;
    const unit = [...units][0];
    const lo = tier.common.min;
    const hi = tier.common.max > lo ? tier.common.max : (tier.strong?.min ?? lo * 1.5);
    const lightMin = tier.light?.min ?? tier.threshold?.min ?? Math.max(0.1, lo * 0.4);
    const lightMax = tier.light?.max ?? lo;
    const strongMin = tier.strong?.min ?? hi;
    const strongMax = tier.strong && tier.strong.max > tier.strong.min ? tier.strong.max : (tier.heavy?.min ?? hi * 1.75);
    const heavyMin = tier.heavy?.min ?? strongMax;
    // Each step at or above the one before.
    const steps = [tier.threshold?.min ?? lightMin, lightMin, lightMax, lo, hi, strongMin, strongMax, heavyMin];
    if (steps.some((v, i) => i && v < steps[i - 1]) || !(hi > lo) || !(heavyMin > lo)) return null;
    const domainMin = Math.max(0.05, Math.min(tier.threshold?.min ?? lightMin, lightMin) * 0.8);
    const domainMax = Math.max(heavyMin * 1.35, hi * 2.2);
    const n = v => Number(formatNum(v));
    return {
        roa: route.roa,
        source: 'FreeODwiki',
        unit,
        ...(tier.threshold ? { threshold: `${formatNum(tier.threshold.min)} ${unit}` } : {}),
        light: `${formatNum(lightMin)}–${formatNum(lightMax)} ${unit}`,
        common: `${formatNum(lo)}–${formatNum(hi)} ${unit}`,
        strong: `${formatNum(strongMin)}–${formatNum(strongMax)} ${unit}`,
        heavy: `${formatNum(heavyMin)} ${unit}+`,
        commonEstimate: Number(((lo + hi) / 2).toFixed(lo < 5 ? 2 : 0)),
        band: { low: n(lo), high: n(hi) },
        domain: [n(domainMin), n(domainMax)],
        segments: { light: [n(lightMin), n(lightMax)], common: [n(lo), n(hi)], strong: [n(strongMin), n(strongMax)], heavy: [n(heavyMin), n(domainMax * 0.96)] },
    };
}

/** "45–70 min", "2–5 h", as the other rows write a span. */
function spanText([lo, hi]) {
    const [n, u] = hi >= 120 ? [60, 'h'] : hi < 2 ? [1 / 60, 's'] : [1, 'min'];
    const a = formatNum(lo / n);
    const b = formatNum(hi / n);
    return a === b ? `${a} ${u}` : `${a}–${b} ${u}`;
}
function durationRow(route) {
    const out = { roa: route.roa };
    for (const k of ['onset', 'comeup', 'peak', 'offset', 'afterEffects', 'total']) {
        const s = route.time[k] ? span(route.time[k]) : null;
        out[k] = s ? spanText(s) : '—';
    }
    return out.onset === '—' && out.peak === '—' && out.total === '—' ? null : out;
}

/* ── its warnings ────────────────────────────────────────────────────── */

// Figures aren't taken without the warnings set beside them. These are the
// ones the entries carry (PsychonautWiki's standard boxes, in translation),
// said in English: each is added where the entry says it.
const WARNINGS = [
    [/心脏并发症/, name => `${name} can cause life-threatening heart complications and death: its source strongly advises against large doses.`],
    [/对乙酰氨基酚/, () => 'Cold medicines that combine it with paracetamol can kill in overdose.'],
    [/(?:抑制剂|GABA).{0,60}(?:致命|过量)|(?:致命|过量).{0,60}抑制剂/, () => 'Taken with other depressants (opioids, benzodiazepines, barbiturates, gabapentinoids, alcohol), it can cause a fatal overdose.'],
    [/精神病发作|躁狂/, () => 'Heavy doses can bring on psychosis and mania.'],
];
const warningsOf = (entry, name) => WARNINGS.filter(([re]) => re.test(entry.warned)).map(([, say]) => say(name));

/* ── whose entry it is ───────────────────────────────────────────────── */

const squash = s => s.toLowerCase().replace(/[^a-z0-9α-ω]+/g, '');
const index = JSON.parse(await fs.readFile(path.join(DATA, 'index.json'), 'utf8'));
const details = new Map();
for (const e of index) details.set(e.id, JSON.parse(await fs.readFile(path.join(DIR, `${e.id}.json`), 'utf8')));

// By name, and by the Wikipedia article each substance links to.
const byName = new Map();
const byArticle = new Map();
const put = (map, key, id) => key && map.set(key, map.has(key) && map.get(key) !== id ? null : id);
for (const e of index) {
    put(byName, squash(e.name), e.id);
    put(byName, squash(e.id), e.id);
    for (const l of details.get(e.id).helpfulLinks ?? []) {
        const m = /en\.wikipedia\.org\/wiki\/(.+)$/.exec(l.url);
        if (m) put(byArticle, squash(decodeURIComponent(m[1])), e.id);
    }
}
// An alias only where no substance has it for a name ("speed" is no one's name).
for (const e of index) for (const a of String(e.aliases ?? '').split(',')) if (a.trim() && !byName.has(squash(a))) put(byName, squash(a), e.id);

// Each substance's names in Chinese, from Wikidata: what an entry titled only
// in Chinese (氟马西尼, 氯氮䓬) is placed by.
const ZH = path.join(CACHE, 'zh-names.json');
const zhNames = refetch ? {} : await readJson(ZH, {});
const linked = [...new Set([...details.values()].map(d => d.wikidata).filter(Boolean))];
const nameless = linked.filter(q => !(q in zhNames));
if (nameless.length && !offline) {
    console.log(`Asking Wikidata for the Chinese names of ${nameless.length} substances…`);
    for (let i = 0; i < nameless.length; i += 250) {
        const part = nameless.slice(i, i + 250);
        for (const q of part) zhNames[q] = [];
        const res = await fetch('https://query.wikidata.org/sparql', {
            method: 'POST',
            headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `query=${encodeURIComponent(`SELECT ?item ?n WHERE { VALUES ?item { ${part.map(q => `wd:${q}`).join(' ')} } { ?item rdfs:label ?n } UNION { ?item skos:altLabel ?n } FILTER(STRSTARTS(LANG(?n), "zh")) }`)}`,
        });
        if (!res.ok) throw new Error(`Wikidata: ${res.status}`);
        for (const b of (await res.json()).results.bindings) {
            const q = b.item.value.slice(b.item.value.lastIndexOf('/') + 1);
            if (!zhNames[q].includes(b.n.value)) zhNames[q].push(b.n.value);
        }
        await sleep(600);
    }
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(ZH, JSON.stringify(zhNames));
}
const byZh = new Map();
for (const d of details.values()) for (const n of zhNames[d.wikidata] ?? []) put(byZh, n, d.id);

/** The substance an entry is about: the one its surest name names. Two
 *  substances for names of one kind (a page on a pair, a street name two
 *  drugs share) is no answer. */
function owner(entry) {
    if (/[+＋]|与|和/.test(entry.title) && !/^[\x20-\x7e]+$/.test(entry.title)) return null;
    for (const tier of entry.names) {
        // A substance's own name before an article some other entry links to (coca's is Cocaine's).
        const found = new Set(tier.map(n => byName.get(squash(n)) ?? byArticle.get(squash(n))).filter(Boolean));
        if (found.size > 1) return null;
        if (found.size === 1) return [...found][0];
    }
    // No English name that's a substance's here: its Chinese title, as Wikidata has it.
    return byZh.get(entry.title) ?? null;
}

/* ── put together ───────────────────────────────────────────────────── */

const entries = Object.entries(store)
    .filter(([file, md]) => md && !/\/index\.md$/.test(file))
    .map(([file, md]) => read(file, md));

const given = [];
const unplaced = [];
const taken = new Set();
for (const entry of entries) {
    // The archive's ladders aren't taken (see the top of this file).
    if (entry.archive) continue;
    const rows = entry.routes.map(r => ({ dose: doseRow(r, entry.tablet), time: durationRow(r) })).filter(r => r.dose);
    if (!rows.length) continue;
    const id = owner(entry);
    if (!id) {
        unplaced.push(`${entry.title} (${entry.names.flat().join(', ') || 'no English name'})`);
        continue;
    }
    const d = details.get(id);
    // Only a substance with no doses of its own, and only once.
    if ((d.doseRows ?? []).some(r => r.source !== 'FreeODwiki') || taken.has(id)) continue;
    taken.add(id);
    given.push({ id, entry, rows });
}

/** The first tick above a figure that reads as a round one, as sync-substances.mjs tops a rail. */
function niceCeiling(val) {
    if (!Number.isFinite(val) || val <= 0) return 100;
    const exp = 10 ** Math.floor(Math.log10(val));
    const nice = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(f => val / exp <= f) ?? 10;
    return Number((nice * exp).toFixed(2));
}

// What an earlier run gave comes out first, so that a run always starts from the substances' own.
const touched = new Set();
for (const d of details.values()) {
    const before = JSON.stringify(d);
    if ((d.doseRows ?? []).some(r => r.source === 'FreeODwiki')) {
        d.doseRows = d.doseRows.filter(r => r.source !== 'FreeODwiki');
        if (!d.doseRows.length) {
            d.doseUnit = '';
            delete d.doseMaxTick;
        }
    }
    if (d.durationSources === 'FreeODwiki') {
        d.durationRows = [];
        delete d.durationSources;
    }
    if (d.advisorySource === 'FreeODwiki') {
        delete d.advisory;
        delete d.advisorySource;
    }
    d.helpfulLinks = (d.helpfulLinks ?? []).filter(l => l.title !== 'FreeODwiki');
    if (JSON.stringify(d) !== before) touched.add(d.id);
}

for (const g of given) {
    const d = details.get(g.id);
    d.doseRows = g.rows.map(r => r.dose);
    d.doseUnit = d.doseRows[0].unit;
    d.doseMaxTick = niceCeiling(Math.max(...d.doseRows.filter(r => r.unit === d.doseUnit).map(r => r.domain[1])));
    const times = g.rows.map(r => r.time).filter(Boolean);
    if (times.length && !(d.durationRows ?? []).length) {
        d.durationRows = times;
        d.durationSources = 'FreeODwiki';
    }
    const warnings = warningsOf(g.entry, d.name);
    if (warnings.length && !d.advisory) {
        d.advisory = warnings.join(' ');
        d.advisorySource = 'FreeODwiki';
    }
    const page = g.entry.file.replace(/\.md$/, '.html').split('/').map(encodeURIComponent).join('/');
    d.helpfulLinks = [...(d.helpfulLinks ?? []), { title: 'FreeODwiki', description: 'Doses and timings, in Chinese', url: `https://freeodwiki.org/${page}` }];
    touched.add(d.id);
}

// The list every page reads says which substances have a dose to show.
for (const e of index) {
    if (!touched.has(e.id)) continue;
    const d = details.get(e.id);
    const dose = d.doseRows?.[0];
    const time = d.durationRows?.[0];
    e.primaryBand = dose ? { low: dose.band.low, high: dose.band.high, unit: dose.unit, roa: dose.roa } : null;
    e.primaryDuration = time ? { onset: time.onset, peak: time.peak, offset: time.offset, total: time.total } : null;
}

if (!dry) {
    for (const id of touched) await fs.writeFile(path.join(DIR, `${id}.json`), JSON.stringify(details.get(id)));
    if (touched.size) await fs.writeFile(path.join(DATA, 'index.json'), JSON.stringify(index));
}

console.log(`${entries.length} FreeODwiki entries read; ${given.length} substances with no doses of their own get its doses${dry ? ' (nothing written)' : ''}:`);
for (const g of given) {
    const d = details.get(g.id);
    console.log(`  ${d.name} ← ${g.entry.title}: ${g.rows.map(r => `${r.dose.roa} ${r.dose.common}${r.time ? `, ${r.time.total}` : ''}`).join('; ')}${d.advisorySource === 'FreeODwiki' ? ` ⚠ ${d.advisory}` : ''}`);
}
console.log(`\nWith a ladder but no substance here surely theirs (${unplaced.length}): ${unplaced.map(u => u.replace(/ \(.*$/, '')).join('; ')}`);
