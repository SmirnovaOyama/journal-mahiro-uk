// Writes public/data/structures.json: for each substance, the compound to
// draw and PubChem's own 2D drawing of it (the standard depiction, as
// PubChem, textbooks and Wikipedia lay the molecule out), as
//
//   { id: { cid, name, role, a: [[element, x, y, hydrogens, charge], …],
//                             b: [[from, to, order, stereo], …] } | null }
//
// x and y are PubChem's coordinates times 100. Hydrogens on an atom are a
// count, except one drawn with a wedge at a stereocentre, which stays an
// atom of its own. `role` says what the drawing is of:
//   self    the substance itself
//   active  a plant's or a mixture's main active compound (mushrooms: psilocybin)
//   core    a chemical family's parent structure (substituted tryptamines: tryptamine)
//   example the family's best-known member, where it has no single parent
//
//   node scripts/fetch-structures.mjs            everything again
//   node scripts/fetch-structures.mjs --only=lsd those
//   node scripts/fetch-structures.mjs --names    only the names below, again
//
// `name` is what the page calls the compound when the drawing isn't of the
// substance itself ("drawn: its main active compound, psilocybin").
//
// Only names and structures are sent to PubChem.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStructures, writeStructures } from './lib/structures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'public/data/index.json');
const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const UA = { 'User-Agent': 'journal-structure-sync/1.0' };

/* What to draw, where a name lookup alone gets it wrong or finds nothing.
   `name` is looked up by name, `smiles` by structure. */
