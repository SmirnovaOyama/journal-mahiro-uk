import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import { loadStructure } from '../components/Molecule';
import { clockTimes, curvePieces, nightSpan, type CurveDose } from './curve';
import { currentLang } from './i18n';
import { molToSvg } from './molsvg';
import { SITE } from './preview';

/* A night in the journal kept as a picture, 1080 × 1440 (3:4), to save
   to a phone or send. Drawn on this device on a canvas: the night never
   leaves it.

   Behind it, a field of the night's own substances drawn as skeletal
   formulas (lib/molsvg.ts) in the accent's terracotta: two large and faint,
   lines only, then a lattice of small ones turned a little off the square,
   each at its own angle and strength. Flat ink, no gradients. On it, a
   white panel with round corners: the date, then the night's curve, as
   large as the room allows (the session chart's own shapes, lib/curve.ts),
   then each dose and what didn't mix. At the foot, the logo and the site
   on one card, a QR code to it on another.

   The page hands over its words already in the reader's language (Block);
   nothing here translates. Loaded only when a picture is first drawn. */

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

/** One line of a grid: a time before it, a name in its own colour, and
 *  a value after it. */
export interface Cell {
    lead?: string;
    label: string;
    /** Any CSS colour: a substance's own, as its curve is drawn. */
    color?: string;
    value?: string;
    valueInk?: Ink;
}

export type Block =
    /** What the picture is of: a small line over its title. */
    | { t: 'head'; eyebrow?: string; title: string }
    /** A small heading over what follows. */
    | { t: 'heading'; text: string }
    | { t: 'text'; text: string; size?: number; ink?: Ink }
    /** A night's curve: each dose as the session chart draws it, in its
     *  substance's colour. `h` is set when the picture is laid out. */
    | { t: 'chart'; doses: (CurveDose & { color: string })[]; now?: { at: number; label: string }; h?: number }
    /** Lines in one or two columns; with `more`, the last give way, when
     *  there isn't room, to a line saying how many are left out. */
    | { t: 'grid'; cells: Cell[]; cols: 1 | 2; more?: (n: number) => string }
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


/** A colour as the canvas is sure to read it: the journal keeps a
 *  substance's as oklch(), which an older canvas doesn't know. */
