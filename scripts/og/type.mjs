// The type on a link preview card: its faces, how wide a line of it runs,
// and where a line may be broken. Nothing here draws; card.mjs sets the
// lines this measures and resvg draws them from the same font files, so
// what is measured is what is drawn, on any machine.
//
// The faces are in scripts/og/fonts, both under the SIL Open Font License
// (their licences are beside them): Inter for Latin, its Display cut for
// names and figures, and Source Han Sans for whatever Inter has no letter
// for, which is to say Chinese: the mainland's shapes or Taiwan's, by the
// language the card is in.

import * as fontkit from 'fontkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const face = (family, weight, file) => ({ family, weight, file: path.join(DIR, file) });

export const FACE = {
    /** lines of text */
    text: face('Inter', 400, 'Inter-Regular.ttf'),
    /** the letters in a structure */
    label: face('Inter', 500, 'Inter-Medium.ttf'),
    /** names */
    title: face('Inter Display', 400, 'InterDisplay-Regular.ttf'),
    /** the mix checker's verdict */
    figure: face('Inter Display', 300, 'InterDisplay-Light.ttf'),
};
export const HAN = {
    'zh-Hans': face('Source Han Sans CN', 400, 'SourceHanSansCN-Regular.otf'),
    'zh-Hant': face('Source Han Sans TW', 400, 'SourceHanSansTW-Regular.otf'),
};
const hanFor = lang => HAN[lang] ?? HAN['zh-Hans'];

const opened = new Map();
const open = f => {
    if (!opened.has(f.file)) opened.set(f.file, fontkit.openSync(f.file));
    return opened.get(f.file);
};

/** Inter's own measure of a line box, as shares of the type size: every
 *  line is placed by it, whatever else is set in the line. */
const ASCENT = 1984 / 2048;
const DESCENT = 494 / 2048;
/** Where the baseline of a line falls below the top of its line box. */
export const baseline = (size, leading) => (leading * size - (ASCENT + DESCENT) * size) / 2 + ASCENT * size;

const has = (f, ch) => open(f).hasGlyphForCodePoint(ch.codePointAt(0));

/** A line as runs: what its face has letters for, and what goes to Source
 *  Han Sans. A space stays with the run it is in. */
export function runs(text, f) {
    const out = [];
    for (const ch of text) {
        const han = !/\s/.test(ch) && !has(f, ch);
        const last = out[out.length - 1];
        if (last && (last.han === han || /\s/.test(ch))) last.text += ch;
        else out.push({ han, text: ch });
    }
    return out;
}

/** Letters that neither face has: drawn as nothing, so render.mjs lists them. */
export const missing = new Set();

/** The faces a set of lines needs loaded to be drawn. */
export function facesFor(lines, faces, lang) {
    const files = new Set(faces.map(f => f.file));
    for (const [text, f] of lines) if (runs(text, f).some(r => r.han)) files.add(hanFor(lang).file);
    return [...files];
}

const widths = new Map();
/** How far a line runs at a type size of 1: its letters' advances, kerned as
 *  the font kerns them, and `tracking` (in ems) between each two letters.
 *  Not after the last: tightened type would measure narrower than its ink. */