const DRAW = {
    // The substance itself, under a name or structure PubChem knows.
    alcohol: { name: 'ethanol' },
    nitrous: { name: 'nitrous oxide' },
    'nitrous-oxide': { name: 'nitrous oxide' },
    'amphetamine-disambiguation': { name: 'amphetamine' },
    doc: { name: '4-chloro-2,5-dimethoxyamphetamine' },
    lsa: { name: 'ergine' },
    mcpp: { name: '1-(3-chlorophenyl)piperazine' },
    mdea: { name: '3,4-methylenedioxy-N-ethylamphetamine' },
    pma: { name: '4-methoxyamphetamine' },
    pmma: { name: '4-methoxymethamphetamine' },
    doip: { name: '2,5-dimethoxy-4-isopropylamphetamine' },
    mdpa: { name: '3,4-methylenedioxy-N-propylamphetamine' },
    mda: { name: '3,4-methylenedioxyamphetamine' },
    dmt: { name: 'N,N-dimethyltryptamine' },
    dxm: { name: 'dextromethorphan' },
    dpt: { name: 'N,N-dipropyltryptamine' },
    det: { name: 'N,N-diethyltryptamine' },
    amt: { name: 'alpha-methyltryptamine' },
    dmc: { name: '4-chloro-N-methylcathinone' },
    phenethylamine: { name: 'phenethylamine' },
    'phenethylamine-compound': { name: 'phenethylamine' },
    'tryptamine-compound': { name: 'tryptamine' },
    serotonin: { name: 'serotonin' },
    cathinone: { name: 'cathinone' },
    dmaa: { name: 'methylhexanamine' },
    'alpha-gpc': { name: 'glycerylphosphorylcholine' },
    'f-phenibut': { smiles: 'NCC(CC(=O)O)c1ccc(F)cc1' },
    fluorophenibut: { smiles: 'NCC(CC(=O)O)c1ccc(F)cc1' },
    mxipr: { smiles: 'COc1cccc(c1)C1(CCCCC1=O)NC(C)C' },
    'n-methylbisfluoromodafinil': { smiles: 'CNC(=O)CS(=O)C(c1ccc(F)cc1)c1ccc(F)cc1' },
    hxe: { smiles: 'CCNC1(CCCCC1=O)c1cccc(O)c1' },
    '2-me-dmt': { smiles: 'CN(C)CCc1c(C)[nH]c2ccccc12' },
    don: { smiles: 'COc1cc(CC(C)N)c(OC)cc1[N+](=O)[O-]' },
    '2-mec': { smiles: 'CCNC(C)C(=O)c1ccccc1C' },
    '2-pa': { name: '2-phenylacetamide' },
    '2-pta': { smiles: 'Cc1ccc(CC(N)=O)cc1' },
    '25t-4-nbome': { smiles: 'CC(C)Sc1cc(OC)c(CCNCc2ccccc2OC)cc1OC' },
    '3-meo-pcpr': { smiles: 'CCCNC1(CCCCC1)c1cccc(OC)c1' },
    '3-meo-pcpy': { smiles: 'COc1cccc(c1)C1(CCCCC1)N1CCCC1' },
    '3-oh-phenazepam': { smiles: 'OC1N=C(c2ccccc2Cl)c2cc(Br)ccc2NC1=O' },
    '4-epd': { smiles: 'CCCC(NC)C(=O)c1ccc(CC)cc1' },
    '4f-neb': { smiles: 'CCNC(CC)C(=O)c1ccc(F)cc1' },
    '4f-php': { smiles: 'CCCCC(N1CCCC1)C(=O)c1ccc(F)cc1' },
    '4f-pvp': { smiles: 'CCCC(N1CCCC1)C(=O)c1ccc(F)cc1' },
    'a-pihp': { smiles: 'CC(C)CC(N1CCCC1)C(=O)c1ccccc1' },
    'methoxyacetyl-fentanyl': { smiles: 'COCC(=O)N(c1ccccc1)C1CCN(CCc2ccccc2)CC1' },
    pfbt: { smiles: 'CN1C2CCC1CC(C2)OC(=O)c1ccc(F)cc1' },
    'bk-2c-i': { smiles: 'COc1cc(C(=O)CN)c(OC)cc1I' },
    '3-cl-pcp': { smiles: 'Clc1cccc(c1)C1(CCCCC1)N1CCCCC1' },
    mpt: { smiles: 'CCCN(C)CCc1c[nH]c2ccccc12' },
    tetrahydrocannabihexol: { smiles: 'CCCCCCc1cc(O)c2C3C=C(C)CCC3C(C)(C)Oc2c1' },
    tetrahydrocannabutol: { smiles: 'CCCCc1cc(O)c2C3C=C(C)CCC3C(C)(C)Oc2c1' },
    '10-tetrahydrocannabinol': { smiles: 'CCCCCc1cc(O)c2C3=CC(C)CCC3C(C)(C)Oc2c1' },
    '11-tetrahydrocannabinol': { smiles: 'CCCCCc1cc(O)c2C3CC(=C)CCC3C(C)(C)Oc2c1' },
    '2c-b-fly-nbome': { smiles: 'COc1ccccc1CNCCc1c2CCOc2c(Br)c2CCOc12' },
    '3-6-dmpm': { smiles: 'CC1CNC(C)C(c2ccccc2)O1' },

    // αET is α-ethyltryptamine; by its short name PubChem finds AET, an
    // unrelated isothiouronium salt.
    aet: { smiles: 'CCC(N)Cc1c[nH]c2ccccc12' },

    // A plant's or a mixture's main active compound.
    cannabis: { name: 'dronabinol', role: 'active' },
    // Its alias "O" found oxygen.
    opium: { name: 'morphine', role: 'active' },
    mushrooms: { name: 'psilocybin', role: 'active' },
    'psilocybin-mushrooms': { name: 'psilocybin', role: 'active' },
    'psilocybe-cubensis': { name: 'psilocybin', role: 'active' },
    truffles: { name: 'psilocybin', role: 'active' },
    peyote: { name: 'mescaline', role: 'active' },
    'san-pedro': { name: 'mescaline', role: 'active' },
    salvia: { name: 'salvinorin A', role: 'active' },
    'salvia-divinorum': { name: 'salvinorin A', role: 'active' },
    kava: { name: 'kavain', role: 'active' },
    khat: { name: 'cathinone', role: 'active' },
    kratom: { name: 'mitragynine', role: 'active' },
    ayahuasca: { name: 'N,N-dimethyltryptamine', role: 'active' },
    changa: { name: 'N,N-dimethyltryptamine', role: 'active' },
    'tabernanthe-iboga-botany': { name: 'ibogaine', role: 'active' },
    'peganum-harmala': { name: 'harmaline', role: 'active' },
    'banisteriopsis-caapi': { name: 'harmine', role: 'active' },
    'blue-lotus': { name: 'aporphine', role: 'active' },
    'mandragora-officinarum-botany': { name: 'scopolamine', role: 'active' },
    mandragora: { name: 'scopolamine', role: 'active' },
    datura: { name: 'scopolamine', role: 'active' },
    'datura-botany': { name: 'scopolamine', role: 'active' },
    'atropa-belladonna': { name: 'atropine', role: 'active' },
    'hyoscyamus-niger-botany': { name: 'hyoscyamine', role: 'active' },
    'amanita-muscaria': { name: 'muscimol', role: 'active' },
    'anadenanthera-peregrina': { name: 'bufotenin', role: 'active' },
    yopo: { name: 'bufotenin', role: 'active' },
    kanna: { name: 'mesembrine', role: 'active' },
    'morning-glory': { name: 'ergine', role: 'active' },
    sinicuichi: { name: 'vertine', role: 'active' },
    'piper-nigrum-botany': { name: 'piperine', role: 'active' },
    cocoa: { name: 'theobromine', role: 'active' },
    'yerba-mate': { name: 'caffeine', role: 'active' },
    ashwagandha: { name: 'withaferin A', role: 'active' },
    poppers: { name: 'isoamyl nitrite', role: 'active' },
    pst: { name: 'morphine', role: 'active' },
    tuinal: { name: 'secobarbital', role: 'active' },
    adderall: { name: 'amphetamine', role: 'active' },

    // A chemical family: its parent structure, or its best-known member.
    'substituted-tryptamines': { name: 'tryptamine', role: 'core' },
    'substituted-phenethylamines': { name: 'phenethylamine', role: 'core' },
    'substituted-amphetamines': { name: 'amphetamine', role: 'core' },
    'substituted-cathinones': { name: 'cathinone', role: 'core' },
    'substituted-morphinans': { name: 'morphinan', role: 'core' },
    'substituted-aminorexes': { name: 'aminorex', role: 'core' },
    'substituted-phenidates': { name: 'methylphenidate', role: 'example' },
    lysergamides: { name: 'ergine', role: 'core' },
    arylcyclohexylamines: { smiles: 'NC1(CCCCC1)c1ccccc1', role: 'core' },
    diarylethylamines: { smiles: 'NC(Cc1ccccc1)c1ccccc1', role: 'core' },
    benzodiazepines: { smiles: 'O=C1CN=C(c2ccccc2)c2ccccc2N1', role: 'core' },
    thienodiazepines: { name: 'etizolam', role: 'example' },
    xanthines: { name: 'xanthine', role: 'core' },
    racetams: { name: 'piracetam', role: 'example' },
    barbiturates: { name: 'barbituric acid', role: 'core' },
    'harmala-alkaloid': { name: 'harmine', role: 'example' },
    dox: { smiles: 'COc1ccc(OC)c(CC(C)N)c1', role: 'core' },
    '2c-x': { smiles: 'COc1ccc(OC)c(CCN)c1', role: 'core' },
    '2c-t-x': { smiles: 'CSc1cc(OC)c(CCN)cc1OC', role: 'example' },
    '25x-nbome': { smiles: 'COc1ccc(OC)c(CCNCc2ccccc2OC)c1', role: 'core' },
    '25x-nboh': { smiles: 'COc1ccc(OC)c(CCNCc2ccccc2O)c1', role: 'core' },
};

