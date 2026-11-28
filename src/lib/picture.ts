import { loadStructure } from '../components/Molecule';
import { clockTimes, curvePieces, nightSpan, type CurveDose } from './curve';
import { currentLang } from './i18n';
import { molToSvg } from './molsvg';
import { SITE } from './preview';

/* A night in the journal kept as a picture, 1080 × 1440 (3:4), drawn on
   this device on a canvas: the night never leaves it.

   The night drawn on its own dial, in the design system's dark theme: a
   picture of a night, so it is set as the app is after dark, its tokens
   and nothing else (oyama-tokens.css, dark), every size a token of the
   type scale at twice its size.

   - The dial runs through the night alone, from its start at the top,
     clockwise, to its end, open where the two meet (as the substance
     page's ClockDial runs round its day). A mark for every hour.
   - Each dose has its own ring, the first innermost, as a tree's rings
     go, and along it from the time it was taken a ribbon in its
     substance's colour, as wide as the effect is strong: a point where it
     was taken, full at its peak, thinning as it wears off (its level is
     the session chart's curve, lib/curve.ts). Its name, time and amount
     sit outside the dial, a hairline from its ring to them.
   - In the middle, the day of the month as a reading (300, -0.035em),
     with the month, the weekday and the times.
   - Under the dial, each substance drawn as its structure, all at one
     scale, in `brand`, its name in its colour and what it came to; then
     what didn't mix, each status in its colour and in words; the rating;
     and at the foot the logo and the host.

   Or, chosen in Settings, the night along a line, as the session chart
   draws it in the app, and so in the light theme: the date as a reading
   over it, and under it the same structures, what didn't mix and the
   rating.

   Flat throughout: no gradient, glow or shadow. The page hands over its
   words already in the reader's language; nothing here translates.
   Loaded only when a picture is first drawn. */

export const SIZE = { w: 1080, h: 1440 };

/** The dark theme's tokens, as hex: the dial's. */
const DARK = {
    bg: '#181714',
    text: '#fbfbf9',
    muted: '#a7a49e',
    border: '#373530',
    grid: '#2c2a26',
    brand: '#df8f74',
    warning: '#f5b75b',
    danger: '#fb817f',
    positive: '#64d8a4',
    info: '#80bdfb',
};

/** The light theme's (oyama-tokens.css), as the canvas reads them: the
 *  line's, so it is the session chart as the app shows it. */
const LIGHT: typeof DARK = {
    bg: '#ffffff',
    text: colour('oklch(20.5% 0.006 90)'),
    muted: colour('oklch(51.7% 0.013 90)'),
    border: colour('oklch(91% 0.007 89)'),
    grid: colour('oklch(94.5% 0.004 88)'),
    brand: colour('oklch(65.8% 0.1131 39.15)'),
    warning: colour('oklch(53% 0.13 55)'),
    danger: colour('oklch(53% 0.19 27)'),
    positive: colour('oklch(52% 0.11 162)'),
    info: colour('oklch(52% 0.17 255)'),
};

/** The tokens of the picture being drawn. */
let C = DARK;

export type Status = 'danger' | 'warning' | 'info' | 'positive' | 'muted';

/** A dose round the dial, and what's written at its tip. */
export interface ChartDose extends CurveDose {
    color: string;
    name: string;
    /** Its time and amount, under the name. */
    detail: string;
}

/** The night round a dial, or along a line as the session chart draws it. */
export type PictureStyle = 'dial' | 'lines';

export interface NightPicture {
    style: PictureStyle;
    /** The night's own name, if it was given one. */
    title?: string;
    /** In the middle of the dial: the month over the day, the weekday and the times under it. */
    month: string;
    day: string;
    weekday: string;
    span: string;
    /** Each substance of the night, in the order first taken, and what it came to. */
    substances: { id: string; name: string; color: string; total?: string }[];
    doses: ChartDose[];
    now?: { at: number; label: string };
    /** What didn't mix. */
    pairs?: { label: string; word: string; status: Status }[];
    /** The rating, in a muted line. */
    rating?: string;
    /** What the file is called, without .png. */
    file: string;
}

