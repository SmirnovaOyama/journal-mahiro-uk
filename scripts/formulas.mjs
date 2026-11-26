// Each substance's chemical formula and molar mass: `formula` ("C8H10N4O2")
// and `molarMass` (in g/mol) on every substance whose drawing is of the
// substance itself. A plant, a mixture or a family of drugs is drawn as its
// main compound or its parent structure (scripts/fetch-structures.mjs) and
// has no formula of its own, so it gets none.
//
// From PubChem, by the same compound number the drawing was made from.
//
//   node scripts/formulas.mjs            fetch what isn't cached, then write
//   node scripts/formulas.mjs --refetch  fetch everything again
//   node scripts/formulas.mjs --write    only write, from the cache
//
// Run after fetch-structures.mjs, which settles each substance's compound.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStructures } from './lib/structures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public/data/substances');
const CACHE = path.join(ROOT, 'scripts/.cache/formulas.json');
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const refetch = process.argv.includes('--refetch');
const offline = process.argv.includes('--write');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const structures = await readStructures(ROOT);
let known = {};
if (!refetch)
    try {
        known = JSON.parse(await fs.readFile(CACHE, 'utf8'));
    } catch {
        /* first run */
    }

const cids = [...new Set(Object.values(structures).filter(s => s?.role === 'self').map(s => s.cid))];
const unknown = cids.filter(c => !(c in known));
if (unknown.length && !offline) {
    console.log(`Asking PubChem for the formula of ${unknown.length} compounds…`);
    for (let i = 0; i < unknown.length; i += 150) {
        const part = unknown.slice(i, i + 150);
        let json = null;
        for (let k = 0; k < 5 && !json; k++) {
            try {
                const res = await fetch('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/property/MolecularFormula,MolecularWeight/JSON', {
                    method: 'POST',
                    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `cid=${part.join(',')}`,
                });
                if (res.ok) json = await res.json();
                else await sleep(2000 * (k + 1));
            } catch {
                await sleep(2000 * (k + 1));
            }
        }
        if (!json) throw new Error('PubChem gave no answer');
        for (const c of part) known[c] = null;
        for (const p of json.PropertyTable?.Properties ?? []) if (p.MolecularFormula) known[p.CID] = { formula: p.MolecularFormula, mass: Number(p.MolecularWeight) || null };
        await fs.mkdir(path.dirname(CACHE), { recursive: true });
        await fs.writeFile(CACHE, JSON.stringify(known));
        await sleep(400);
    }
}

let given = 0;
const files = (await fs.readdir(DIR)).filter(f => f.endsWith('.json'));
for (const f of files) {
    const file = path.join(DIR, f);
    const d = JSON.parse(await fs.readFile(file, 'utf8'));
    const s = structures[d.id];
    const got = s?.role === 'self' ? known[s.cid] : null;
    const before = JSON.stringify([d.formula, d.molarMass]);
    delete d.formula;
    delete d.molarMass;
    if (got) {
        d.formula = got.formula;
        if (got.mass) d.molarMass = got.mass;
        given++;
    }
    if (JSON.stringify([d.formula, d.molarMass]) !== before) await fs.writeFile(file, JSON.stringify(d));
}
console.log(`${given} of ${files.length} substances have a chemical formula.`);
