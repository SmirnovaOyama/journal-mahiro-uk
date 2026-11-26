import { useState } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { DRAW_MS, DrawnCurve } from './DrawnCurve';
import type { Course } from '../lib/time';
import { useScrub, yOnPieces, type Piece } from './scrub';
import { tr } from '../lib/i18n';

/* A session on one clock: each dose's curve from the time it was taken, in
   its substance's colour, drawn as the substance page draws one (Timeline):
   flat gridlines, clock times under, "now" a dotted upright. A dose whose
   timing isn't documented is a dot on the baseline, not a guessed curve.
   A dose's curve is as tall as its amount is against the common dose (a
   light one lower, a strong one taller), within reason.

   Press and slide along it (or point at it) to read any moment: a cursor
   with the time, a point on each curve, and where each dose is then.

   It runs the column's width exactly, its gridlines ending where the text
   above them does. The width is measured before the first paint and nothing
   is drawn until it is known: drawn at a guessed width first, the gridlines
   ran off the screen for a frame and the clock times were worked out for the
   wrong width, then jumped.

   Each time it appears it draws itself, at the right width from its first
   frame: each dose's dot pops onto the baseline, its curve is drawn on from
   there left to right (DrawnCurve: eased, with a blurred streak at the pen
   while it's fast), doses one after another in the order taken, and "now"
   comes in last, once the curves have landed. */

/** Between one dose's curve starting and the next one's, ms. */
const STAGGER = 80;

export interface ChartDose {
    id: string;
    time: number;
    color: string;
    course: Course | null;
    /** The amount against the common dose's middle; 1 when unknown. */
    strength: number;
    /** What it was, for the reading under the cursor. */
    label?: string;
}

const H = 196;
const TOP = 14;
const BASE = 160;
const LEFT = 0;
const RIGHT = 0;
const MIN = 60_000;