/* What to call a compound drawn for a plant, a mixture or a family, by CID:
   PubChem's own title is sometimes a product (Boro-Scopol), a catalogue
   number (RO-05-2921) or a systematic name a line long. */
const NAMES = {
    16078: 'Δ⁹-THC',
    3034396: 'Mitragynine',
    10624: 'Psilocybin',
    6089: 'DMT',
    3007: 'Amphetamine',
    4076: 'Mescaline',
    265237: 'Withaferin A',
    5281565: 'Kavain',
    2519: 'Caffeine',
    114911: 'Aporphine',
    128563: 'Salvinorin A',
    3000322: 'Scopolamine',
    394162: 'Mesembrine',
    5193: 'Secobarbital',
    71424713: '25H-NBOH',
    39424372: '25H-NBOMe',
    76632: '2C-H',
    76175: '5-phenyl-1,4-benzodiazepin-2-one',
    12315927: '2C-T',
    4266: 'Muscimol',
    10257: 'Bufotenin',
    31862: '1-phenylcyclohexylamine',
    174174: 'Atropine',
    5280953: 'Harmine',
    6211: 'Barbituric acid',
    5429: 'Theobromine',
    26482: '1,2-diphenylethylamine',
    62787: '2,5-DMA',
    154417: 'Hyoscyamine',
    442072: 'Ergine (LSA)',
    3564: 'Harmaline',
    638024: 'Piperine',
    8053: 'Isoamyl nitrite',
    4843: 'Piracetam',
    16630: 'Aminorex',
    62258: 'Cathinone',
    6857497: 'Morphinan',
    1001: 'Phenethylamine',
    4158: 'Methylphenidate',
    1150: 'Tryptamine',
    197060: 'Ibogaine',
    3307: 'Etizolam',
    1188: 'Xanthine',
    5288826: 'Morphine',
    5315204: 'Vertine',
};

