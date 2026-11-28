import { yOnPieces, type Piece } from '../components/scrub';
import type { Course } from './time';

/* The shape of a night on one clock, as the session chart draws it
   (components/SessionChart.tsx) and as its picture does (lib/picture.ts):
   the span of time it shows, each dose's curve, and the clock times under
   it. Pure, so both draw the same night the same way. */

const MIN = 60_000;

export interface CurveDose {
    time: number;
    course: Course | null;
    /** The amount against the common dose's middle; 1 when unknown. */
    strength: number;
    /** What it is (a substance's id): doses of one thing are drawn as one curve. */
    group?: string;
}

/** The time a night is shown over: from a quarter of an hour before its
 *  first dose to a little after its last curve lands, and to "now" if
 *  that's in it or just after. `now` null leaves now out of it. */
export function nightSpan(doses: CurveDose[], now: number | null): { first: number; start: number; end: number } {
    const first = Math.min(...doses.map(d => d.time));
    const ends = doses.map(d => d.time + (d.course ? d.course.over : 60) * MIN);
    let start = first - 15 * MIN;
    let end = Math.max(...ends, first + 2 * 3600_000);
    // A little room after the last curve lands, so it doesn't run into the edge.
    end += (end - start) * 0.06;
    if (now !== null) {
        // Now inside the night, or just after it: show it.
        if (now > start && now < end + 3 * 3600_000) end = Math.max(end, now + 20 * MIN);
    }
    end = Math.min(end, start + 36 * 3600_000);
    if (now !== null && now < start) start = Math.min(start, now);
    return { first, start, end };
}

/** A dose's curve as pieces, in the chart's own units: `x` places a time,
 *  `y` a level from 0 (the baseline) to 1. A dose is as tall as its amount
 *  against the common dose, within reason. Only for a dose with a course. */
export function curvePieces(d: CurveDose, x: (t: number) => number, y: (level: number) => number): Piece[] {
    const c = d.course!;
    const h = Math.min(1.15, Math.max(0.35, d.strength)) / 1.15;
    const t = (m: number) => x(d.time + m * MIN);
    const { firstEffects: a, peakStart: b, peakEnd: e, over: f } = c;
    return [
        { line: [[t(0), y(0)], [t(a), y(0.01)]] },
        { cubic: [[t(a), y(0.01)], [t(a + (b - a) * 0.55), y(0.04 * h)], [t(a + (b - a) * 0.6), y(h)], [t(b), y(h)]] },
        { line: [[t(b), y(h)], [t(e), y(h)]] },
        { cubic: [[t(e), y(h)], [t(e + (f - e) * 0.45), y(h)], [t(e + (f - e) * 0.5), y(0.02)], [t(f), y(0)]] },
    ];
}

/** The clock times under a night: when it began, then whole hours (or
 *  half hours, or every few) as many as fit one per `spacing` of `plotW`,
 *  leaving out any within `gap` of the first. */
export function clockTimes(span: { first: number; start: number; end: number }, plotW: number, x: (t: number) => number, spacing = 64, gap = 56): number[] {
    const { first, start, end } = span;
    const room = Math.max(2, Math.floor(plotW / spacing));
    const every = [30, 60, 120, 180, 240, 360, 720].map(m => m * MIN).find(m => (end - start) / m <= room) ?? 720 * MIN;
    const ticks: number[] = [];
    const d0 = new Date(start);
    d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime(); t <= end; t += every) if (t >= start) ticks.push(t);
    const x0 = x(first);
    return [first, ...ticks.filter(t => Math.abs(x(t) - x0) > gap)];
}

/* ── doses of one thing, added up ─────────────────────────────────────── */

/** A dose as the charts take it, with what it is: doses of the same thing
 *  (`group`, else its name) are one curve, their effects added together. */
export type StackDose = CurveDose & { id?: string; label?: string; name?: string };

const keyOf = (d: StackDose) => d.group ?? d.label ?? d.name ?? d.id ?? String(d.time);

/** The doses in stacks of the same thing, each stack in the order taken,
 *  the stacks in the order each was first taken. */
export function stacks<T extends StackDose>(doses: T[]): T[][] {
    const by = new Map<string, T[]>();
    for (const d of [...doses].sort((a, b) => a.time - b.time)) {
        const k = keyOf(d);
        by.set(k, [...(by.get(k) ?? []), d]);
    }
    return [...by.values()];
}

/** How strong one dose is at time t, from 0 to its height (curvePieces). */
export function levelAt(d: CurveDose, t: number): number {
    if (!d.course || t <= d.time || t >= d.time + d.course.over * MIN) return 0;
    return Math.max(0, yOnPieces(curvePieces(d, s => s, l => l), t) ?? 0);
}

