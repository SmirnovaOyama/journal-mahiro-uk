// Says what a data sync changed that a person should read before it goes
// live: doses, timings and combinations, substance by substance, against
// the last commit. Everything else that changed (summaries, names, links)
// is only counted. Written as Markdown, for the pull request the weekly
// refresh opens (.github/workflows/data.yml).
//
//   node scripts/data-diff.mjs            what the working tree changed
//   node scripts/data-diff.mjs HEAD~1     what the last commit changed

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const DIR = 'public/data/substances';
const base = process.argv[2] ?? 'HEAD';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const changed = git('status', '--porcelain', '--', DIR)
    .split('\n')
    .filter(Boolean)
    .map(l => ({ how: l.slice(0, 2).trim(), file: l.slice(3).trim() }))
    .filter(c => c.file.endsWith('.json'));
if (process.argv[2]) {
    changed.length = 0;
    for (const l of git('diff', '--name-status', base, 'HEAD', '--', DIR).split('\n').filter(Boolean)) {
        const [how, file] = l.split('\t');
        if (file?.endsWith('.json')) changed.push({ how, file });
    }
}

const before = file => {
    try {
        return JSON.parse(git('show', `${base}:${file}`));
    } catch {
        return null;
    }
};
const after = file => {
    try {
        return JSON.parse(process.argv[2] ? git('show', `HEAD:${file}`) : fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
};

const LEVELS = ['threshold', 'light', 'common', 'strong', 'heavy'];
const PHASES = ['onset', 'comeup', 'peak', 'offset', 'afterEffects', 'total'];
const rowsBy = (rows, fields) => new Map((rows ?? []).map(r => [r.roa, fields.map(f => `${f} ${r[f] ?? '—'}`).join(', ') + (r.unit ? ` (${r.unit})` : '')]));

function rowChanges(a, b, fields) {
    const A = rowsBy(a, fields);
    const B = rowsBy(b, fields);
    const out = [];
    for (const roa of new Set([...A.keys(), ...B.keys()])) {
        if (A.get(roa) === B.get(roa)) continue;
        if (!A.has(roa)) out.push(`  - ${roa}, new: ${B.get(roa)}`);
        else if (!B.has(roa)) out.push(`  - ${roa}, gone (was: ${A.get(roa)})`);
        else out.push(`  - ${roa}\n    - was: ${A.get(roa)}\n    - now: ${B.get(roa)}`);
    }
    return out;
}

function comboChanges(a, b) {
    const A = new Map((a ?? []).map(c => [c.substance, c.status]));
    const B = new Map((b ?? []).map(c => [c.substance, c.status]));
    const out = [];
    for (const s of new Set([...A.keys(), ...B.keys()])) {
        if (A.get(s) === B.get(s)) continue;
        out.push(`  - ${s}: ${A.get(s) ?? 'not listed'} → ${B.get(s) ?? 'not listed'}`);
    }
    return out;
}

const doses = [];
const timings = [];
const combos = [];
const added = [];
const gone = [];
let other = 0;

for (const { file } of changed) {
    const a = before(file);
    const b = after(file);
    const name = (b ?? a)?.name ?? file;
    if (!a && b) {
        added.push(`- ${name}${b.doseRows?.length ? ', with doses' : ''}`);
        continue;
    }
    if (a && !b) {
        gone.push(`- ${name}`);
        continue;
    }
    if (!a || !b) continue;
    const d = rowChanges(a.doseRows, b.doseRows, LEVELS);
    const t = rowChanges(a.durationRows, b.durationRows, PHASES);
    const c = comboChanges(a.combinations, b.combinations);
    if (d.length) doses.push(`- **${name}**\n${d.join('\n')}`);
    if (t.length) timings.push(`- **${name}**\n${t.join('\n')}`);
    if (c.length) combos.push(`- **${name}**\n${c.join('\n')}`);
    if (!d.length && !t.length && !c.length) other++;
}

const section = (title, lines, limit = 80) =>
    lines.length ? [`## ${title} (${lines.length})`, '', ...lines.slice(0, limit), ...(lines.length > limit ? [`- …and ${lines.length - limit} more`] : []), ''] : [];

const out = [
    `The weekly sync changed ${changed.length} substance${changed.length === 1 ? '' : 's'}. Doses, timings and combinations are listed in full: read them against their sources before merging, since merging puts them live.`,
    '',
    ...section('Doses', doses),
    ...section('Timings', timings),
    ...section('Combinations', combos),
    ...section('New', added, 200),
    ...section('Gone', gone, 200),
    ...(other ? [`${other} other substance${other === 1 ? '' : 's'} changed in words only (summaries, names, links).`, ''] : []),
    ...(!doses.length && !timings.length && !combos.length ? ['No dose, timing or combination changed.', ''] : []),
];
process.stdout.write(out.join('\n'));
