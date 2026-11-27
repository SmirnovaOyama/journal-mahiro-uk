// Puts what an AI wrote into each substance's file, as its `ai` key, only
// where the sources left that section empty. Run last in `npm run data`,
// after the scripts that write the sourced sections, so a section a source
// fills later loses its AI words on the next run.
//
//   node scripts/ai-fill.mjs
//
// The words live in scripts/data/ai-written.json, keyed by substance id:
// { summary, pharmacology, uses, sideEffects, fact } each as
// { en, zh (正體中文), zhHans (简体中文, from OpenCC) }, and `contains`, the
// ids of a plant's or mixture's main compounds. They were written by Claude
// (Anthropic) on 2026-11-27 under rules kept with them (`rules` in the
// file): no doses, timings or half-lives, nothing on what mixes, and
// nothing where it didn't know. To take them all out, delete that file and
// run this again.

import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/data/substances';
const SOURCE = 'scripts/data/ai-written.json';
const TEXT = ['summary', 'pharmacology', 'uses', 'sideEffects', 'fact'];

const written = fs.existsSync(SOURCE) ? JSON.parse(fs.readFileSync(SOURCE, 'utf8')) : { entries: {} };
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
const all = new Map(files.map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))]));

// Is this section empty in what the sources gave?
const empty = (d, k) => {
    if (k === 'fact') return true;
    if (k === 'summary') return !d.summary;
    return !d[k]?.text;
};

const count = Object.fromEntries([...TEXT, 'contains'].map(k => [k, 0]));
let changed = 0;
for (const [id, d] of all) {
    const w = written.entries?.[id];
    const ai = {};
    if (w) {
        for (const k of TEXT) if (w[k]?.en && w[k]?.zh && empty(d, k)) ai[k] = w[k];
        // Each compound's formula is the catalogue's own, from PubChem: none
        // is taken from the AI.
        if (!d.formula && w.contains?.length) {
            const parts = w.contains
                .map(c => all.get(c))
                .filter(c => c?.formula)
                .map(c => ({ id: c.id, name: c.name, ...(c.zh ? { zh: c.zh } : {}), formula: c.formula }));
            if (parts.length) ai.contains = parts;
        }
    }
    const before = JSON.stringify(d.ai ?? null);
    if (Object.keys(ai).length) {
        d.ai = { by: written.by, date: written.date, ...ai };
        for (const k of Object.keys(ai)) if (k in count) count[k]++;
    } else delete d.ai;
    if (JSON.stringify(d.ai ?? null) !== before) {
        fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(d));
        changed++;
    }
}
console.log(`AI words in ${changed} files changed:`, count);
