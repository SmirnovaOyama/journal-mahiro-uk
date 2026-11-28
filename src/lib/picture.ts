import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import { loadStructure } from '../components/Molecule';
import { currentLang } from './i18n';
import { molToSvg } from './molsvg';
import { SITE } from './preview';

/* A page kept as a picture: a substance, a mix, a night in the journal, at
   1080 × 1440 (3:4), to save to a phone or send. Drawn on this device on a
   canvas, so a night in the journal never leaves it.

   Behind it, a field of the page's own substances drawn as skeletal
   formulas (lib/molsvg.ts) in the accent's terracotta: two large and faint,
   then a lattice of small ones turned a little off the square, each at its
   own angle and strength. Flat ink, no gradients. On it, a white panel with
   round corners holding what the page says, and at the foot the logo, the
   site and the page's address, with a QR code to it.

   The page hands over its words already in the reader's language (Block);
   nothing here translates. Loaded only when a picture is asked for. */

export const SIZE = { w: 1080, h: 1440 };

export type Ink = 'text' | 'muted' | 'accent' | 'danger' | 'warning' | 'info' | 'positive';

/** The light theme's tokens (src/styles/oyama-tokens.css), as hex. */
const C = {
    page: '#f7f6f3',
    panel: '#ffffff',
    border: '#e3e1dc',
    text: '#181714',
    muted: '#6b6860',
    accent: '#ac573d',
    field: '#cc785c',
    danger: '#c22826',
    warning: '#a35303',
    info: '#0267c7',
    positive: '#0f7c55',
};

export interface Row {
    left: string;
    leftInk?: Ink;
    right?: string;
    rightInk?: Ink;
    /** A smaller line under it. */
    sub?: string;
    /** A clock time before it, in its own column. */
    time?: string;
    /** A substance whose structure is drawn before the words. */
    mol?: string;
}

export type Block =
    /** What the page is about: a small line, its name, a line under, and its structure on the right. */
    | { t: 'head'; eyebrow?: string; title: string; sub?: string; mol?: string }
    /** A small heading over what follows. */
    | { t: 'heading'; text: string }
    | { t: 'text'; text: string; size?: number; ink?: Ink; weight?: number }
    /** One word, large: a mix's verdict. */
    | { t: 'word'; text: string; ink: Ink }
    | { t: 'rows'; rows: Row[]; more?: (n: number) => string }
    /** A few figures side by side, each its label over its value; with
     *  `bars`, a short bar in the label's colour over each, as the site's
     *  dose rail colours its bands. */
    | { t: 'cols'; items: { label: string; value: string; ink?: Ink }[]; bars?: boolean }
    /** Substances side by side, each its structure over its name. */
    | { t: 'mols'; items: { id: string; name: string }[] }
    /** The small print. */
    | { t: 'note'; text: string };

export interface Picture {
    /** The substances drawn behind it: the page's own. */
    field: string[];
    blocks: Block[];
    /** The page's address on the site, for the foot and its QR code. None
     *  for a page that is the reader's own; the site is named alone. */
    path?: string;
    /** What the file is called, without .png. */
    file: string;
}

/* ── type ─────────────────────────────────────────────────────────────── */

/** The site's own faces (src/index.css), with the Chinese the reader reads. */
function faces() {
    const cjk =
        currentLang() === 'zh-Hant'
            ? '"PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei"'
            : '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei"';
    const sans = `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, ${cjk}, "Hiragino Sans", "Segoe UI", Helvetica, Arial, sans-serif`;
    return { sans, display: `"SF Pro Display", ${sans}` };
}
const font = (size: number, weight = 400, display = false) => `${weight} ${size}px ${display ? faces().display : faces().sans}`;

/** One character of Chinese or Japanese, or a word, or a space. */
const TOKEN = /[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+|\s+/g;
/** What may not start a line: it hangs off the end of the one before. */
const NO_START = /^[，。、；：！？）」』》〉,.;:!?)\]%％]/;

