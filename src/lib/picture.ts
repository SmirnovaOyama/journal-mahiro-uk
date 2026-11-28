import { loadStructure } from '../components/Molecule';
import { clockTimes, curvePieces, nightSpan, type CurveDose } from './curve';
import { currentLang } from './i18n';
import { molToSvg } from './molsvg';
import { SITE } from './preview';

/* A night in the journal kept as a picture, 1080 × 1440 (3:4), drawn on
   this device on a canvas: the night never leaves it.

   It is set as the brand's other pictures are, the link preview cards
   (scripts/og/card.mjs, and hrt.mahiro.uk's design/og): the white page,
   the name in the display face at 400, a muted line under it, the drawing
   in the brand's terracotta, and at the foot the logo with the host beside
   it. Every colour is a token of the light theme (oyama-tokens.css) and
   every size a token of the type scale at twice its size, as a phone
   screen 540 wide would be at 2x:

   - the date, and its times in a muted line;
   - each substance of the night drawn as its structure, all at one scale
     and upright, in `brand`, with its name under it in its curve's colour;
   - the night's curve over the room that's left: the session chart's own
     shapes (lib/curve.ts), its strokes, fills, rings and axis at 2x, each
     dose written on its own curve;
   - what didn't mix, as rows under a group heading, divided by hairlines,
     each status said in words;
   - the logo and the host.

   No panel, card, glass or shadow: content is flat. The page hands over
   its words already in the reader's language; nothing here translates.
   Loaded only when a picture is first drawn. */

export const SIZE = { w: 1080, h: 1440 };

/** The light theme's tokens, as hex. */
const C = {
    bg: '#ffffff',
    text: '#181714',
    muted: '#6b6860',
    border: '#e3e1dc',
    grid: '#eeedea',
    brand: '#cc785c',
    warning: '#a35303',
    danger: '#c22826',
    positive: '#0f7c55',
    info: '#0267c7',
};

export type Status = 'danger' | 'warning' | 'info' | 'positive' | 'muted';

/** A dose on the night's curve, and what's written on it. */
export interface ChartDose extends CurveDose {
    color: string;
    name: string;
    /** Its time and amount, under the name. */
    detail: string;
}

