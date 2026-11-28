import type { Piece } from '../components/scrub';
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