/** A paragraph broken into lines no wider than `width`; with `max`, the
 *  last one kept ends in an ellipsis. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max = Infinity): string[] {
    const fits = (s: string) => ctx.measureText(s.trimEnd()).width <= width;
    const lines: string[] = [];
    let cur = '';
    for (const tok of text.match(TOKEN) ?? []) {
        if (/^\s+$/.test(tok)) {
            if (cur) cur += ' ';
            continue;
        }
        if (fits(cur + tok) || NO_START.test(tok)) {
            cur += tok;
            continue;
        }
        if (cur.trim()) lines.push(cur.trimEnd());
        cur = '';
        // A word wider than the line (an address) is broken where it must be.
        let word = tok;
        while (!fits(word)) {
            let k = word.length - 1;
            while (k > 1 && !fits(word.slice(0, k))) k--;
            lines.push(word.slice(0, k));
            word = word.slice(k);
        }
        cur = word;
    }
    if (cur.trim()) lines.push(cur.trimEnd());
    if (lines.length > max) {
        const kept = lines.slice(0, max);
        let last = kept[max - 1];
        while (last && !fits(`${last}…`)) last = last.slice(0, -1);
        kept[max - 1] = `${last.trimEnd()}…`;
        return kept;
    }
    return lines;
}

/** Lines drawn from `top`, each centred in its own line box. */
function lines(ctx: CanvasRenderingContext2D, ls: string[], x: number, top: number, size: number, leading: number, align: CanvasTextAlign = 'left') {
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ls.forEach((l, i) => ctx.fillText(l, x, top + (i + 0.5) * size * leading));
}

/* ── pictures ─────────────────────────────────────────────────────────── */

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
    });
}
const svgImage = (svg: string) => loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

/** A substance's structure in `color`, framed on what was drawn and fitted
 *  into a box `w` × `h` with its bonds `stroke` pixels wide, as the link
 *  preview cards frame theirs (scripts/og/card.mjs). Null where there's no
 *  structure. */
async function molecule(id: string, color: string, w: number, h: number, stroke: number, labels = true): Promise<HTMLImageElement | null> {
    const s = await loadStructure(id);
    if (!s) return null;
    const markup = molToSvg(s);
    const view = markup.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/)?.slice(1).map(Number);
    if (!view) return null;
    const pad = 9;
    const b = { x: view[0] + pad, y: view[1] + pad, w: view[2] - 2 * pad, h: view[3] - 2 * pad };
    const m = Math.max(2, Math.max(b.w, b.h) * 0.03);
    // Never framed tighter than a mid-sized molecule, so N₂O isn't blown up
    // to the size of LSD.
    const fw = Math.max(b.w + 2 * m, 260);
    const fh = Math.max(b.h + 2 * m, (260 * h) / w);
    const scale = Math.min(w / fw, h / fh);
    // Without labels, the filled shapes go too (wedges, hashes): at that
    // size they read as stray triangles.
    const inner = (labels ? markup : markup.replace(/<g fill="currentColor" stroke="none"[^>]*>[\s\S]*?<\/g>/g, ''))
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '')
        .replace(/stroke-width="[\d.]+"/, `stroke-width="${(stroke / scale).toFixed(2)}"`);
    const vx = b.x + b.w / 2 - w / scale / 2;
    const vy = b.y + b.h / 2 - h / scale / 2;
    return svgImage(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" color="${color}" viewBox="${vx.toFixed(2)} ${vy.toFixed(2)} ${(w / scale).toFixed(2)} ${(h / scale).toFixed(2)}">${inner}</svg>`,
    );
}

/** A QR code to `value`, by the same library the site draws its others with. */
function qr(value: string): Promise<HTMLImageElement | null> {
    const host = document.createElement('div');
    const root = createRoot(host);
    flushSync(() => root.render(createElement(QRCodeSVG, { value, size: 124, level: 'M', bgColor: '#ffffff', fgColor: C.text, marginSize: 0 })));
    let svg = host.innerHTML;
    root.unmount();
    if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return svgImage(svg);
}