/* ── type ─────────────────────────────────────────────────────────────── */

/** The tokens' families (oyama-tokens.css `--font-sans`, `--font-display`),
 *  with the PingFang the page language picks. */
function faces() {
    const cjk = currentLang() === 'zh-Hant' ? '"PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei"' : '"PingFang SC", "Noto Sans CJK SC", "Microsoft YaHei"';
    const rest = `ui-sans-serif, system-ui, ${cjk}, "Hiragino Sans", "Apple SD Gothic Neo", "Segoe UI", Helvetica, Arial, sans-serif`;
    return { sans: `-apple-system, BlinkMacSystemFont, "SF Pro Text", ${rest}`, display: `"SF Pro Display", -apple-system, BlinkMacSystemFont, ${rest}` };
}
const font = (size: number, weight: 300 | 400 | 500 | 600 = 400, display = false) => `${weight} ${size}px ${display ? faces().display : faces().sans}`;
/** Letter spacing in em, where the canvas takes it. */
function track_(ctx: CanvasRenderingContext2D, em: number, size: number) {
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${em * size}px`;
}

/** One character of Chinese or Japanese, or a word, or a space. */
const TOKEN = /[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+|\s+/g;
/** What may not start a line: it hangs off the end of the one before. */
const NO_START = /^[，。、；：！？）」』》〉,.;:!?)\]%％]/;

/** A paragraph broken into lines no wider than `width`; with `max`, the
 *  last one kept ends in an ellipsis. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max = Infinity): string[] {
    const fits = (s: string) => ctx.measureText(s.trimEnd()).width <= width;
    const out: string[] = [];
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
        if (cur.trim()) out.push(cur.trimEnd());
        cur = '';
        let word = tok;
        while (!fits(word)) {
            let k = word.length - 1;
            while (k > 1 && !fits(word.slice(0, k))) k--;
            out.push(word.slice(0, k));
            word = word.slice(k);
        }
        cur = word;
    }
    if (cur.trim()) out.push(cur.trimEnd());
    if (out.length > max) {
        const kept = out.slice(0, max);
        let last = kept[max - 1];
        while (last && !fits(`${last}…`)) last = last.slice(0, -1);
        kept[max - 1] = `${last.trimEnd()}…`;
        return kept;
    }
    return out;
}

/** Lines drawn from `top`, each centred in its own line box. */
function lines(ctx: CanvasRenderingContext2D, ls: string[], x: number, top: number, size: number, leading: number, align: CanvasTextAlign = 'left') {
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ls.forEach((l, i) => ctx.fillText(l, x, top + (i + 0.5) * size * leading));
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

/* ── pictures ─────────────────────────────────────────────────────────── */

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
    });
}

/** A structure's drawing and its size in the renderer's own units (a bond
 *  is 30), framed on what was drawn. */
interface Drawn {
    markup: string;
    x: number;
    y: number;
    w: number;
    h: number;
}
async function structureOf(id: string): Promise<Drawn | null> {
    const s = await loadStructure(id);
    if (!s) return null;
    const markup = molToSvg(s);
    const view = markup.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/)?.slice(1).map(Number);
    if (!view) return null;
    // The renderer frames what it drew with a margin of its own (0.3 of a bond).
    const pad = 9;
    return { markup, x: view[0] + pad, y: view[1] + pad, w: view[2] - 2 * pad, h: view[3] - 2 * pad };
}

/** A structure drawn at `scale` pixels to its unit, its bonds `stroke`
 *  pixels wide, in `color`. */
function structureImage(d: Drawn, scale: number, stroke: number, color: string): Promise<HTMLImageElement | null> {
    const w = Math.ceil(d.w * scale) + 8,
        h = Math.ceil(d.h * scale) + 8;
    const inner = d.markup
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>\s*$/, '')
        .replace(/stroke-width="[\d.]+"/, `stroke-width="${(stroke / scale).toFixed(2)}"`);
    const m = 4 / scale;
    return loadImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" color="${color}" viewBox="${(d.x - m).toFixed(2)} ${(d.y - m).toFixed(2)} ${(w / scale).toFixed(2)} ${(h / scale).toFixed(2)}">${inner}</svg>`,
        )}`,
    );
}

/* ── the dial ─────────────────────────────────────────────────────────── */

/** The gap at the top of the dial, where the night begins and ends. */
const GAP = (34 * Math.PI) / 180;
const START = -Math.PI / 2 + GAP / 2;
const SWEEP = Math.PI * 2 - GAP;

/** The night round the dial: from its start at the top, clockwise, to its end. */
function angler(span: { start: number; end: number }) {
    return (t: number) => START + ((t - span.start) / (span.end - span.start)) * SWEEP;
}

/** Samples along a dose's curve: its time, and its level from 0 to 1. */
function samples(d: CurveDose): [number, number][] {
    const out: [number, number][] = [];
    for (const p of curvePieces(d, t => t, l => l)) {
        if ('line' in p) {
            const [[t0, l0], [t1, l1]] = p.line;
            for (let k = 0; k <= 24; k++) out.push([t0 + ((t1 - t0) * k) / 24, l0 + ((l1 - l0) * k) / 24]);
        } else {
            const [a, b, c, e] = p.cubic;
            for (let k = 0; k <= 48; k++) {
                const s = k / 48,
                    u = 1 - s;
                out.push([
                    u * u * u * a[0] + 3 * u * u * s * b[0] + 3 * u * s * s * c[0] + s * s * s * e[0],
                    u * u * u * a[1] + 3 * u * u * s * b[1] + 3 * u * s * s * c[1] + s * s * s * e[1],
                ]);
            }
        }
    }
    return out;
}

/** The night on its dial, `outer` the outermost ring's reach; what's
 *  written beside it stays inside `bounds`.
 *
 *  Each dose has its own ring, the first innermost, as a tree's rings go.
 *  Along it, from the time it was taken, a ribbon as wide as the effect
 *  is strong: a point where it was taken, full at its peak, thinning as it
 *  wears off (its level is the session chart's curve). Round the outside,
 *  a mark for every hour. In the middle, the date. */
function dial(ctx: CanvasRenderingContext2D, p: NightPicture, cx: number, cy: number, outer: number, bounds: { top: number; bottom: number }) {
    const inner = outer * 0.5;
    const span = nightSpan(p.doses, p.now?.at ?? null);
    const angle = angler(span);
    const order = [...p.doses].sort((a, b) => a.time - b.time);
    const n = order.length;
    const pitch = (outer - inner) / Math.max(n, 1);
    const width = Math.max(6, Math.min(40, pitch - 10));
    const radius = (k: number) => inner + pitch * (k + 0.5);

    // The rings, faint, round the night's part of the dial.
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 2;
    order.forEach((_, k) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius(k), START, START + SWEEP);
        ctx.stroke();
    });

    // Every hour, a mark round the outside.
    const first = new Date(span.start);
    first.setMinutes(0, 0, 0);
    ctx.strokeStyle = C.border;
    ctx.lineCap = 'round';
    for (let t = first.getTime() + 3_600_000; t < span.end; t += 3_600_000) {
        const a = angle(t);
        ctx.beginPath();
        ctx.moveTo(cx + (outer + 10) * Math.cos(a), cy + (outer + 10) * Math.sin(a));
        ctx.lineTo(cx + (outer + 22) * Math.cos(a), cy + (outer + 22) * Math.sin(a));
        ctx.stroke();
    }

    // The ribbons.
    order.forEach((d, k) => {
        if (!d.course) return;
        const r = radius(k);
        const pts = samples(d);
        const edge = (sign: 1 | -1) => pts.map(([t, l]): [number, number] => {
            const a = angle(t);
            const rr = r + sign * Math.max(1.5, (l * width) / 2);
            return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
        });
        const out = edge(1),
            back = edge(-1).reverse();
        ctx.beginPath();
        ctx.moveTo(out[0][0], out[0][1]);
        for (const [x, y] of out) ctx.lineTo(x, y);
        for (const [x, y] of back) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fillStyle = colour(d.color);
        ctx.fill();
    });

    // A hollow ring where each was taken.
    order.forEach((d, k) => {
        const a = angle(d.time);
        const r = radius(k);
        ctx.beginPath();
        ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), 8, 0, Math.PI * 2);
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = colour(d.color);
        ctx.stroke();
    });

    // Now, on a night still going: a dotted line across the rings.
    if (p.now) {
        const a = angle(p.now.at);
        ctx.strokeStyle = C.text;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(cx + (inner - 6) * Math.cos(a), cy + (inner - 6) * Math.sin(a));
        ctx.lineTo(cx + (outer + 22) * Math.cos(a), cy + (outer + 22) * Math.sin(a));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.muted;
        ctx.font = font(24);
        lines(ctx, [p.now.label], cx + (outer + 46) * Math.cos(a), cy + (outer + 46) * Math.sin(a) - 15, 24, 1.3, 'center');
    }

    // In the middle: the month, the day as a reading, the weekday and the times.
    const daySize = Math.round(Math.min(168, inner * 0.78));
    const stack = 26 * 1.3 + daySize * 0.96 + 26 * 1.3 + 24 * 1.3;
    let y = cy - stack / 2;
    ctx.fillStyle = C.muted;
    ctx.font = font(26);
    lines(ctx, [p.month], cx, y, 26, 1.3, 'center');
    y += 26 * 1.3;
    ctx.fillStyle = C.text;
    ctx.font = font(daySize, 300, true);
    track_(ctx, -0.035, daySize);
    lines(ctx, [p.day], cx, y, daySize, 0.96, 'center');
    track_(ctx, 0, 1);
    y += daySize * 0.96;
    ctx.fillStyle = C.muted;
    ctx.font = font(26);
    lines(ctx, [p.weekday], cx, y, 26, 1.3, 'center');
    y += 26 * 1.3;
    ctx.font = font(24);
    lines(ctx, [p.span], cx, y, 24, 1.3, 'center');

    // Each dose's name, time and amount in one of two columns beside the
    // dial, the right for those taken on its right half, the left for the
    // rest, in the order they come down the page. A hairline runs straight
    // out from where each was taken, then level to its words.
    const NAME = 26,
        DETAIL = 24;
    const boxH = NAME * 1.3 + DETAIL * 1.3;
    const items = order.map((d, k) => {
        const a = angle(d.time);
        return { d, a, r: radius(k), want: cy + (outer + 30) * Math.sin(a) - boxH / 2 };
    });
    for (const side of [1, -1] as const) {
        const col = items.filter(it => (side === 1 ? Math.cos(it.a) >= 0 : Math.cos(it.a) < 0)).sort((a, b) => a.want - b.want);
        // Spread down the page so none lies over another, then back up if the last runs out of room.
        const ys = col.map(it => it.want);
        for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], bounds.top, i ? ys[i - 1] + boxH + 16 : -Infinity);
        for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], bounds.bottom - boxH, i < ys.length - 1 ? ys[i + 1] - boxH - 16 : Infinity);
        const colX = cx + side * (outer + 64);
        col.forEach((it, i) => {
            const y0 = ys[i];
            const mid = y0 + boxH / 2;
            const px = cx + (outer + 18) * Math.cos(it.a),
                py = cy + (outer + 18) * Math.sin(it.a);
            ctx.strokeStyle = C.border;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(cx + (it.r + 10) * Math.cos(it.a), cy + (it.r + 10) * Math.sin(it.a));
            ctx.lineTo(px, py);
            ctx.lineTo(px + side * 16, mid);
            ctx.lineTo(colX - side * 12, mid);
            ctx.stroke();
            ctx.textAlign = side === 1 ? 'left' : 'right';
            ctx.textBaseline = 'middle';
            ctx.font = font(NAME, 500);
            ctx.fillStyle = colour(it.d.color);
            ctx.fillText(it.d.name, colX, y0 + (NAME * 1.3) / 2);
            ctx.font = font(DETAIL);
            ctx.fillStyle = C.muted;
            ctx.fillText(it.d.detail, colX, y0 + NAME * 1.3 + (DETAIL * 1.3) / 2);
        });
    }
}

/** The widest of the doses' words, so the dial leaves room for its columns. */
function labelWidth(ctx: CanvasRenderingContext2D, doses: ChartDose[]) {
    let w = 0;
    for (const d of doses) {
        ctx.font = font(26, 500);
        w = Math.max(w, ctx.measureText(d.name).width);
        ctx.font = font(24);
        w = Math.max(w, ctx.measureText(d.detail).width);
    }
    return w;
}

/** How tall the line's chart is against its width: the session chart's
 *  proportion on a phone. */
const FLAT = 0.4;

/* ── the line ─────────────────────────────────────────────────────────── */

/** The night along a line, just as the session chart draws it
 *  (SessionChart), at twice its size, in the app's light theme: three
 *  gridlines, each dose's curve in its colour over a faint fill of it, a
 *  hollow ring on the baseline where it was taken, the clock times under,
 *  and "now" a dotted upright with the word over it. Which curve is which
 *  is said under the chart, each substance's name in its colour. */
function timeline(ctx: CanvasRenderingContext2D, p: NightPicture, x0: number, y0: number, w: number, h: number) {
    const span = nightSpan(p.doses, p.now?.at ?? null);
    const x = (t: number) => x0 + ((t - span.start) / (span.end - span.start)) * w;
    const order = [...p.doses].sort((a, b) => a.time - b.time);
    const now = p.now && p.now.at >= span.start && p.now.at <= span.end ? p.now : null;

    // The chart's own measures (TOP, BASE, its times' line) at 2x, and its
    // own proportion, as flat as it is on a phone: the gridlines' height
    // FLAT of the width. It stands in the middle of the room it is given.
    const head = now ? 24 * 1.3 + 4 : 0;
    const plotH = Math.min(w * FLAT, h - head - 16 - 52);
    const nowTop = y0 + (h - (head + 16 + plotH + 52)) / 2 + head;
    const base = nowTop + 16 + plotH;
    const y = (level: number) => base - level * plotH;

    ctx.fillStyle = C.grid;
    for (const l of [0, 0.5, 1]) ctx.fillRect(x0, Math.round(y(l)) - 1, w, 2);
    const trace = (d: CurveDose) => {
        ctx.beginPath();
        curvePieces(d, x, y).forEach((piece, k) => {
            if ('line' in piece) {
                if (!k) ctx.moveTo(piece.line[0][0], piece.line[0][1]);
                ctx.lineTo(piece.line[1][0], piece.line[1][1]);
            } else {
                const [, c1, c2, e] = piece.cubic;
                ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
            }
        });
    };
    for (const d of order)
        if (d.course) {
            trace(d);
            ctx.closePath();
            ctx.fillStyle = colour(d.color);
            ctx.globalAlpha = 0.1;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    ctx.lineWidth = 4;
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
        ctx.arc(x(d.time), y(0), 8, 0, Math.PI * 2);
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = colour(d.color);
        ctx.stroke();
    }

    ctx.fillStyle = C.muted;
    ctx.font = font(24);
    ctx.textBaseline = 'alphabetic';
    for (const t of clockTimes(span, w, x, 150, 120).filter(t => t === span.first || (x(t) > x0 + 36 && x(t) < x0 + w - 36))) {
        const d = new Date(t);
        ctx.textAlign = t === span.first && x(t) < x0 + 40 ? 'left' : 'center';
        ctx.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, x(t), base + 44);
    }
    if (now) {
        const nx = x(now.at);
        ctx.strokeStyle = C.text;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        ctx.lineCap = 'butt';
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(nx, nowTop);
        ctx.lineTo(nx, base);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.muted;
        ctx.textAlign = nx > x0 + w - 60 ? 'right' : 'center';
        ctx.fillText(now.label, nx, nowTop - 8);
    }
}

/* ── the page ─────────────────────────────────────────────────────────── */

/** The page's margins, as the link preview cards set theirs. */
const LEFT = 80;
const ACROSS = SIZE.w - 2 * LEFT;
const TOP = 80;
/** The logo at the foot, and how far its bottom edge sits from the page's. */
const LOGO = 80;
const BOTTOM = 72;
/** Room round the dial for what's written at the petals' tips. */
const MARGIN = 104;
/** The structures are drawn no taller than this. */
const SPECIMEN = 104;

export async function draw(p: NightPicture): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE.w;
    canvas.height = SIZE.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    C = p.style === 'dial' ? DARK : LIGHT;

    const [logo, drawn] = await Promise.all([loadImage('/logo.png'), Promise.all(p.substances.map(s => structureOf(s.id)))]);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SIZE.w, SIZE.h);

    // The night's name, if it has one, in the display face.
    let y = TOP;
    if (p.title) {
        ctx.font = font(56, 400, true);
        track_(ctx, -0.03, 56);
        const title = wrap(ctx, p.title, ACROSS, 2);
        ctx.fillStyle = C.text;
        lines(ctx, title, LEFT, y, 56, 1.1);
        track_(ctx, 0, 1);
        y += title.length * 56 * 1.1;
    }

    // From the foot up: the logo; the rating; what didn't mix; the structures.
    const footTop = SIZE.h - BOTTOM - LOGO;
    let bottom = footTop - 56;
    const ratingTop = bottom - (p.rating ? 26 * 1.45 : 0);
    if (p.rating) bottom = ratingTop - 16;
    const pairLines: { label: string; word: string; ink: string }[][] = [];
    if (p.pairs?.length) {
        // Each pair and its status, side by side, as many to a line as fit.
        let line: { label: string; word: string; ink: string }[] = [];
        let used = 0;
        for (const r of p.pairs) {
            ctx.font = font(26);
            const w = ctx.measureText(r.label).width + 12 + (ctx.font = font(26, 500), ctx.measureText(r.word).width) + 48;
            if (line.length && used + w > ACROSS + 48) {
                pairLines.push(line);
                line = [];
                used = 0;
            }
            line.push({ ...r, ink: C[r.status] });
            used += w;
        }
        if (line.length) pairLines.push(line);
        pairLines.splice(3);
        bottom -= pairLines.length * 26 * 1.6 + 8;
    }
    const pairsTop = bottom + 8;

    const known = p.substances.map((s, k) => ({ ...s, d: drawn[k] })).filter((s): s is NightPicture['substances'][number] & { d: Drawn } => !!s.d);
    let scale = 0;
    if (known.length) {
        const wide = known.reduce((sum, s) => sum + s.d.w, 0);
        scale = Math.min(0.5, (ACROSS - (known.length - 1) * 64) / wide, SPECIMEN / Math.max(...known.map(s => s.d.h)));
        // Room over the structures, and under them before what didn't mix.
        const under = pairLines.length || p.rating ? 28 : 0;
        bottom -= Math.max(...known.map(s => s.d.h)) * scale + 8 + 12 + 26 * 1.3 + (known.some(s => s.total) ? 24 * 1.3 : 0) + 40 + under;
    }
    const rowTop = bottom + 40;

    if (p.style === 'dial') {
        // The dial, as large as the room between the name and the structures
        // lets it be, and narrow enough for its columns of words either side.
        const room = bottom - y;
        const sideways = (SIZE.w - 2 * 40) / 2 - 64 - labelWidth(ctx, p.doses);
        const outer = Math.max(180, Math.min(320, (room - 2 * MARGIN) / 2, sideways));
        dial(ctx, p, SIZE.w / 2, y + room / 2, outer, { top: y + 8, bottom: bottom - 8 });
    } else {
        // The date as a reading on the left, the month, the weekday and the
        // times beside it; then the line over the rest of the room.
        y += 24;
        const size = 152;
        ctx.font = font(size, 300, true);
        track_(ctx, -0.035, size);
        const dayW = ctx.measureText(p.day).width;
        ctx.fillStyle = C.text;
        lines(ctx, [p.day], LEFT - 6, y, size, 0.96);
        track_(ctx, 0, 1);
        const sx = LEFT + dayW + 28;
        const stackH = 26 * 1.3 * 2 + 24 * 1.3;
        let sy = y + (size * 0.96 - stackH) / 2;
        ctx.fillStyle = C.muted;
        ctx.font = font(26);
        lines(ctx, [p.month, p.weekday], sx, sy, 26, 1.3);
        sy += 26 * 1.3 * 2;
        ctx.font = font(24);
        lines(ctx, [p.span], sx, sy, 24, 1.3);
        y += size * 0.96 + 40;
        timeline(ctx, p, LEFT, y, ACROSS, bottom - y);
    }

    if (known.length) {
        const images = await Promise.all(known.map(s => structureImage(s.d, scale, 3, C.brand)));
        const widths = known.map(s => Math.max(s.d.w * scale, 120));
        const gap = known.length > 1 ? Math.min(96, (ACROSS - widths.reduce((a, b) => a + b, 0)) / (known.length - 1)) : 0;
        const drawnH = Math.max(...known.map(s => s.d.h)) * scale + 8;
        let x = LEFT;
        known.forEach((s, k) => {
            const img = images[k];
            // On one line at their feet, as a row of specimens.
            if (img) ctx.drawImage(img, x - 4, rowTop + drawnH - img.height);
            ctx.fillStyle = colour(s.color);
            ctx.font = font(26, 500);
            lines(ctx, wrap(ctx, s.name, widths[k] + gap - 16, 1), x, rowTop + drawnH + 12, 26, 1.3);
            if (s.total) {
                ctx.fillStyle = C.muted;
                ctx.font = font(24);
                lines(ctx, wrap(ctx, s.total, widths[k] + gap - 16, 1), x, rowTop + drawnH + 12 + 26 * 1.3, 24, 1.3);
            }
            x += widths[k] + gap;
        });
    }

    pairLines.forEach((line, k) => {
        let x = LEFT;
        const ty = pairsTop + k * 26 * 1.6;
        for (const r of line) {
            ctx.font = font(26);
            ctx.fillStyle = C.text;
            lines(ctx, [r.label], x, ty, 26, 1.6);
            x += ctx.measureText(r.label).width + 12;
            ctx.font = font(26, 500);
            ctx.fillStyle = r.ink;
            lines(ctx, [r.word], x, ty, 26, 1.6);
            x += ctx.measureText(r.word).width + 48;
        }
    });
    if (p.rating) {
        ctx.fillStyle = C.muted;
        ctx.font = font(26);
        lines(ctx, wrap(ctx, p.rating, ACROSS, 1), LEFT, ratingTop, 26, 1.45);
    }

    // The foot: the logo, and the host beside it.
    if (logo) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(LEFT, footTop, LOGO, LOGO, 18);
        ctx.clip();
        ctx.drawImage(logo, LEFT, footTop, LOGO, LOGO);
        ctx.restore();
    }
    ctx.fillStyle = C.muted;
    ctx.font = font(30);
    lines(ctx, [SITE.host], LEFT + LOGO + 24, footTop + (LOGO - 30 * 1.3) / 2, 30, 1.3);

    return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('No picture'))), 'image/png'));
}