/** Puts the names above on every entry drawn from those compounds. */
function nameAll(out) {
    for (const v of Object.values(out)) {
        if (!v) continue;
        if (NAMES[v.cid]) v.name = NAMES[v.cid];
        delete v.zh;
    }
}

/* Not one chemical (a kind of drug, an effect, a blend), or not known well
   enough to draw: better no drawing than a wrong one. */
const NONE = new Set([
    'maoi', 'opioids', 'psychedelic', 'rima', 'synthetic-cannabinoid', 'antidepressants', 'antihistamine',
    'antipsychotic', 'cannabinoid', 'classical-psychedelics', 'deliriant', 'depressant', 'dissociatives',
    'entactogen', 'entheogen', 'eugeroics', 'hallucinogens', 'hypnotic', 'inhalants', 'nootropic', 'sedative',
    'selective-serotonin-reuptake-inhibitor', 'serotonergic-psychedelic', 'serotonin-norepinephrine-reuptake-inhibitor',
    'stimulants', 'stimulant', 'sedatives', 'serotonin-releasers',
    // Unknown or unsure: no drawing rather than a guess.
    'cake', 'jenkem', '2c-b-an', 'bk-ivp', 'cyclo-methiodrone', 'benzodioxole-fentanyl', 'n-2c-fentanyl',
    'mephenaqualone',
]);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, init) {
    for (let attempt = 0; attempt < 4; attempt++) {
        let res;
        try {
            res = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) } });
        } catch {
            await sleep(2000 * (attempt + 1));
            continue;
        }
        if (res.status === 503 || res.status === 429) {
            await sleep(1500 * (attempt + 1));
            continue;
        }
        return res;
    }
    return null;
}

async function cidByName(name) {
    const res = await get(`${PUG}/compound/name/${encodeURIComponent(name)}/cids/JSON`);
    if (!res?.ok) return null;
    return (await res.json())?.IdentifierList?.CID?.[0] || null;
}

