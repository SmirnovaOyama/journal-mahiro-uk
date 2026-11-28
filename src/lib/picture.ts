import { loadStructure } from '../components/Molecule';
import { curvePieces, nightSpan, type CurveDose } from './curve';
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

   Flat throughout: no gradient, glow or shadow. The page hands over its
   words already in the reader's language; nothing here translates.
   Loaded only when a picture is first drawn. */

export const SIZE = { w: 1080, h: 1440 };

/** The dark theme's tokens, as hex. */
const C = {
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

export type Status = 'danger' | 'warning' | 'info' | 'positive' | 'muted';

/** A dose round the dial, and what's written at its tip. */
export interface ChartDose extends CurveDose {
    color: string;
    name: string;
    /** Its time and amount, under the name. */
    detail: string;
}

export interface NightPicture {
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

    // Each dose's name, time and amount outside the dial, level with where
    // it was taken, a hairline from its ring to it; one that would lie over
    // another, or off the page, moves along a little.
    type Box = { x: number; y: number; w: number; h: number };
    const placed: Box[] = [];
    const overlap = (b: Box) =>
        placed.reduce((sum, o) => sum + Math.max(0, Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x) + 12) * Math.max(0, Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y) + 8), 0);
    const NAME = 26,
        DETAIL = 24;
    const boxH = NAME * 1.3 + DETAIL * 1.3;
    order.forEach((d, k) => {
        ctx.font = font(NAME, 500);
        const nameW = ctx.measureText(d.name).width;
        ctx.font = font(DETAIL);
        const w = Math.max(nameW, ctx.measureText(d.detail).width);
        const a0 = angle(d.time);
        const spots: (Box & { cost: number; a: number; r: number })[] = [];
        for (const turn of [0, 0.08, -0.08, 0.16, -0.16, 0.26, -0.26, 0.38, -0.38])
            for (const lift of [0, 28, 56]) {
                const a = a0 + turn;
                const r = outer + 40 + lift;
                const px = cx + r * Math.cos(a),
                    py = cy + r * Math.sin(a);
                const c = Math.cos(a),
                    s = Math.sin(a);
                const x = c > 0.2 ? px : c < -0.2 ? px - w : px - w / 2;
                const yy = s > 0.35 ? py : s < -0.35 ? py - boxH : py - boxH / 2;
                const box = { x: Math.min(Math.max(x, 24), SIZE.w - 24 - w), y: yy, w, h: boxH };
                if (box.y < bounds.top || box.y + box.h > bounds.bottom) continue;
                spots.push({ ...box, cost: Math.abs(turn) * 300 + lift * 2, a, r });
            }
        if (!spots.length) return;
        const best = spots.reduce((b, c) => (overlap(c) * 100 + c.cost < overlap(b) * 100 + b.cost ? c : b));
        placed.push(best);

        // The hairline: out from where it was taken, to beside its words.
        const r0 = radius(k);
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + (r0 + 10) * Math.cos(a0), cy + (r0 + 10) * Math.sin(a0));
        ctx.lineTo(cx + (outer + 28) * Math.cos(best.a), cy + (outer + 28) * Math.sin(best.a));
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = font(NAME, 500);
        ctx.fillStyle = colour(d.color);
        ctx.fillText(d.name, best.x, best.y + (NAME * 1.3) / 2);
        ctx.font = font(DETAIL);
        ctx.fillStyle = C.muted;
        ctx.fillText(d.detail, best.x, best.y + NAME * 1.3 + (DETAIL * 1.3) / 2);
    });
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
        bottom -= Math.max(...known.map(s => s.d.h)) * scale + 8 + 12 + 26 * 1.3 + (known.some(s => s.total) ? 24 * 1.3 : 0) + 40;
    }
    const rowTop = bottom + 40;

    // The dial, as large as the room between the name and the structures lets it be.
    const room = bottom - y;
    const outer = Math.max(200, Math.min(320, (room - 2 * MARGIN) / 2));
    const cy = y + room / 2;
    dial(ctx, p, SIZE.w / 2, cy, outer, { top: y + 8, bottom: bottom - 8 });

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
