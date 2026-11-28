import { useState } from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { DRAW_MS, DrawnCurve } from './DrawnCurve';
import type { Course } from '../lib/time';
import { chartTop, clockTimes, loads, nightSpan, stackEnd, stackPieces, stackStage, stacks, type LoadKind } from '../lib/curve';
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
    /** What it is (a substance's id): doses of one thing are one curve. */
    group?: string;
    /** Its kind, where different drugs of it add up (lib/curve.ts, loads). */
    load?: LoadKind;
    /** Its kind as the catalogue has it ("Psychedelic"). */
    category?: string;
}

/** What a load's dashed line is called. */
export const loadName = (kind: LoadKind) => (kind === 'depressant' ? tr('Depressants together') : tr('Stimulants together'));

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

/** Where several doses of one thing are at time T, as one: at its peak
 *  if any of them is (lib/curve.ts, stackStage). */
export function stackPhaseAt(ds: ChartDose[], T: number): string {
    if (ds.length === 1) return phaseAt(ds[0], T);
    const stage = stackStage(ds, T);
    if (stage === 'none') return T < ds[0].time ? tr('not taken yet') : tr('taken at {0}', { 0: clock(ds[0].time) });
    return tr(stage === 'peak' ? 'at its peak' : stage);
}

/** Each thing taken, its doses together: where it is now and when it will
 *  be over, for the lines under a chart. Only things with a timing. */
export function whereEach(doses: ChartDose[], now: number) {
    return stacks(doses)
        .map(ds => ({ d: ds[ds.length - 1], ds, end: stackEnd(ds) }))
        .filter((s): s is typeof s & { end: number } => s.end != null)
        .map(s => ({ ...s, over: now >= s.end, phase: stackPhaseAt(s.ds, now) }));
}

export function SessionChart({ doses, now }: { doses: ChartDose[]; now: number }) {
    const [box, setBox] = useState<HTMLDivElement | null>(null);
    const { width } = useElementSize(box);
    const W = Math.round(width);
    const scrub = useScrub();
    if (!doses.length) return null;

    // The span shown, each curve and the clock times are lib/curve.ts's, as
    // the night's picture draws them.
    const night = nightSpan(doses, now);
    const { first, start, end } = night;

    const plotW = W - LEFT - RIGHT;
    const x = (t: number) => LEFT + ((t - start) / (end - start)) * plotW;
    const y = (lvl: number) => BASE - lvl * (BASE - TOP - 8);
    // Doses of one thing are one curve, their levels added; the curves are
    // scaled so the tallest stack fits under the top line.
    const groups = stacks(doses);
    const together = loads(doses);
    const top = chartTop(doses);
    const yc = (lvl: number) => y(lvl / top);

    /** A stack's curve as pieces, so a point on it can be found as well as drawn. */
    const pieces = (ds: ChartDose[]): Piece[] => stackPieces(ds, x, yc);
    const path = (ps: Piece[]) =>
        ps
            .map((p, k) => {
                if ('line' in p) return `${k ? 'L' : 'M'}${p.line[0][0]} ${p.line[0][1]} L${p.line[1][0]} ${p.line[1][1]}`;
                const [, c1, c2, e] = p.cubic;
                return `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e[0]} ${e[1]}`;
            })
            .join(' ');

    const span = end - start;
    // The time the session began, under its first dot; hours too close to it make way.
    const axis = clockTimes(night, plotW, x);

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
            : groups.map(ds => ({
                  d: ds[0],
                  phase: stackPhaseAt(ds, T),
                  y: ds.some(d => d.course) ? yOnPieces(pieces(ds), cx!) : null,
              }));
    const loadReading =
        T === null ? [] : together.map(l => ({ kind: l.kind, y: yOnPieces(pieces(l.ds), cx!) })).filter(r => r.y !== null);
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
                    {groups.map(ds =>
                        ds.some(d => d.course) ? (
                            <DrawnCurve
                                key={ds[0].id}
                                d={path(pieces(ds))}
                                color={ds[0].color}
                                fillOpacity={cx === null ? 0.1 : 0.07}
                                delay={(order.get(ds[0].id) ?? 0) + 60}
                                height={H}
                            />
                        ) : null,
                    )}
                    {/* Different drugs of one kind at work together: their sum, dashed,
                        over their own curves. */}
                    {together.map(l => (
                        <path
                            key={l.kind}
                            d={path(pieces(l.ds))}
                            fill="none"
                            stroke="var(--text)"
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            opacity={0.6}
                            className="chart-appear"
                            style={{ animationDelay: `${landed}ms` }}
                        />
                    ))}
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
                        {loadReading.map(r => (
                            <circle key={r.kind} cx={cx} cy={r.y!} r={4} fill="var(--bg)" stroke="var(--text)" strokeWidth={1.5} />
                        ))}
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
                    {loadReading.map(r => (
                        <p key={r.kind} className="whitespace-nowrap text-[var(--text-muted)]">
                            {loadName(r.kind)}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
}
