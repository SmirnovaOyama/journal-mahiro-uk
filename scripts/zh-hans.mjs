// Writes the site's 简体中文 from its 正體中文: src/lib/zh-Hans.ts and
// src/lib/zh-Hans-data.ts from src/lib/zh-Hant.ts and zh-Hant-data.ts, and
// each case report's 简体 telling from its 正體 one.
//
//   node scripts/zh-hans.mjs
//
// It is not a character-by-character conversion. Every run of Chinese in
// those files, in a line and in a comment alike, goes through the Chinese
// Wikipedia's own converter at variant=zh-cn, which knows the words part
// ways as well as the characters do (滑鼠 is 鼠标 there, 資訊 is 信息), and
// then through the hand-kept list below, for the places where the site's
// own voice or a drug's common name is not what a general table gives.
//
// Everything else is copied across untouched, so the two files have the
// same keys in the same order and scripts/check-i18n.mjs can read either.
// Run it again whenever the 正體中文 changes.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'src/lib');
const REPORTS = path.join(ROOT, 'public/data/reports');
const PAIRS = [
    [path.join(LIB, 'zh-Hant.ts'), path.join(LIB, 'zh-Hans.ts')],
    [path.join(LIB, 'zh-Hant-data.ts'), path.join(LIB, 'zh-Hans-data.ts')],
];
// Every report that has a 正體中文 telling gets a 简体 one beside it.
for (const f of (await fs.readdir(REPORTS).catch(() => [])).filter(f => f.endsWith('.zh-Hant.json')))
    PAIRS.push([path.join(REPORTS, f), path.join(REPORTS, f.replace('.zh-Hant.json', '.zh-Hans.json'))]);
const UA = 'substance-reference-sync/1.0 (harm-reduction reference; contact via site)';
const API = 'https://zh.wikipedia.org/w/api.php';

/* Where the mainland's reader is better served by another word than the
   converter's. Applied to the converted line, longest first, so a longer
   phrase wins over a word inside it. Each left side is 简体 as the
   converter leaves it; each right side is what goes in its place. */
const WORDS = {
    // The names Taiwan uses, which scripts/zh-data.mjs gives the catalogue,
    // read oddly on the mainland; here each is the name used there.
    甲基安非他命: '甲基苯丙胺',
    恺他命: '氯胺酮',
    安非他命: '苯丙胺',
    佐沛眠: '唑吡坦',
    派醋甲酯: '哌甲酯',
    丁基原啡因: '丁丙诺啡',
    吩坦尼: '芬太尼',
    美沙冬: '美沙酮',
    卡痛树: '帽柱木',
};

const HAN = /[㐀-鿿]/;
// A run of Chinese: Han characters and the punctuation that belongs to them.
const RUN = /[　-〿㐀-鿿！-･]+/g;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** One request, waiting out a rate limit (429) or a server error. */
async function post(body, tries = 6) {
    for (let k = 0; k < tries; k++) {
        let res;
        try {
            res = await fetch(API, {
                method: 'POST',
                headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
                body,
            });
        } catch (e) {
            if (k === tries - 1) throw e;
            await sleep(5000 * (k + 1));
            continue;
        }
        if (res.status === 429 || res.status >= 500) {
            await sleep(Number(res.headers.get('retry-after')) * 1000 || 5000 * (k + 1));
            continue;
        }
        if (!res.ok) throw new Error(`parse ${res.status}: ${(await res.text()).slice(0, 200)}`);
        return res;
    }
    throw new Error('parse: gave up after being rate-limited');
}

/** Wikipedia's own conversion of each line into 简体, in order. */
async function convert(lines) {
    const body = new URLSearchParams({
        action: 'parse',
        format: 'json',
        formatversion: '2',
        contentmodel: 'wikitext',
        prop: 'text',
        disablelimitreport: '1',
        wrapoutputclass: '',
        variant: 'zh-cn',
        // One line each, so the answer's paragraphs line up with the input.
        text: lines.join('\n\n'),
    });
    const html = (await (await post(body)).json()).parse?.text ?? '';
    const out = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m =>
        m[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim(),
    );
    if (out.length !== lines.length) throw new Error(`asked for ${lines.length} lines, got ${out.length}`);
    return out;
}

/* Every run of Chinese in all of them, each one asked for once. */
const sources = [];
for (const [from] of PAIRS) sources.push(await fs.readFile(from, 'utf8'));
const runs = [...new Set(sources.join('\n').match(RUN) ?? [])].filter(r => HAN.test(r));
console.log(`${runs.length} runs of Chinese to convert`);

const hans = new Map();
const parts = chunks(runs, 100);
for (const [i, part] of parts.entries()) {
    const out = await convert(part);
    part.forEach((r, k) => hans.set(r, out[k] || r));
    process.stdout.write(`\r${Math.min((i + 1) * 100, runs.length)}/${runs.length}`);
    await sleep(800);
}
console.log();

/** A run in 简体: the converter's, then the hand-kept words. */
const longest = Object.keys(WORDS).sort((a, b) => b.length - a.length);
function simplified(run) {
    let out = hans.get(run) ?? run;
    for (const w of longest) if (out.includes(w)) out = out.split(w).join(WORDS[w]);
    return out;
}

let changed = 0;
for (const [i, [from, to]] of PAIRS.entries()) {
    const out = sources[i].replace(RUN, r => {
        if (!HAN.test(r)) return r;
        const s = simplified(r);
        if (s !== r) changed++;
        return s;
    });
    // A source file says which it is and where it came from; a report is
    // read as data, so nothing is added to it.
    const header = to.endsWith('.ts')
        ? `/* 简体中文, written from ${path.basename(from)} by scripts/zh-hans.mjs. Edit\n   the 正體中文 and run that script again; don't edit this file by hand. */\n\n`
        : '';
    await fs.writeFile(to, header + out);
    console.log(`wrote ${path.relative(ROOT, to)}`);
}
console.log(`${changed} runs differ in 简体中文`);