/** When a stack's curve begins and lands. */
function stackSpan(ds: CurveDose[]): [number, number] {
    const timed = ds.filter(d => d.course);
    return [Math.min(...timed.map(d => d.time)), Math.max(...timed.map(d => d.time + d.course!.over * MIN))];
}

/** A stack's curve: one dose's own, or, for several, their levels added
 *  at each moment, so a second glass on the first draws one curve that
 *  rises again, higher and longer, not two side by side. */
export function stackPieces(ds: CurveDose[], x: (t: number) => number, y: (level: number) => number): Piece[] {
    const timed = ds.filter(d => d.course);
    if (timed.length === 1) return curvePieces(timed[0], x, y);
    const [a, b] = stackSpan(timed);
    const n = 240;
    const pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
        const t = a + ((b - a) * k) / n;
        pts.push([x(t), y(timed.reduce((s, d) => s + levelAt(d, t), 0))]);
    }
    return pts.slice(1).map((p, k) => ({ line: [pts[k], p] }));
}

/** The highest any stack reaches, and never under 1: the charts scale
 *  their curves by it, so a stack two doses tall fits under the top line. */
export function stackTop(doses: StackDose[]): number {
    let top = 1;
    for (const ds of stacks(doses)) {
        const timed = ds.filter(d => d.course);
        if (timed.length < 2) continue;
        const [a, b] = stackSpan(timed);
        for (let k = 0; k <= 240; k++) {
            const t = a + ((b - a) * k) / 240;
            top = Math.max(top, timed.reduce((s, d) => s + levelAt(d, t), 0));
        }
    }
    return top;
}

/** When a stack is over: its last curve's landing. Null with no timing. */
export function stackEnd(ds: CurveDose[]): number | null {
    return ds.some(d => d.course) ? stackSpan(ds)[1] : null;
}

/** Where a stack is at time T, as one thing: at its peak if any dose of it
 *  is, else coming up if any is, else wearing off, else just starting.
 *  'none' before the first is taken or with no timing, 'over' after. */
export function stackStage(ds: CurveDose[], T: number): 'none' | 'starting' | 'coming up' | 'peak' | 'wearing off' | 'over' {
    const stages = ds
        .filter(d => d.course && T >= d.time)
        .map(d => {
            const m = (T - d.time) / MIN;
            const { firstEffects: a, peakStart: b, peakEnd: e, over: f } = d.course!;
            return m < a ? 'starting' : m < b ? 'coming up' : m < e ? 'peak' : m < f ? 'wearing off' : 'over';
        });
    if (!stages.length) return 'none';
    for (const s of ['peak', 'coming up', 'wearing off', 'starting'] as const) if (stages.includes(s)) return s;
    return 'over';
}

/* ── different drugs of one kind, together ────────────────────────────── */

/** Kinds whose effects add up when two different drugs of them are taken
 *  together: depressants and opioids both slow breathing, so they are one;
 *  two stimulants both push the heart. Psychedelics are left out: one
 *  dulls the other (cross-tolerance), it doesn't add to it. */
export type LoadKind = 'depressant' | 'stimulant';
export function loadKindOf(category?: string): LoadKind | undefined {
    if (category === 'Depressant' || category === 'Opioid') return 'depressant';
    if (category === 'Stimulant') return 'stimulant';
    return undefined;
}

/** Where two or more different drugs of one kind (`load`) are at work at
 *  the same time: every dose of that kind, to be drawn as one more curve,
 *  their levels added (each against its own common dose). Only where they
 *  overlap; one drug alone, or two that never meet, has none. */
export function loads<T extends StackDose & { load?: LoadKind }>(doses: T[]): { kind: LoadKind; ds: T[] }[] {
    const out: { kind: LoadKind; ds: T[] }[] = [];
    for (const kind of ['depressant', 'stimulant'] as const) {
        const ds = doses.filter(d => d.load === kind && d.course);
        const groups = stacks(ds);
        if (groups.length < 2) continue;
        // Two of them at work at once, somewhere.
        const spans = groups.map(g => stackSpan(g));
        const meet = spans.some(([a, b], i) => spans.some(([c, e], j) => j > i && a < e && c < b));
        if (meet) out.push({ kind, ds });
    }
    return out;
}

/** The highest a stack or a load reaches, never under 1. */
export function chartTop(doses: (StackDose & { load?: LoadKind })[]): number {
    let top = stackTop(doses);
    for (const { ds } of loads(doses)) {
        const [a, b] = stackSpan(ds);
        for (let k = 0; k <= 240; k++) {
            const t = a + ((b - a) * k) / 240;
            top = Math.max(top, ds.reduce((s, d) => s + levelAt(d, t), 0));
        }
    }
    return top;
}
