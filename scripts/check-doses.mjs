// Checks every route's doses, and mends the ones that don't add up.
//
// Each dose row has its ranges as text ("800–1500 μg") and as numbers for the
// rail (`segments`, `domain`, `band`), in the row's own unit. Read without
// their units, ranges that change unit came out wrong: "800–1500 μg" on an mg
// row became 800–1500 mg, "750 μg–1 mg" became 1 to 750. And a few source
// texts have slips ("40–20 mg", "650–1.6 mg" for 650 mg to 1.6 g).
//
// A row is sound when its levels rise (light, common, strong, heavy, each
// starting where or after the one before) and sit on its rail. One that isn't
// is read again from its text, with each number in its own unit, after the
// corrections below, and its rail is drawn again as scripts/sync-substances.mjs
// draws one. Anything still unsound is reported, and the run fails.
//
//   node scripts/check-doses.mjs

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'public/data/substances');

/** Slips in the source text, by substance and route. */
const CORRECT = {
    'hxe|Insufflated': { light: '20–40 mg' },
    'aspirin|Oral': { strong: '650 mg–1.6 g', heavy: '1.6 g+' },
    'butyrfentanyl|Oral': { heavy: '3 mg+' },
    'centrophenoxine|Oral': { heavy: '1000 mg+' },
    '25b-nboh|Sublingual': { heavy: '1 mg+' },
};

const MASS = { g: 1e6, mg: 1e3, μg: 1, µg: 1, ug: 1, mcg: 1, ng: 1e-3 };
const unitOf = u => (u ?? '').trim().replace('µ', 'μ');

/** "800–1500 μg", "750 μg–1 mg", "3 mg+", "1.6 g" → [lo, hi | null] in `unit`. */
function range(text, unit) {
    if (!text) return null;
    const t = text.replace(/\.$/, '').trim();
    const open = /\+$/.test(t);
    const parts = t.replace(/\+$/, '').split(/\s*[–—]\s*|\s+-\s+|(?<=\d)\s*-\s*(?=\d)/);
    const nums = parts.map(p => {
        const m = /^([\d.]+)\s*([a-zA-Zμµ]+)?/.exec(p.trim());
        return m ? { v: Number(m[1]), u: m[2] ? unitOf(m[2]) : null } : null;
    });
    if (nums.some(n => !n)) return null;
    // A unit given once, after the last number, is every number's.
    const last = nums[nums.length - 1].u ?? unitOf(unit);
    const to = unitOf(unit);
    const conv = n => {
        const u = n.u ?? last;
        if (u === to) return n.v;
        return MASS[u] && MASS[to] ? (n.v * MASS[u]) / MASS[to] : NaN;
    };
    const vals = nums.map(conv);
    if (vals.some(v => !Number.isFinite(v))) return null;
    return open || vals.length === 1 ? [vals[0], open ? null : vals[0]] : [vals[0], vals[1]];
}

const round = v => Number(v.toPrecision(4));

/** Its rail again, from its ranges, as the sync draws one. */
function redraw(r) {
    const light = range(r.light, r.unit);
    const common = range(r.common, r.unit);
    const strong = range(r.strong, r.unit);
    const heavy = range(r.heavy, r.unit);
    const threshold = range(r.threshold, r.unit);
    if (!common) return false;
    const lo = common[0];
    const hi = common[1] ?? common[0] * 1.5;
    const lightMin = light?.[0] ?? threshold?.[0] ?? Math.max(0.1, lo * 0.4);
    const lightMax = light?.[1] ?? lo;
    const strongMin = strong?.[0] ?? hi;
    const strongMax = strong?.[1] ?? heavy?.[0] ?? hi * 1.75;
    const heavyMin = heavy?.[0] ?? strongMax;
    const domainMin = Math.max(0.05, Math.min(threshold?.[0] ?? lightMin, lightMin) * 0.8);
    const domainMax = Math.max(heavyMin * 1.35, hi * 2.2);
    r.segments = {
        light: [round(lightMin), round(lightMax)],
        common: [round(lo), round(hi)],
        strong: [round(strongMin), round(strongMax)],
        heavy: [round(heavyMin), round(domainMax * 0.96)],
    };
    r.domain = [round(domainMin), round(domainMax)];
    r.band = { low: round(lo), high: round(hi) };
    r.commonEstimate = round((lo + hi) / 2);
    return true;
}

/** What's wrong with a row's rail, if anything. */
function problems(r) {
    const seg = r.segments ?? {};
    const order = ['light', 'common', 'strong', 'heavy'].filter(k => seg[k]);
    const out = [];
    for (const k of order) if (seg[k][0] > seg[k][1]) out.push(`${k} runs backwards`);
    for (let i = 1; i < order.length; i++) if (seg[order[i - 1]][0] > seg[order[i]][0] + 1e-9) out.push(`${order[i - 1]} starts after ${order[i]}`);
    const lowest = order.length ? seg[order[0]][0] : null;
    const highest = order.length ? Math.max(...order.map(k => seg[k][1])) : null;
    if (r.domain && lowest != null && (lowest < r.domain[0] - 1e-9 || highest > r.domain[1] + 1e-9)) out.push('off its rail');
    if (r.band && r.band.low > r.band.high) out.push('band runs backwards');
    return out;
}

let mended = 0;
const left = [];
for (const f of (await fs.readdir(DIR)).filter(f => f.endsWith('.json'))) {
    const file = path.join(DIR, f);
    const d = JSON.parse(await fs.readFile(file, 'utf8'));
    let changed = false;
    for (const r of d.doseRows ?? []) {
        const fix = CORRECT[`${d.id}|${r.roa}`];
        if (!problems(r).length && !fix) continue;
        if (fix) Object.assign(r, fix);
        if (redraw(r)) {
            changed = true;
            mended++;
            console.log(`mended: ${d.name}, ${r.roa}`);
        }
        const still = problems(r);
        if (still.length) left.push(`${d.name}, ${r.roa}: ${still.join('; ')}`);
    }
    if (changed) await fs.writeFile(file, JSON.stringify(d));
}

console.log(`${mended} rows mended.`);
if (left.length) {
    console.error(`Still wrong:\n${left.join('\n')}`);
    process.exit(1);
}
console.log('Every route’s doses rise in order and sit on their rail.');
