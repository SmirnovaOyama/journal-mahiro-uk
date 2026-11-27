// Lists the lines the code says through tr('…') that src/lib/zh-Hant.ts has
// no 正體中文 for yet; those are shown in English until they're added. The
// 简体中文 is written from the 正體中文 by scripts/zh-hans.mjs, so a line
// missing there means that script hasn't been run since it was added.
// Only lines written out in the call are seen: one passed as a variable
// (a category's name, a verdict's words) has to be checked by eye.
//
//   npm run check-i18n

import fs from 'node:fs';
import path from 'node:path';

const unquote = s => s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));
const STRING = String.raw`'((?:[^'\\\n]|\\.)*)'`;

/** The lines one of the dictionaries has. */
const keysOf = file => {
    const out = new Set();
    const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    for (const m of src.matchAll(new RegExp(String.raw`^\s+${STRING}: '`, 'gm'))) out.add(unquote(m[1]));
    return out;
};
const zh = keysOf('src/lib/zh-Hant.ts');
const hans = keysOf('src/lib/zh-Hans.ts');

const files = [];
const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/zh-Han[ts](-data)?\.ts$/.test(e.name)) files.push(p);
    }
};
walk('src');

const missing = new Map();
for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    // tr('line'), tr('line', {…}), tr('line', undefined, 'sense')
    for (const m of src.matchAll(new RegExp(String.raw`\btr\(\s*${STRING}(?:\s*,[^,()]*(?:\([^()]*\)[^,()]*)*,\s*${STRING})?`, 'g'))) {
        const line = unquote(m[1]);
        const sense = m[2] && unquote(m[2]);
        if (zh.has(line) || (sense && zh.has(`${line}|${sense}`))) continue;
        if (!missing.has(line)) missing.set(line, file);
    }
}

if (!missing.size) console.log(`Every line said through tr('…') has its 正體中文 (${zh.size} in all).`);
else {
    console.log(`${missing.size} without 正體中文 yet:\n`);
    for (const [line, file] of missing) console.log(`  ${file}\n    ${JSON.stringify(line)}`);
    process.exitCode = 1;
}

/* And whether the 简体中文 was written from the 正體中文 as it stands. */
const behind = [...zh].filter(k => !hans.has(k));
if (!hans.size) console.log('No src/lib/zh-Hans.ts yet: run node scripts/zh-hans.mjs to write it.');
else if (behind.length) {
    console.log(`\n${behind.length} of those lines have no 简体中文: run node scripts/zh-hans.mjs again.`);
    for (const line of behind.slice(0, 10)) console.log(`    ${JSON.stringify(line)}`);
    process.exitCode = 1;
} else console.log(`Its 简体中文 has every one of them (${hans.size} in all).`);