async function cidBySmiles(smiles) {
    const res = await get(`${PUG}/compound/smiles/cids/JSON`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `smiles=${encodeURIComponent(smiles)}`,
    });
    if (!res?.ok) return null;
    return (await res.json())?.IdentifierList?.CID?.[0] || null;
}

async function title(cid) {
    const res = await get(`${PUG}/compound/cid/${cid}/property/Title/JSON`);
    if (!res?.ok) return null;
    return (await res.json())?.PropertyTable?.Properties?.[0]?.Title ?? null;
}

const CHARGE = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

/** PubChem's 2D record (a V2000 molfile) as atoms and bonds to draw. */
function parseMolfile(text) {
    const lines = text.split('\n');
    const counts = lines[3] ?? '';
    const nA = parseInt(counts.slice(0, 3)),
        nB = parseInt(counts.slice(3, 6));
    if (!nA) return null;
    const atoms = [];
    for (let i = 0; i < nA; i++) {
        const l = lines[4 + i];
        atoms.push({
            x: parseFloat(l.slice(0, 10)),
            y: parseFloat(l.slice(10, 20)),
            el: l.slice(31, 34).trim(),
            c: CHARGE[parseInt(l.slice(36, 39))] ?? 0,
            h: 0,
        });
    }
    const bonds = [];
    for (let i = 0; i < nB; i++) {
        const l = lines[4 + nA + i];
        bonds.push({
            a: parseInt(l.slice(0, 3)) - 1,
            b: parseInt(l.slice(3, 6)) - 1,
            o: parseInt(l.slice(6, 9)),
            s: parseInt(l.slice(9, 12)) || 0,
        });
    }
    for (const l of lines.slice(4 + nA + nB)) {
        if (!l.startsWith('M  CHG')) continue;
        const f = l.slice(6).trim().split(/\s+/).map(Number);
        for (let k = 1; k + 1 < f.length; k += 2) atoms[f[k] - 1].c = f[k + 1];
    }

    // Keep the largest piece (a salt's counter-ion goes).
    const adj = atoms.map(() => []);
    bonds.forEach(b => {
        adj[b.a].push(b.b);
        adj[b.b].push(b.a);
    });
    const comp = new Array(atoms.length).fill(-1);
    let best = -1,
        bestSize = 0;
    for (let i = 0; i < atoms.length; i++) {
        if (comp[i] !== -1) continue;
        const stack = [i];
        comp[i] = i;
        let heavy = 0;
        while (stack.length) {
            const v = stack.pop();
            if (atoms[v].el !== 'H') heavy++;
            for (const w of adj[v]) if (comp[w] === -1) (comp[w] = i), stack.push(w);
        }
        if (heavy > bestSize) (bestSize = heavy), (best = i);
    }

    // Hydrogens become counts on their atom, unless drawn as a stereo wedge
    // from a stereocentre, where the H is part of the drawing.
    const keep = atoms.map((a, i) => comp[i] === best && a.el !== 'H');
    for (const b of bonds) {
        const [x, y] = [atoms[b.a], atoms[b.b]];
        if (comp[b.a] !== best) continue;
        if (y.el === 'H' && x.el !== 'H') {
            if (b.s) keep[b.b] = true;
            else x.h++;
        } else if (x.el === 'H' && y.el !== 'H') {
            y.h++;
        }
    }
    const map = new Map();
    const a = [];
    atoms.forEach((at, i) => {
        if (!keep[i]) return;
        map.set(i, a.length);
        a.push([at.el, Math.round(at.x * 100), Math.round(at.y * 100), at.el === 'H' ? 0 : at.h, at.c]);
    });
    const bOut = bonds.filter(b => map.has(b.a) && map.has(b.b)).map(b => [map.get(b.a), map.get(b.b), b.o, b.s]);
    return a.length ? { a, b: bOut } : null;
}