function clock(t: number) {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Where a dose is at time T. */
export function phaseAt(d: ChartDose, T: number): string {
    if (T < d.time) return tr('not taken yet');
    if (!d.course) return tr('taken at {0}', { 0: clock(d.time) });
    const m = (T - d.time) / MIN;
    const { firstEffects: a, peakStart: b, peakEnd: e, over: f } = d.course;
    if (m < a) return tr('starting');
    if (m < b) return tr('coming up');
    if (m < e) return tr('at its peak');
    if (m < f) return tr('wearing off');
    return tr('over');
}

export function SessionChart({ doses, now }: { doses: ChartDose[]; now: number }) {
    const [box, setBox] = useState<HTMLDivElement | null>(null);
    const { width } = useElementSize(box);
    const W = Math.round(width);
    const scrub = useScrub();
    if (!doses.length) return null;

    const first = Math.min(...doses.map(d => d.time));
    const ends = doses.map(d => d.time + (d.course ? d.course.over : 60) * MIN);
    let start = first - 15 * MIN;
    let end = Math.max(...ends, first + 2 * 3600_000);
    // A little room after the last curve lands, so it doesn't run into the edge.
    end += (end - start) * 0.06;
    // Now inside the night, or just after it: show it.
    if (now > start && now < end + 3 * 3600_000) end = Math.max(end, now + 20 * MIN);
    end = Math.min(end, start + 36 * 3600_000);
    if (now < start) start = Math.min(start, now);

    const plotW = W - LEFT - RIGHT;
    const x = (t: number) => LEFT + ((t - start) / (end - start)) * plotW;
    const y = (lvl: number) => BASE - lvl * (BASE - TOP - 8);

    /** A dose's curve as pieces, so a point on it can be found as well as drawn. */
    const pieces = (d: ChartDose): Piece[] => {
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
    };
    const path = (ps: Piece[]) =>
        ps
            .map((p, k) => {
                if ('line' in p) return `${k ? 'L' : 'M'}${p.line[0][0]} ${p.line[0][1]} L${p.line[1][0]} ${p.line[1][1]}`;
                const [, c1, c2, e] = p.cubic;
                return `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e[0]} ${e[1]}`;
            })
            .join(' ');

    const span = end - start;
    const room = Math.max(2, Math.floor(plotW / 64));
    const every = [30, 60, 120, 180, 240, 360, 720].map(m => m * MIN).find(m => span / m <= room) ?? 720 * MIN;
    const ticks: number[] = [];
    const d0 = new Date(start);
    d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime(); t <= end; t += every) if (t >= start) ticks.push(t);
    // The time the session began, under its first dot; hours too close to it make way.
    const x0 = x(first);
    const axis = [first, ...ticks.filter(t => Math.abs(x(t) - x0) > 56)];

    const showNow = now >= start && now <= end;
    // In the order taken: each dose's turn to be drawn.
    const order = new Map([...doses].sort((a, b) => a.time - b.time).map((d, k) => [d.id, k * STAGGER]));
    const landed = (doses.length - 1) * STAGGER + DRAW_MS * 0.7;

    // The moment under the cursor, and each dose there.
    const cx = scrub.x === null ? null : Math.min(LEFT + plotW, Math.max(LEFT, scrub.x));
    const T = cx === null ? null : start + ((cx - LEFT) / plotW) * span;
    const reading =
        T === null
            ? []
            : doses.map(d => ({
                  d,
                  phase: phaseAt(d, T),
                  y: d.course ? yOnPieces(pieces(d), cx!) : null,
              }));
    // The reading sits beside the cursor, on whichever side has more room.
    const onRight = cx !== null && cx < W / 2;

    return (
        <div ref={setBox} className="relative cursor-crosshair" style={{ touchAction: 'pan-y', minHeight: H }} {...scrub.handlers}>
            {W > 0 && (
            <svg
                width={W}
                height={H}
                className="block overflow-visible tabular-nums select-none"
                role="img"
                aria-label={tr('The session over time; press and slide along it to read any moment')}
            >
                {[0, 0.5, 1].map(l => (
                    <line key={l} x1={LEFT} x2={LEFT + plotW} y1={y(l)} y2={y(l)} className="tl-grid" />
                ))}
                {/* What's drawn on the grid, apart from it: the intro fades this
                    away and leaves the grid standing when it moves to the next night. */}
                <g className="session-drawing">
                    {axis
                        .filter(t => t === first || (x(t) > LEFT + 18 && x(t) < LEFT + plotW - 18))
                        .map(t => (
                            <text key={t} x={x(t)} y={H - 10} className="tl-axis" textAnchor={t === first && x(t) < 20 ? 'start' : 'middle'}>
                                {clock(t)}
                            </text>
                        ))}
                    {doses.map(d =>
                        d.course ? (
                            <DrawnCurve
                                key={d.id}
                                d={path(pieces(d))}
                                color={d.color}
                                fillOpacity={cx === null ? 0.1 : 0.07}
                                delay={(order.get(d.id) ?? 0) + 60}
                                height={H}
                            />
                        ) : null,
                    )}
                    {doses.map(d => (
                        <circle
                            key={`dot-${d.id}`}
                            cx={x(d.time)}
                            cy={y(0)}
                            r={4}
                            fill="var(--bg)"
                            stroke={d.color}
                            strokeWidth={2}
                            className="chart-mark"
                            style={{ animationDelay: `${order.get(d.id) ?? 0}ms` }}
                        />
                    ))}
                    {/* Kept on the page while reading a moment, only hidden, so
                        letting go doesn't play its entrance again. */}
                    {showNow && (
                        <g className="chart-appear" style={{ animationDelay: `${landed}ms` }} visibility={cx === null ? 'visible' : 'hidden'}>
                            <line x1={x(now)} x2={x(now)} y1={TOP} y2={BASE} className="tl-now" />
                            <text x={x(now)} y={TOP - 2} textAnchor={x(now) > LEFT + plotW - 30 ? 'end' : 'middle'} className="tl-axis">
                                {tr('now')}
                            </text>
                        </g>
                    )}
                </g>
                {cx !== null && (
                    <g>
                        <line x1={cx} x2={cx} y1={TOP} y2={BASE} stroke="var(--text)" strokeWidth={1} opacity={0.5} />
                        {reading.map(r =>
                            r.y !== null ? <circle key={r.d.id} cx={cx} cy={r.y} r={5} fill={r.d.color} stroke="var(--bg)" strokeWidth={2} /> : null,
                        )}
                    </g>
                )}
            </svg>
            )}
            {T !== null && W > 0 && (
                <div
                    className="chart-readout pointer-events-none absolute top-1"
                    style={onRight ? { left: cx! + 10 } : { right: W - cx! + 10 }}
                    aria-live="polite"
                >
                    <p className="font-medium tabular-nums text-[var(--text)]">{clock(T)}</p>
                    {reading.map(r => (
                        <p key={r.d.id} className="flex items-center gap-1.5 whitespace-nowrap text-[var(--text-muted)]">
                            {/* The name in its curve's colour: which line is which, without a dot. */}
                            {r.d.label && (
                                <span className="font-medium" style={{ color: r.d.color }}>
                                    {r.d.label}
                                </span>
                            )}
                            {r.phase}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