function colour(css: string): string {
    const m = css.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/);
    if (!m) return css;
    const [l, c, h] = [Number(m[1]) / 100, Number(m[2]), Number(m[3])];
    const a = c * Math.cos((h * Math.PI) / 180),
        b = c * Math.sin((h * Math.PI) / 180);
    const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
        m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
        s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const to = (v: number) => {
        const x = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, x)) * 255)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${to(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_)}${to(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_)}${to(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)}`;
}

/** The chart's height when there's room for nothing else, and at most. */
const CHART_MIN = 380;
const CHART_MAX = 660;

function lay(ctx: CanvasRenderingContext2D, b: Block, first: boolean, inner: number): Laid {
    switch (b.t) {
        case 'head': {
            ctx.font = font(28, 500);
            const eyebrow = b.eyebrow ? wrap(ctx, b.eyebrow, inner, 2) : [];
            ctx.font = font(68, 650, true);
            const title = wrap(ctx, b.title, inner, 2);
            const h = eyebrow.length * 28 * 1.4 + (eyebrow.length ? 8 : 0) + title.length * 68 * 1.12;
            return {
                h,
                gap: 0,
                draw: (x, y) => {
                    ctx.fillStyle = C.muted;
                    ctx.font = font(28, 500);
                    lines(ctx, eyebrow, x, y, 28, 1.4);
                    ctx.fillStyle = C.text;
                    ctx.font = font(68, 650, true);
                    lines(ctx, title, x, y + eyebrow.length * 28 * 1.4 + (eyebrow.length ? 8 : 0), 68, 1.12);
                },
            };
        }
        case 'heading': {
            ctx.font = font(26, 600);
            const ls = wrap(ctx, b.text, inner, 2);
            return {
                h: ls.length * 26 * 1.4,
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
            const size = b.t === 'note' ? 24 : (b.size ?? 30);
            ctx.font = font(size);
            const ls = wrap(ctx, b.text, inner, b.t === 'note' ? 4 : 6);
            return {
                h: ls.length * size * 1.45,
                gap: first ? 0 : b.t === 'note' ? 36 : 20,
                draw: (x, y) => {
                    ctx.fillStyle = b.t === 'note' ? C.muted : C[b.ink ?? 'text'];
                    ctx.font = font(size);
                    lines(ctx, ls, x, y, size, 1.45);
                },
            };
        }
        case 'chart': {
            const h = b.h ?? CHART_MIN;
            return { h, gap: first ? 0 : 36, draw: (x, y) => chart(ctx, b, x, y, inner, h) };
        }
        case 'grid': {
            const gutter = 40;
            const cell = (inner - (b.cols - 1) * gutter) / b.cols;
            const size = 28;
            const row = size * 1.7;
            ctx.font = font(size, 500);
            const leadW = Math.max(0, ...b.cells.map(c => (c.lead ? ctx.measureText(c.lead).width + 18 : 0)));
            const rows = Math.ceil(b.cells.length / b.cols);
            return {
                h: rows * row,
                gap: first ? 0 : 12,
                draw: (x, y) => {
                    b.cells.forEach((c, k) => {
                        const cx = x + (k % b.cols) * (cell + gutter);
                        const cy = y + Math.floor(k / b.cols) * row + (row - size * 1.3) / 2;
                        ctx.font = font(size, 500);
                        if (c.lead) {
                            ctx.fillStyle = C.muted;
                            lines(ctx, [c.lead], cx, cy, size, 1.3);
                        }
                        ctx.font = font(size, 500);
                        const valueW = c.value ? Math.min(ctx.measureText(c.value).width, cell * 0.55) : 0;
                        if (c.value) {
                            ctx.fillStyle = C[c.valueInk ?? 'muted'];
                            lines(ctx, wrap(ctx, c.value, cell * 0.55, 1), cx + cell, cy, size, 1.3, 'right');
                        }
                        ctx.font = font(size, 600);
                        ctx.fillStyle = c.color ? colour(c.color) : C.text;
                        lines(ctx, wrap(ctx, c.label, cell - leadW - valueW - 16, 1), cx + leadW, cy, size, 1.3);
                    });
                },
            };
        }
    }
}

/** A night's curve in `w` × `h`: three gridlines, each dose's curve filled
 *  faintly and drawn in its colour, a ring on the baseline where it was
 *  taken, the clock times under, and "now" if the night is going on. */
function chart(ctx: CanvasRenderingContext2D, b: Extract<Block, { t: 'chart' }>, x0: number, y0: number, w: number, h: number) {
    if (!b.doses.length) return;
    const span = nightSpan(b.doses, b.now?.at ?? null);
    const top = y0 + 30;
    const base = y0 + h - 58;
    const x = (t: number) => x0 + ((t - span.start) / (span.end - span.start)) * w;
    const y = (level: number) => base - level * (base - top);
    ctx.fillStyle = C.border;
    for (const l of [0, 0.5, 1]) ctx.fillRect(x0, Math.round(y(l)) - 1, w, 2);

    const trace = (d: CurveDose) => {
        ctx.beginPath();
        curvePieces(d, x, y).forEach((p, k) => {
            if ('line' in p) {
                if (!k) ctx.moveTo(p.line[0][0], p.line[0][1]);
                ctx.lineTo(p.line[1][0], p.line[1][1]);
            } else {
                const [, c1, c2, e] = p.cubic;
                ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
            }
        });
    };
    const order = [...b.doses].sort((p, q) => p.time - q.time);
    // Every fill first, then every line over them, so no fill veils a line.
    for (const d of order)
        if (d.course) {
            trace(d);
            ctx.closePath();
            ctx.fillStyle = colour(d.color);
            ctx.globalAlpha = 0.12;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const d of order)
        if (d.course) {
            trace(d);
            ctx.strokeStyle = colour(d.color);
            ctx.stroke();
        }
    for (const d of order) {
        ctx.beginPath();
        ctx.arc(x(d.time), y(0), 9, 0, Math.PI * 2);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = colour(d.color);
        ctx.stroke();
    }

    // The clock times, as many as sit apart at this size.
    ctx.fillStyle = C.muted;
    ctx.font = font(26, 500);
    const times = clockTimes(span, w, x, 150, 120).filter(t => t === span.first || (x(t) > x0 + 40 && x(t) < x0 + w - 40));
    for (const t of times) {
        const d = new Date(t);
        const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        lines(ctx, [label], x(t), base + 20, 26, 1.3, t === span.first && x(t) < x0 + 50 ? 'left' : 'center');
    }

    if (b.now && b.now.at >= span.start && b.now.at <= span.end) {
        const nx = x(b.now.at);
        ctx.strokeStyle = C.text;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(nx, top);
        ctx.lineTo(nx, base);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.muted;
        ctx.font = font(24, 500);
        lines(ctx, [b.now.label], nx, top - 30, 24, 1.2, nx > x0 + w - 40 ? 'right' : 'center');
    }
}

/** The blocks laid out in `width`, to fit `room`. With `cut`, the longest
 *  grid that may be cut (one that says how many it leaves out) gives up its
 *  last lines until they fit. */
function layAll(ctx: CanvasRenderingContext2D, blocks: Block[], width: number, room: number, cut: boolean) {
    const hidden = blocks.map(() => 0);
    for (;;) {
        const shown = blocks.map((b, k): Block => {
            if (b.t !== 'grid' || !hidden[k]) return b;
            return { ...b, cells: [...b.cells.slice(0, b.cells.length - hidden[k]), { label: b.more!(hidden[k]), color: C.muted }] };
        });
        const laid = shown.map((b, k) => lay(ctx, b, k === 0, width));
        const h = laid.reduce((s, l) => s + l.gap + l.h, 0);
        if (h <= room || !cut) return { laid, h, fits: h <= room };
        let at = -1;
        let most = 2;
        blocks.forEach((b, k) => {
            if (b.t === 'grid' && b.more && b.cells.length - hidden[k] > most) {
                most = b.cells.length - hidden[k];
                at = k;
            }
        });
        // Nothing left to cut: the panel takes all the room, and clips.
        if (at < 0) return { laid, h: room, fits: false };
        // A whole line of the grid at a time.
        const b = blocks[at];
        hidden[at] += b.t === 'grid' ? b.cols : 1;
    }
}

/** The chart as tall as the room left lets it be; then the words at the
 *  largest size that fits, down to SMALLEST; past that, cut. */
function fit(ctx: CanvasRenderingContext2D, given: Block[]) {
    const room = ROOM - 2 * PAD;
    const withChart = (h: number) => given.map(b => (b.t === 'chart' ? { ...b, h } : b));
    const rest = layAll(ctx, withChart(0), PANEL_INNER, Infinity, false).h;
    const blocks = withChart(Math.round(Math.max(CHART_MIN, Math.min(CHART_MAX, room - rest))));
    for (let k = 1; k > SMALLEST - 0.001; k -= 0.03) {
        const r = layAll(ctx, blocks, PANEL_INNER / k, room / k, false);
        if (r.fits) return { ...r, k };
    }
    return { ...layAll(ctx, blocks, PANEL_INNER / SMALLEST, room / SMALLEST, true), k: SMALLEST };
}

/* ── the whole ────────────────────────────────────────────────────────── */

export async function draw(p: Picture): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE.w;
    canvas.height = SIZE.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');

    const url = `${SITE.origin}${p.path ?? '/'}`;
    const [logo, code] = await Promise.all([loadImage('/logo.png'), qr(url)]);

    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, SIZE.w, SIZE.h);
    await field(ctx, p.field);

    // The panel, its words as large as fit, a little above the middle of the room it has.
    const { laid, h: inner, k } = fit(ctx, p.blocks);
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