export interface NightPicture {
    title: string;
    /** The muted line under the title: its times, and the date when the title is a name. */
    sub: string;
    /** Each substance of the night, in the order first taken. */
    substances: { id: string; name: string; color: string }[];
    doses: ChartDose[];
    now?: { at: number; label: string };
    /** What didn't mix, under its heading. */
    pairs?: { heading: string; rows: { label: string; word: string; status: Status }[]; more: (n: number) => string };
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
function track(ctx: CanvasRenderingContext2D, em: number, size: number) {
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

/* ── the curve ────────────────────────────────────────────────────────── */

/** Room above the tallest curve for what's written on it, and under the
 *  baseline for the clock times. */
const CHART_HEAD = 96;
const CHART_FOOT = 56;

/** The night's curve in `w` × `h`, as the session chart draws it at 2x:
 *  `chart-grid` lines at the baseline, half and top, each dose's curve in
 *  its colour (a 4 px stroke over a fill at 10%), a hollow ring on the
 *  baseline where it was taken, the clock times under in `chart-axis` at
 *  `micro`, and "now" a dotted upright in `text` on a night still going. */
function chart(ctx: CanvasRenderingContext2D, p: NightPicture, x0: number, y0: number, w: number, h: number) {
    if (!p.doses.length) return;
    const span = nightSpan(p.doses, p.now?.at ?? null);
    const top = y0 + CHART_HEAD;
    const base = y0 + h - CHART_FOOT;
    const x = (t: number) => x0 + ((t - span.start) / (span.end - span.start)) * w;
    const y = (level: number) => base - level * (base - top);
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
    const order = [...p.doses].sort((a, b) => a.time - b.time);
    // Every fill first, then every line over them, so no fill veils a line.
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
    const times = clockTimes(span, w, x, 150, 120).filter(t => t === span.first || (x(t) > x0 + 40 && x(t) < x0 + w - 40));
    for (const t of times) {
        const d = new Date(t);
        const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        lines(ctx, [label], x(t), base + 18, 24, 1.3, t === span.first && x(t) < x0 + 50 ? 'left' : 'center');
    }

    if (p.now && p.now.at >= span.start && p.now.at <= span.end) {
        const nx = x(p.now.at);
        ctx.strokeStyle = C.text;
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(nx, top);
        ctx.lineTo(nx, base);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = C.muted;
        ctx.font = font(24);
        lines(ctx, [p.now.label], nx, top - 36, 24, 1.3, nx > x0 + w - 40 ? 'right' : 'center');
    }

    labels(ctx, p, x, y, x0, y0, w, base);
}

/** Each dose written on its curve: its name in the curve's colour at
 *  `caption` and 500, and under it its time and amount in `text-muted` at
 *  `footnote`, near where the curve levels out at its peak. Of the spots
 *  along and over that peak (and just under it), each takes the one that
 *  covers least: first the labels already placed, then any curve's line,
 *  then the nearest its own peak. A dose with no timing is written over
 *  its ring. Each is edged in the page's own white, so a line it crosses
 *  doesn't cut through it. */
function labels(ctx: CanvasRenderingContext2D, p: NightPicture, x: (t: number) => number, y: (level: number) => number, x0: number, y0: number, w: number, base: number) {
    type Box = { x: number; y: number; w: number; h: number; away: number };
    const NAME = 26,
        DETAIL = 24;
    const boxH = NAME * 1.3 + DETAIL * 1.3;
    const placed: Box[] = [];
    const overlap = (a: Box, c: Box) =>
        Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) + 12) * Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y) + 6);
    const clampX = (v: number, bw: number) => Math.min(Math.max(v, x0), x0 + w - bw);

    // Points along every curve, to tell how much of them a label would cover.
    const points: [number, number][] = [];
    for (const d of p.doses) {
        if (!d.course) continue;
        for (const piece of curvePieces(d, x, y)) {
            if ('line' in piece) {
                const [[ax, ay], [bx, by]] = piece.line;
                for (let k = 0; k <= 12; k++) points.push([ax + ((bx - ax) * k) / 12, ay + ((by - ay) * k) / 12]);
            } else {
                const [a, c1, c2, e] = piece.cubic;
                for (let k = 0; k <= 24; k++) {
                    const t = k / 24,
                        u = 1 - t;
                    points.push([
                        u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0],
                        u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1],
                    ]);
                }
            }
        }
    }
    const covers = (c: Box) => points.filter(([px, py]) => px > c.x - 6 && px < c.x + c.w + 6 && py > c.y - 4 && py < c.y + c.h + 4).length;

    for (const d of [...p.doses].sort((a, b) => a.time - b.time)) {
        ctx.font = font(NAME, 500);
        const nameW = ctx.measureText(d.name).width;
        ctx.font = font(DETAIL);
        const bw = Math.max(nameW, ctx.measureText(d.detail).width);
        const spots: Box[] = [];
        if (d.course) {
            const lvl = Math.min(1.15, Math.max(0.35, d.strength)) / 1.15;
            const from = x(d.time + d.course.peakStart * 60_000);
            const to = x(d.time + d.course.peakEnd * 60_000);
            const room = Math.max(0, to - from - bw);
            // Along the peak, and to either side of it.
            const xs = [...[0, 0.33, 0.66, 1].map(k => [from + 6 + room * k, k] as const), [from - bw - 12, 1.5] as const, [to + 12, 1.5] as const];
            for (const [at, k] of xs) {
                const sx = clampX(at, bw);
                for (let lift = 0; lift < 5; lift++) spots.push({ x: sx, y: y(lvl) - 14 - boxH - lift * (boxH + 8), w: bw, h: boxH, away: lift * 2 + k });
                for (let drop = 0; drop < 4; drop++) spots.push({ x: sx, y: y(lvl) + 16 + drop * (boxH + 8), w: bw, h: boxH, away: 1.5 + drop * 2 + k });
            }
        } else {
            for (let lift = 0; lift < 4; lift++) spots.push({ x: clampX(x(d.time) - bw / 2, bw), y: y(0) - 24 - boxH - lift * (boxH + 8), w: bw, h: boxH, away: lift * 2 });
        }
        const inside = spots.filter(c => c.y >= y0 - 4 && c.y + c.h <= base - 8);
        const score = (c: Box) => placed.reduce((sum, o) => sum + overlap(c, o), 0) * 100 + covers(c) * 40 + c.away * 30;
        const best = [...(inside.length ? inside : spots)].sort((a, b) => score(a) - score(b))[0];
        placed.push(best);

        const say = (text: string, ty: number, size: number, weight: 400 | 500, fill: string) => {
            ctx.font = font(size, weight);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 8;
            ctx.strokeStyle = C.bg;
            ctx.strokeText(text, best.x, ty);
            ctx.fillStyle = fill;
            ctx.fillText(text, best.x, ty);
        };
        say(d.name, best.y + (NAME * 1.3) / 2, NAME, 500, colour(d.color));
        say(d.detail, best.y + NAME * 1.3 + (DETAIL * 1.3) / 2, DETAIL, 400, C.muted);
    }
}