export function advance(text, f, tracking = 0, lang) {
    const key = `${f.file}|${lang ?? ''}|${tracking}|${text}`;
    if (widths.has(key)) return widths.get(key);
    let w = 0;
    for (const r of runs(text, f)) {
        const from = r.han ? hanFor(lang) : f;
        if (r.han) for (const ch of r.text) if (!/\s/.test(ch) && !has(from, ch)) missing.add(ch);
        const font = open(from);
        w += font.layout(r.text).advanceWidth / font.unitsPerEm;
    }
    w += tracking * Math.max(0, [...text].length - 1);
    widths.set(key, w);
    return w;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A line of text as SVG, its baseline at y. */
export function line(text, { x, y, face: f, size, fill, tracking = 0, anchor, lang }) {
    const body = runs(text, f)
        .map(r => (r.han ? `<tspan font-family="${hanFor(lang).family}" font-weight="400">${esc(r.text)}</tspan>` : esc(r.text)))
        .join('');
    return (
        `<text x="${round(x)}" y="${round(y)}" font-family="${f.family}" font-weight="${f.weight}" font-size="${size}"` +
        `${tracking ? ` letter-spacing="${round(tracking * size)}"` : ''}${anchor ? ` text-anchor="${anchor}"` : ''} fill="${fill}">${body}</text>`
    );
}
export const round = n => Math.round(n * 100) / 100;

/* ── where a line may break ──────────────────────────────────────────── */

/** A piece of a line and what joins it to the next piece on the same line. */
const piece = (s, glue) => ({ s, glue });

const HAN_CHAR = /[⺀-鿿豈-﫿＀-￯]/;
const OPENS = /[「『（《〈【“‘(\[]/;
const CLOSES = /[」』）》〉】，。、；：！？”’)\],.;:!?]/;

/** Between words; and in Chinese between any two characters, though never
 *  before a mark that closes or after one that opens. */
export function words(text) {
    const out = [];
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (!HAN_CHAR.test(word)) {
            // "anti-inflammatory" may break after its hyphen, as a browser breaks it.
            const parts = word.split(/(?<=[A-Za-zα-ωβ]-)(?=[A-Za-z])/);
            parts.forEach((p, i) => out.push(piece(p, i === parts.length - 1 ? ' ' : '')));
            continue;
        }
        let cur = '';
        const chars = [...word];
        chars.forEach((ch, i) => {
            cur += ch;
            const next = chars[i + 1];
            const stay = !next || OPENS.test(ch) || CLOSES.test(next) || (!HAN_CHAR.test(ch) && !HAN_CHAR.test(next));
            if (!stay) {
                out.push(piece(cur, ''));
                cur = '';
            }
        });
        if (cur) out.push(piece(cur, ' '));
    }
    return out;
}

/** Where a chemical name is broken: between words, after a hyphen, after a
 *  closing bracket and before an opening one. Never inside a word. */
export function chemical(text) {
    const out = [];
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const parts = word
            .replace(/([^\s(\[])(?=[(\[])/g, '$1\u0000')
            .replace(/([-‐–)\]])(?=[^\s\-‐–)\],.;:'′’\u0000])/g, '$1\u0000')
            .split('\u0000')
            .filter(Boolean);
        parts.forEach((p, i) => out.push(piece(p, i === parts.length - 1 ? ' ' : '')));
    }
    return out;
}

/** Anywhere: the last resort for a name with no place to break. */
export const anywhere = text => [...text].map(ch => piece(ch, ''));

const joined = (pieces, from, to) => {
    let s = '';
    for (let i = from; i < to; i++) s += pieces[i].s + (i < to - 1 ? pieces[i].glue : '');
    return s;
};

/** Fills each line as far as it goes. `measure` gives a line's width. */
export function greedy(pieces, max, measure) {
    const lines = [];
    let from = 0;
    while (from < pieces.length) {
        let to = from + 1;
        while (to < pieces.length && measure(joined(pieces, from, to + 1)) <= max) to++;
        lines.push(joined(pieces, from, to));
        from = to;
    }
    return lines;
}

/** The pieces set as evenly as they go on `count` lines: the breaks that
 *  make the widest line narrowest. Returns the lines and that width, at a
 *  type size of 1. */
export function balanced(pieces, count, measure) {
    const n = pieces.length;
    if (count >= n) {
        const lines = pieces.map(p => p.s);
        return { lines, widest: Math.max(...lines.map(measure)) };
    }
    const w = (i, j) => measure(joined(pieces, i, j));
    // best[k][j]: the narrowest widest-line for the first j pieces on k lines.
    const best = Array.from({ length: count + 1 }, () => new Array(n + 1).fill(Infinity));
    const cut = Array.from({ length: count + 1 }, () => new Array(n + 1).fill(0));
    best[0][0] = 0;
    for (let k = 1; k <= count; k++)
        for (let j = k; j <= n; j++)
            for (let i = k - 1; i < j; i++) {
                const widest = Math.max(best[k - 1][i], w(i, j));
                if (widest < best[k][j]) {
                    best[k][j] = widest;
                    cut[k][j] = i;
                }
            }
    const lines = [];
    for (let k = count, j = n; k > 0; k--) {
        lines.unshift(joined(pieces, cut[k][j], j));
        j = cut[k][j];
    }
    return { lines, widest: best[count][n] };
}
