// Lists the lines the code says through tr('…') that src/lib/zh-Hant.ts has
// no 正體中文 for yet; those are shown in English until they're added.
// Only lines written out in the call are seen: one passed as a variable
// (a category's name, a verdict's words) has to be checked by eye.
//
//   npm run check-i18n

import fs from 'node:fs';
import path from 'node:path';

const unquote = s => s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));
const STRING = String.raw`'((?:[^'\\\n]|\\.)*)'`;

const zh = new Set();
for (const m of fs.readFileSync('src/lib/zh-Hant.ts', 'utf8').matchAll(new RegExp(String.raw`^\s+${STRING}: '`, 'gm'))) zh.add(unquote(m[1]));

const files = [];
const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/zh-Hant\.ts$/.test(e.name)) files.push(p);
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