/* ── the page ─────────────────────────────────────────────────────────── */

/** The page's margins, as the link preview cards set theirs. */
const LEFT = 80;
const ACROSS = SIZE.w - 2 * LEFT;
const TOP = 88;
/** The logo at the foot, and how far its bottom edge sits from the page's. */
const LOGO = 80;
const BOTTOM = 72;
/** Between one part of the page and the next: `space-6` at 2x. */
const GAP = 48;
/** The chart is never shorter than this. */
const CHART_MIN = 440;
/** A row of what didn't mix. */
const ROW = 76;
/** The structures are drawn no taller than this, and no smaller than SHRINK of it. */
const SPECIMEN = 120;
const SHRINK = 0.6;

export async function draw(p: NightPicture): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE.w;
    canvas.height = SIZE.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');

    const [logo, drawn] = await Promise.all([loadImage('/logo.png'), Promise.all(p.substances.map(s => structureOf(s.id)))]);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SIZE.w, SIZE.h);

    // The title: the display face at 400, as large as fits in two lines.
    let size = 76;
    let title: string[] = [];
    for (; size >= 52; size -= 4) {
        ctx.font = font(size, 400, true);
        track(ctx, -0.03, size);
        title = wrap(ctx, p.title, ACROSS, 2);
        if (title.length === 1 || size <= 64) break;
    }
    ctx.fillStyle = C.text;
    lines(ctx, title, LEFT, TOP, size, 1.08);
    track(ctx, 0, 1);
    let y = TOP + title.length * size * 1.08 + 16;
    ctx.font = font(30);
    const sub = wrap(ctx, p.sub, ACROSS, 2);
    ctx.fillStyle = C.muted;
    lines(ctx, sub, LEFT, y, 30, 1.32);
    y += sub.length * 30 * 1.32;

    /* What's under the chart, from the foot up: the rows that didn't mix and
       the rating; over it, the structures. When the chart would be shorter
       than its least, things give way in this order: the structures are
       drawn smaller, the rating is left out, the rows that didn't mix give
       way to a line saying how many more (never all of them), and last the
       structures are left out. */
    const footTop = SIZE.h - BOTTOM - LOGO;
    const pairs = p.pairs;
    const total = pairs?.rows.length ?? 0;
    let rating = !!p.rating;
    let shown = total;
    const restH = () => {
        const rows = pairs && shown ? 26 * 1.4 + 8 + (shown + (shown < total ? 1 : 0)) * ROW : 0;
        return rows + (rating ? (rows ? 24 : 0) + 26 * 1.45 : 0);
    };

    // The structures, in one row at one scale.
    const known = p.substances.map((s, k) => ({ ...s, d: drawn[k] })).filter((s): s is NightPicture['substances'][number] & { d: Drawn } => !!s.d);
    const nameH = 26 * 1.3;
    let full = 0.6;
    if (known.length) {
        const wide = known.reduce((sum, s) => sum + s.d.w, 0);
        full = Math.min(0.6, (ACROSS - (known.length - 1) * 64) / wide, SPECIMEN / Math.max(...known.map(s => s.d.h)));
    }
    let scale = full;
    const rowOf = (sc: number) => (known.length ? Math.max(...known.map(s => s.d.h)) * sc + 8 + 16 + nameH : 0);
    let rowH = rowOf(scale);

    const chartTop = () => y + GAP + (rowH ? rowH + GAP : 0);
    const chartBottom = () => footTop - GAP - (restH() ? restH() + GAP : 0);
    const short = () => chartBottom() - chartTop() < CHART_MIN;
    while (rowH && short() && scale > full * SHRINK) {
        scale *= 0.9;
        rowH = rowOf(scale);
    }
    if (short()) rating = false;
    while (short() && shown > 1) shown--;
    if (short()) rowH = 0;

    if (rowH) {
        const images = await Promise.all(known.map(s => structureImage(s.d, scale, 3, C.brand)));
        const widths = known.map(s => s.d.w * scale);
        const gap = known.length > 1 ? Math.min(96, (ACROSS - widths.reduce((a, b) => a + b, 0)) / (known.length - 1)) : 0;
        let x = LEFT;
        const top = y + GAP;
        const drawnH = Math.max(...known.map(s => s.d.h)) * scale + 8;
        known.forEach((s, k) => {
            const img = images[k];
            // On one line at their feet, as a row of specimens.
            if (img) ctx.drawImage(img, x - 4, top + drawnH - img.height);
            ctx.fillStyle = colour(s.color);
            ctx.font = font(26, 500);
            lines(ctx, wrap(ctx, s.name, Math.max(widths[k], 160), 1), x, top + drawnH + 16, 26, 1.3);
            x += widths[k] + gap;
        });
    }

    const cTop = chartTop();
    const cBottom = chartBottom();
    chart(ctx, p, LEFT, cTop, ACROSS, cBottom - cTop);

    // What didn't mix: a group heading, then rows divided by hairlines, the
    // status in its colour and in words.
    let ry = cBottom + GAP;
    if (pairs && shown) {
        ctx.fillStyle = C.muted;
        ctx.font = font(26, 600);
        lines(ctx, [pairs.heading], LEFT, ry, 26, 1.4);
        ry += 26 * 1.4 + 8;
        const rows: { label: string; word: string; ink: string }[] = pairs.rows.slice(0, shown).map(r => ({ label: r.label, word: r.word, ink: C[r.status] }));
        if (shown < total) rows.push({ label: pairs.more(total - shown), word: '', ink: C.muted });
        rows.forEach((r, k) => {
            if (k) {
                ctx.fillStyle = C.border;
                ctx.fillRect(LEFT, ry, ACROSS, 2);
            }
            ctx.font = font(30, 500);
            const wordW = r.word ? ctx.measureText(r.word).width : 0;
            if (r.word) {
                ctx.fillStyle = r.ink;
                lines(ctx, [r.word], LEFT + ACROSS, ry + (ROW - 30 * 1.3) / 2, 30, 1.3, 'right');
            }
            ctx.font = font(30);
            ctx.fillStyle = r.word ? C.text : C.muted;
            lines(ctx, wrap(ctx, r.label, ACROSS - wordW - 32, 1), LEFT, ry + (ROW - 30 * 1.3) / 2, 30, 1.3);
            ry += ROW;
        });
        ry += 24;
    }
    if (p.rating && rating) {
        ctx.fillStyle = C.muted;
        ctx.font = font(26);
        lines(ctx, wrap(ctx, p.rating, ACROSS, 1), LEFT, ry, 26, 1.45);
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