async function molfile(cid) {
    const res = await get(`${PUG}/compound/cid/${cid}/record/SDF?record_type=2d`);
    if (!res?.ok) return null;
    return parseMolfile(await res.text());
}

const index = JSON.parse(await fs.readFile(INDEX, 'utf8'));
const only = (process.argv.find(x => x.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const before = await readStructures(ROOT);
const out = only.length ? { ...before } : {};

if (process.argv.includes('--names')) {
    nameAll(before);
    await writeStructures(ROOT, before);
    console.log('named');
    process.exit(0);
}

/** Molfiles for many compounds at once: PubChem sends them one after another. */
async function molfiles(cids) {
    const got = new Map();
    for (let k = 0; k < cids.length; k += 50) {
        const part = cids.slice(k, k + 50);
        const res = await get(`${PUG}/compound/cid/${part.join(',')}/record/SDF?record_type=2d`);
        if (res?.ok) {
            for (const block of (await res.text()).split(/\$\$\$\$\r?\n?/)) {
                const cid = parseInt(block.trim().split('\n')[0], 10);
                if (!cid) continue;
                const mol = parseMolfile(block.replace(/^\s*\n/, ''));
                if (mol) got.set(cid, mol);
            }
        } else {
            // One bad compound fails the batch: ask for each on its own.
            for (const cid of part) {
                const mol = await molfile(cid);
                if (mol) got.set(cid, mol);
                await sleep(220);
            }
        }
        await sleep(300);
        process.stdout.write(`molfiles: ${Math.min(k + 50, cids.length)} of ${cids.length}\n`);
    }
    return got;
}

// 1. Which compound each substance is drawn as.
const plan = new Map(); // id → { cid, name, role }
let looked = 0;
for (const e of index) {
    if (only.length && !only.includes(e.id)) continue;
    if (NONE.has(e.id)) {
        out[e.id] = null;
        continue;
    }
    const want = DRAW[e.id];
    const prev = before[e.id];
    const prevCid = Array.isArray(prev) ? prev[1] : prev?.cid;
    const prevName = Array.isArray(prev) ? prev[2] : prev?.name;
    let cid = null;
    let name = null;
    if (want?.smiles) cid = await cidBySmiles(want.smiles);
    else if (want?.name) cid = await cidByName(want.name);
    else if (e.cid) {
        // From Wikidata, with its compound already known.
        cid = e.cid;
        name = e.name;
    } else if (prevCid) cid = prevCid;
    else {
        for (const n of [e.name, e.id, ...e.aliases.split(',').map(x => x.trim())].filter(Boolean).slice(0, 4)) {
            cid = await cidByName(n);
            await sleep(220);
            if (cid) break;
        }
    }
    if (want) await sleep(220);
    if (!cid) {
        out[e.id] = null;
        continue;
    }
    name ??= cid === prevCid ? prevName : null;
    plan.set(e.id, { cid, name, role: want?.role ?? 'self', prev: prev && !Array.isArray(prev) && prev.cid === cid && prev.a ? prev : null });
    if (++looked % 200 === 0) process.stdout.write(`${looked} looked up\n`);
}

// 2. The drawings: kept from before where the compound is the same, fetched otherwise.
const fetchCids = [...new Set([...plan.values()].filter(p => !p.prev).map(p => p.cid))];
const mols = await molfiles(fetchCids);
for (const [id, p] of plan) {
    const mol = p.prev ? { a: p.prev.a, b: p.prev.b } : mols.get(p.cid);
    if (!mol) {
        out[id] = null;
        continue;
    }
    let name = p.name;
    if (!name) {
        name = await title(p.cid);
        await sleep(220);
    }
    out[id] = { cid: p.cid, name: name ?? '', role: p.role, ...mol };
}

nameAll(out);
await writeStructures(ROOT, out);
const total = Object.values(out).filter(Boolean).length;
console.log(`done: ${total} of ${index.length} substances have a structure`);