/** The same numbers every time for the same page, so its field is its own. */
function seeded(text: string) {
    let h = 2166136261;
    for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    let a = h >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rotated(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, angle: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
}

/** Drawn when none of the page's own substances has a structure. */
const FALLBACK = ['caffeine', 'lsd', 'mdma', 'ketamine'];

async function field(ctx: CanvasRenderingContext2D, ids: string[]) {
    const rand = seeded(ids.join('+'));
    let small = (await Promise.all(ids.map(id => molecule(id, C.field, 214, 186, 2)))).filter(Boolean) as HTMLImageElement[];
    let source = ids;
    if (!small.length) {
        source = FALLBACK;
        small = (await Promise.all(FALLBACK.map(id => molecule(id, C.field, 214, 186, 2)))).filter(Boolean) as HTMLImageElement[];
    }
    if (!small.length) return;
    // Two large and faint, behind the rest: the first substance high on the
    // right, the second (or the first again) low on the left. Lines only:
    // an O or an N that size reads as a stray letter.
    const big = await Promise.all([source[0], source[1] ?? source[0]].map(id => molecule(id, C.field, 860, 860, 2.4, false)));
    ctx.globalAlpha = 0.14;
    if (big[0]) rotated(ctx, big[0], SIZE.w * 0.76, SIZE.h * 0.06, -0.31);
    if (big[1]) rotated(ctx, big[1], SIZE.w * 0.2, SIZE.h * 0.98, 0.42);

    // The lattice: rows staggered by half a cell, the whole turned 16°, each
    // drawing at its own small angle and strength.
    const turn = (-16 * Math.PI) / 180;
    const cw = 296,
        ch = 250;
    const reach = Math.hypot(SIZE.w, SIZE.h) / 2 + 200;
    const n = small.length;
    for (let r = -Math.ceil(reach / ch); r <= Math.ceil(reach / ch); r++)
        for (let c = -Math.ceil(reach / cw); c <= Math.ceil(reach / cw); c++) {
            const u = c * cw + (r & 1 ? cw / 2 : 0);
            const v = r * ch;
            const x = SIZE.w / 2 + u * Math.cos(turn) - v * Math.sin(turn);
            const y = SIZE.h / 2 + u * Math.sin(turn) + v * Math.cos(turn);
            const tilt = turn + (rand() - 0.5) * 0.55;
            const strength = 0.2 + rand() * 0.18;
            if (x < -160 || x > SIZE.w + 160 || y < -160 || y > SIZE.h + 160) continue;
            ctx.globalAlpha = strength;
            rotated(ctx, small[(((r * 2 + c) % n) + n) % n], x, y, tilt);
        }
    ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/* ── the panel ────────────────────────────────────────────────────────── */

const MARGIN = 64;
const PANEL_W = SIZE.w - 2 * MARGIN;
const PAD = 64;
/** The width inside the panel, at full size. */
const PANEL_INNER = PANEL_W - 2 * PAD;
const FOOT = 188;
/** A band of the field always shows above the panel. */
const TOP = 132;
/** The most the panel may stand, so the foot stays clear. */
const ROOM = SIZE.h - FOOT - TOP - 20;
/** The smallest the panel's words are set, as a share of full size. */
const SMALLEST = 0.7;

interface Laid {
    h: number;
    gap: number;
    draw: (x: number, y: number) => void;
}

type Pictures = Map<string, HTMLImageElement | null>;
const key = (id: string, w: number, h: number) => `${id}@${w}x${h}`;

function lay(ctx: CanvasRenderingContext2D, b: Block, first: boolean, pics: Pictures, inner: number): Laid {
    const ink = (k?: Ink) => C[k ?? 'text'];
    switch (b.t) {
        case 'head': {
            const pic = b.mol ? pics.get(key(b.mol, 260, 220)) : null;
            const width = pic ? inner - 284 : inner;
            ctx.font = font(28, 500);
            const eyebrow = b.eyebrow ? wrap(ctx, b.eyebrow, width, 2) : [];
            ctx.font = font(76, 650, true);
            const title = wrap(ctx, b.title, width, 3);
            ctx.font = font(28);
            const sub = b.sub ? wrap(ctx, b.sub, width, 2) : [];
            const textH = eyebrow.length * 28 * 1.4 + (eyebrow.length ? 10 : 0) + title.length * 76 * 1.1 + (sub.length ? 12 + sub.length * 28 * 1.4 : 0);
            const h = Math.max(textH, pic ? 220 : 0);
            return {
                h,
                gap: 0,
                draw: (x, y) => {
                    let at = y + (h - textH) / 2;
                    ctx.fillStyle = C.muted;
                    ctx.font = font(28, 500);
                    lines(ctx, eyebrow, x, at, 28, 1.4);
                    at += eyebrow.length * 28 * 1.4 + (eyebrow.length ? 10 : 0);
                    ctx.fillStyle = C.text;
                    ctx.font = font(76, 650, true);
                    lines(ctx, title, x, at, 76, 1.1);
                    at += title.length * 76 * 1.1 + 12;
                    ctx.fillStyle = C.muted;
                    ctx.font = font(28);
                    lines(ctx, sub, x, at, 28, 1.4);
                    if (pic) ctx.drawImage(pic, x + inner - 260, y + (h - 220) / 2);
                },
            };
        }
        case 'heading': {
            ctx.font = font(26, 600);
            const ls = wrap(ctx, b.text, inner, 2);
            const h = ls.length * 26 * 1.4;
            return {
                h,
                gap: first ? 0 : 40,
                draw: (x, y) => {
                    ctx.fillStyle = C.muted;
                    ctx.font = font(26, 600);
                    lines(ctx, ls, x, y, 26, 1.4);
                },
            };
        }
        case 'text':
        case 'note': {
            const size = b.t === 'note' ? 24 : (b.size ?? 32);
            const weight = b.t === 'note' ? 400 : (b.weight ?? 400);
            ctx.font = font(size, weight);
            const ls = wrap(ctx, b.text, inner, b.t === 'note' ? 4 : 8);
            const h = ls.length * size * 1.45;
            return {
                h,
                gap: first ? 0 : b.t === 'note' ? 44 : 20,
                draw: (x, y) => {
                    ctx.fillStyle = b.t === 'note' ? C.muted : ink(b.ink);
                    ctx.font = font(size, weight);
                    lines(ctx, ls, x, y, size, 1.45);
                },
            };
        }
        case 'word': {
            let size = 132;
            ctx.font = font(size, 650, true);
            while (size > 64 && ctx.measureText(b.text).width > inner) ctx.font = font((size -= 4), 650, true);
            const h = size * 1.08;
            return {
                h,
                gap: first ? 0 : 8,
                draw: (x, y) => {
                    ctx.fillStyle = ink(b.ink);
                    ctx.font = font(size, 650, true);
                    lines(ctx, [b.text], x, y, size, 1.08);
                },
            };
        }
        case 'mols': {
            const per = Math.min(b.items.length, 4) || 1;
            const cell = inner / per;
            // The pictures were drawn for the panel at full size (wanted()).
            const box = { w: Math.round(PANEL_INNER / per - 24), h: 150 };
            ctx.font = font(28, 500);
            const names = b.items.map(i => wrap(ctx, i.name, cell - 16, 2));
            const rows = Math.ceil(b.items.length / per);
            const rowH = box.h + 14 + 2 * 28 * 1.3;
            const h = rows * rowH + (rows - 1) * 16;
            return {
                h,
                gap: first ? 0 : 40,
                draw: (x, y) => {
                    b.items.forEach((item, k) => {
                        const cx = x + (k % per) * cell;
                        const cy = y + Math.floor(k / per) * (rowH + 16);
                        const pic = pics.get(key(item.id, box.w, box.h));
                        if (pic) ctx.drawImage(pic, cx + (cell - box.w) / 2, cy);
                        ctx.fillStyle = C.text;
                        ctx.font = font(28, 500);
                        lines(ctx, names[k], cx + cell / 2, cy + box.h + 14, 28, 1.3, 'center');
                    });
                },
            };
        }
        case 'cols': {
            const n = b.items.length || 1;
            const cell = inner / n;
            const room = cell - 20;
            ctx.font = font(26, 600);
            const labels = b.items.map(i => wrap(ctx, i.label, room, 2));
            ctx.font = font(32, 600);
            const values = b.items.map(i => wrap(ctx, i.value, room, 2));
            const labelH = Math.max(...labels.map(l => l.length)) * 26 * 1.35;
            const valueH = Math.max(...values.map(v => v.length)) * 32 * 1.3;
            const barH = b.bars ? 26 : 0;
            const h = barH + labelH + 8 + valueH;
            return {
                h,
                gap: first ? 0 : 8,
                draw: (x, y) => {
                    b.items.forEach((item, k) => {
                        const cx = x + k * cell;
                        if (b.bars) {
                            ctx.fillStyle = C[item.ink ?? 'muted'];
                            roundRect(ctx, cx, y, room, 8, 4);
                            ctx.fill();
                        }
                        ctx.fillStyle = C[item.ink ?? 'muted'];
                        ctx.font = font(26, 600);
                        lines(ctx, labels[k], cx, y + barH, 26, 1.35);
                        ctx.fillStyle = C.text;
                        ctx.font = font(32, 600);
                        lines(ctx, values[k], cx, y + barH + labelH + 8, 32, 1.3);
                    });
                },
            };
        }
        case 'rows': {
            const anyTime = b.rows.some(r => r.time);
            const anyMol = b.rows.some(r => r.mol);
            const lead = (anyTime ? 112 : 0) + (anyMol ? 76 : 0);
            const laid = b.rows.map(r => {
                ctx.font = font(32, 600);
                const rightW = r.right ? Math.min(ctx.measureText(r.right).width, inner * 0.45) : 0;
                const room = inner - lead - (r.right ? rightW + 28 : 0);
                ctx.font = font(32, r.leftInk && r.leftInk !== 'text' ? 600 : 500);
                const left = wrap(ctx, r.left, room, 2);
                ctx.font = font(26);
                const sub = r.sub ? wrap(ctx, r.sub, inner - lead, 3) : [];
                const h = 18 + Math.max(left.length * 32 * 1.35, anyMol ? 56 : 0) + (sub.length ? 6 + sub.length * 26 * 1.45 : 0) + 18;
                return { r, left, sub, h, room };
            });
            const h = laid.reduce((s, l) => s + l.h, 0);
            return {
                h,
                gap: first ? 0 : 8,
                draw: (x, y) => {
                    let at = y;
                    laid.forEach((l, k) => {
                        if (k) {
                            ctx.fillStyle = C.border;
                            ctx.fillRect(x, at, inner, 2);
                        }
                        const top = at + 18;
                        let lx = x;
                        if (anyTime) {
                            ctx.fillStyle = C.muted;
                            ctx.font = font(30, 500);
                            lines(ctx, [l.r.time ?? ''], lx, top, 32, 1.35);
                            lx += 112;
                        }
                        if (anyMol) {
                            const pic = l.r.mol ? pics.get(key(l.r.mol, 56, 56)) : null;
                            if (pic) ctx.drawImage(pic, lx, top + (Math.max(l.left.length * 32 * 1.35, 56) - 56) / 2);
                            lx += 76;
                        }
                        ctx.fillStyle = C[l.r.leftInk ?? 'text'];
                        ctx.font = font(32, l.r.leftInk && l.r.leftInk !== 'text' ? 600 : 500);
                        lines(ctx, l.left, lx, top, 32, 1.35);
                        if (l.r.right) {
                            ctx.fillStyle = C[l.r.rightInk ?? 'text'];
                            ctx.font = font(32, 600);
                            const fitted = wrap(ctx, l.r.right, inner * 0.45, 1);
                            lines(ctx, fitted, x + inner, top, 32, 1.35, 'right');
                        }
                        if (l.sub.length) {
                            ctx.fillStyle = C.muted;
                            ctx.font = font(26);
                            lines(ctx, l.sub, lx, top + Math.max(l.left.length * 32 * 1.35, anyMol ? 64 : 0) + 6, 26, 1.45);
                        }
                        at += l.h;
                    });
                },
            };
        }
    }
}

/** The blocks laid out in `width`, to fit `room`. With `cut`, the longest
 *  list that may be cut (one that says how many it leaves out) gives up its
 *  last rows until they fit; a dose ladder or a timing never does. */
function layAll(ctx: CanvasRenderingContext2D, blocks: Block[], pics: Pictures, width: number, room: number, cut: boolean) {
    const hidden = blocks.map(() => 0);
    for (;;) {
        const shown = blocks.map((b, k): Block => {
            if (b.t !== 'rows' || !hidden[k]) return b;
            const kept = b.rows.slice(0, b.rows.length - hidden[k]);
            return { ...b, rows: [...kept, { left: b.more!(hidden[k]), leftInk: 'muted' }] };
        });
        const laid = shown.map((b, k) => lay(ctx, b, k === 0, pics, width));
        const h = laid.reduce((s, l) => s + l.gap + l.h, 0);
        if (h <= room || !cut) return { laid, h, fits: h <= room };
        let at = -1;
        let most = 2;
        blocks.forEach((b, k) => {
            if (b.t === 'rows' && b.more && b.rows.length - hidden[k] > most) {
                most = b.rows.length - hidden[k];
                at = k;
            }
        });
        // Nothing left to cut: the panel takes all the room, and clips.
        if (at < 0) return { laid, h: room, fits: false };
        hidden[at]++;
    }
}

/** The panel's words at the largest size that lets them fit, down to
 *  SMALLEST; past that, cut. */
function fit(ctx: CanvasRenderingContext2D, blocks: Block[], pics: Pictures) {
    for (let k = 1; k > SMALLEST - 0.001; k -= 0.03) {
        const r = layAll(ctx, blocks, pics, PANEL_INNER / k, (ROOM - 2 * PAD) / k, false);
        if (r.fits) return { ...r, k };
    }
    return { ...layAll(ctx, blocks, pics, PANEL_INNER / SMALLEST, (ROOM - 2 * PAD) / SMALLEST, true), k: SMALLEST };
}

/* ── the whole ────────────────────────────────────────────────────────── */

/** Every structure the panel draws, at the sizes it draws them. */
function wanted(blocks: Block[]): [string, number, number, number][] {
    const out: [string, number, number, number][] = [];
    for (const b of blocks) {
        if (b.t === 'head' && b.mol) out.push([b.mol, 260, 220, 3]);
        if (b.t === 'rows') for (const r of b.rows) if (r.mol) out.push([r.mol, 56, 56, 1.6]);
        if (b.t === 'mols') {
            const per = Math.min(b.items.length, 4) || 1;
            for (const i of b.items) out.push([i.id, Math.round(PANEL_INNER / per - 24), 150, 2.4]);
        }
    }
    return out;
}

export async function draw(p: Picture): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE.w;
    canvas.height = SIZE.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');

    const url = `${SITE.origin}${p.path ?? '/'}`;
    const [pics, logo, code] = await Promise.all([
        Promise.all(wanted(p.blocks).map(async ([id, w, h, stroke]) => [key(id, w, h), await molecule(id, C.accent, w, h, stroke)] as const)).then(
            all => new Map(all) as Pictures,
        ),
        loadImage('/logo.png'),
        qr(url),
    ]);

    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, SIZE.w, SIZE.h);
    await field(ctx, p.field);

    // The panel, its words as large as fit, a little above the middle of the room it has.
    const { laid, h: inner, k } = fit(ctx, p.blocks, pics);
    const h = Math.round(inner * k + 2 * PAD);
    const top = Math.max(TOP, Math.round((SIZE.h - FOOT - h) * 0.45));
    roundRect(ctx, MARGIN, top, PANEL_W, h, 40);
    // Not quite opaque: the field shows through it faintly, as a texture.
    ctx.fillStyle = C.panel;
    ctx.globalAlpha = 0.86;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    roundRect(ctx, MARGIN, top, PANEL_W, h, 40);
    ctx.clip();
    ctx.translate(MARGIN + PAD, top + PAD);
    ctx.scale(k, k);
    let y = 0;
    for (const l of laid) {
        y += l.gap;
        l.draw(0, y);
        y += l.h;
    }
    ctx.restore();

    // The foot, on the field: a card with the logo, the site's name and the
    // address, and one with the QR code, both white with round corners.
    const side = 148;
    const fy = SIZE.h - FOOT + (FOOT - side) / 2;
    const codeX = SIZE.w - MARGIN - side;
    const card = (x: number, w: number) => {
        roundRect(ctx, x, fy, w, side, 28);
        ctx.fillStyle = C.panel;
        ctx.globalAlpha = 0.94;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 2;
        ctx.stroke();
    };
    const address = url.replace(/^https:\/\//, '').replace(/\/$/, '');
    ctx.font = font(28, 500);
    const tx = MARGIN + 30 + 88 + 24;
    const most = codeX - 24 - 30 - tx;
    const shown = wrap(ctx, address, most, 1);
    ctx.font = font(34, 650, true);
    const textW = Math.max(ctx.measureText(SITE.name).width, (() => {
        ctx.font = font(28, 500);
        return ctx.measureText(shown[0] ?? '').width;
    })());
    card(MARGIN, Math.min(tx - MARGIN + textW + 36, codeX - 24 - MARGIN));
    if (logo) {
        ctx.save();
        roundRect(ctx, MARGIN + 30, fy + (side - 88) / 2, 88, 88, 22);
        ctx.clip();
        ctx.drawImage(logo, MARGIN + 30, fy + (side - 88) / 2, 88, 88);
        ctx.restore();
    }
    ctx.fillStyle = C.text;
    ctx.font = font(34, 650, true);
    lines(ctx, [SITE.name], tx, fy + side / 2 - 44, 34, 1.3);
    ctx.fillStyle = C.muted;
    ctx.font = font(28, 500);
    lines(ctx, shown, tx, fy + side / 2 + 2, 28, 1.4);
    if (code) {
        card(codeX, side);
        ctx.drawImage(code, codeX + 14, fy + 14, side - 28, side - 28);
    }

    return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('No picture'))), 'image/png'));
}
