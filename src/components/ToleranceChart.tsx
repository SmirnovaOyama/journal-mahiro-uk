import { useEffect, useRef, useState } from 'react';
import type { Detail } from '../lib/data';
import { dateLocale, phraseList, tr } from '../lib/i18n';
import { useScrub } from './scrub';

/* What tolerance the doses up to a session left, as PsychonautWiki Journal
   draws it under a session, in Oyama's hand: one row a substance, its name
   above a bar in its own colour. From each dose the bar is full until
   tolerance is halved (the data's "Half tolerance"), then lighter until it's
   back to normal (its "Baseline"), taking the longer end of each range.
   Doses close together run into one bar. A dotted upright marks the session
   ("here"), and another today, when that's later and on the chart.

   Press and slide along it (or point at it) to read any day: the date, and
   how tolerant each substance has left you then. */

export interface ToleranceDose {
    substance: string;
    time: number;
}

const DAY = 86_400_000;
const LEFT = 12;
const RIGHT = 12;
const TOP = 22;
const ROW = 40;
const BAR = 14;
const AXIS = 28;

/** "1 - 2 weeks", "7 days", "2.5 months" as milliseconds, the longer end of
 *  a range: when it should surely be past. */
function spanMs(s?: string): number | null {
    const m = s?.match(/([\d.]+)(?:\s*[-–]\s*([\d.]+))?\s*(hour|day|week|month)/i);
    if (!m) return null;
    const n = parseFloat(m[2] ?? m[1]);
    const unit = { hour: 3600_000, day: DAY, week: 7 * DAY, month: 30 * DAY }[m[3].toLowerCase() as 'hour'];
    return Number.isFinite(n) && n > 0 ? n * unit : null;
}

/** How long a dose of this leaves you fully, then half, tolerant. */
export function toleranceOf(d?: Detail): { half: number; reset: number } | null {
    const t = d?.tolerance;
    if (!t) return null;
    const ms = t.milestones ?? [];
    const reset = spanMs(ms.find(m => m.label === 'Baseline')?.value ?? t.reset);
    if (!reset) return null;
    const half = spanMs(ms.find(m => m.label === 'Half tolerance')?.value);
    return { half: half && half < reset ? half : reset / 2, reset };
}

/** Spans that touch or overlap, as one. */
function merge(spans: [number, number][]): [number, number][] {
    const out: [number, number][] = [];
    for (const [a, b] of [...spans].sort((p, q) => p[0] - q[0])) {
        const last = out[out.length - 1];
        if (last && a <= last[1]) last[1] = Math.max(last[1], b);
        else out.push([a, b]);
    }
    return out;
}

const dayText = (t: number) => new Date(t).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

export function ToleranceChart({
    doses,
    details,
    here,
    now,
    days,
    colors,
    names,
}: {
    /** Every dose in the journal up to the session (later ones are left out here). */
    doses: ToleranceDose[];
    details: Record<string, Detail>;
    /** The session: its last dose. */
    here: number;
    now: number;
    /** How far back to look. */
    days: number;
    colors: (substance: string) => string;
    names: (substance: string) => string;
}) {
    const box = useRef<HTMLDivElement>(null);
    const [W, setW] = useState(600);
    const scrub = useScrub();
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // From the range back, to a little after the session: enough to see the
    // tolerance it leaves wearing off.
    const start = here - days * DAY;
    const end = here + Math.max(7, Math.round(days / 4)) * DAY;
    const plotW = W - LEFT - RIGHT;
    const x = (t: number) => LEFT + ((Math.min(end, Math.max(start, t)) - start) / (end - start)) * plotW;

    // Each substance's spans, from the doses up to here.
    const bySubstance = new Map<string, number[]>();
    for (const d of doses) if (d.time <= here) bySubstance.set(d.substance, [...(bySubstance.get(d.substance) ?? []), d.time]);
    const rows: { id: string; full: [number, number][]; half: [number, number][]; first: number }[] = [];
    const unknown: string[] = [];
    for (const [id, times] of bySubstance) {
        const tol = toleranceOf(details[id]);
        if (!tol) {
            // Only a catalogue entry that's loaded and says nothing; one still
            // loading, or one of the journal's own, is left out.
            if (details[id] && times.some(t => t >= start)) unknown.push(id);
            continue;
        }
        const full = merge(times.map(t => [t, t + tol.half]));
        const half = merge(times.map(t => [t, t + tol.reset]));
        if (!half.some(([, b]) => b > start)) continue;
        rows.push({ id, full, half, first: Math.min(...times) });
    }
    rows.sort((a, b) => a.first - b.first);

    const H = TOP + rows.length * ROW + AXIS;
    const base = TOP + rows.length * ROW;

    // About one date per 56px: every day, two, a week, a fortnight.
    const room = Math.max(2, Math.floor(plotW / 56));
    const every = [1, 2, 7, 14, 30].map(n => n * DAY).find(n => (end - start) / n <= room) ?? 30 * DAY;
    const ticks: number[] = [];
    const d0 = new Date(here);
    d0.setHours(0, 0, 0, 0);
    for (let t = d0.getTime(); t >= start; t -= every) ticks.unshift(t);
    for (let t = d0.getTime() + every; t <= end; t += every) ticks.push(t);

    const showNow = now - here > DAY && now < end;
    const cx = scrub.x === null ? null : Math.min(LEFT + plotW, Math.max(LEFT, scrub.x));
    const T = cx === null ? null : start + ((cx - LEFT) / plotW) * (end - start);
    const within = (spans: [number, number][], t: number) => spans.some(([a, b]) => t >= a && t < b);
    const onRight = cx !== null && cx < W / 2;

    // Two uprights close together say their names away from each other.
    const close = showNow && x(now) - x(here) < 64;
    const marker = (t: number, label: string, anchor?: 'start' | 'end') => (
        <g className="chart-appear">
            <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={base} className="tl-now" />
            <text
                x={x(t) + (anchor === 'start' ? 3 : anchor === 'end' ? -3 : 0)}
                y={TOP - 10}
                textAnchor={anchor ?? (x(t) > LEFT + plotW - 30 ? 'end' : x(t) < LEFT + 30 ? 'start' : 'middle')}
                className="tl-axis"
            >
                {label}
            </text>
        </g>
    );

    // The box is always there, so its width is known before the details load.
    return (
        <div ref={box} className="-mx-4 md:-mx-6">
            {rows.length > 0 && (
                <div className="relative cursor-crosshair" style={{ touchAction: 'pan-y' }} {...scrub.handlers}>
                    <svg width={W} height={H} className="block tabular-nums select-none" role="img" aria-label={tr('Tolerance from the doses up to this session; press and slide along it to read any day')}>
                        {ticks.map(t => (
                            <line key={t} x1={x(t)} x2={x(t)} y1={TOP} y2={base} className="tl-grid" />
                        ))}
                        {ticks
                            .filter(t => x(t) > LEFT + 18 && x(t) < LEFT + plotW - 18)
                            .map(t => (
                                <text key={t} x={x(t)} y={H - 8} className="tl-axis" textAnchor="middle">
                                    {dayText(t)}
                                </text>
                            ))}
                        {rows.map((r, k) => {
                            const top = TOP + k * ROW;
                            const bar = (spans: [number, number][], opacity: number) =>
                                spans
                                    .filter(([a, b]) => b > start && a < end)
                                    .map(([a, b]) => {
                                        const w = Math.max(BAR, x(b) - x(a));
                                        return <rect key={a} x={x(a)} y={top + ROW - BAR - 6} width={w} height={BAR} rx={BAR / 2} fill={colors(r.id)} opacity={opacity} />;
                                    });
                            return (
                                <g key={r.id} className="chart-appear">
                                    <text x={LEFT} y={top + 12} className="tl-axis">
                                        {names(r.id)}
                                    </text>
                                    {bar(r.half, 0.35)}
                                    {bar(r.full, 0.9)}
                                </g>
                            );
                        })}
                        {cx === null && marker(here, tr('here'), close ? 'end' : undefined)}
                        {cx === null && showNow && marker(now, tr('now'), close ? 'start' : undefined)}
                        {cx !== null && <line x1={cx} x2={cx} y1={TOP - 6} y2={base} stroke="var(--text)" strokeWidth={1} opacity={0.5} />}
                    </svg>
                    {T !== null && (
                        <div className="chart-readout pointer-events-none absolute top-1" style={onRight ? { left: cx! + 10 } : { right: W - cx! + 10 }} aria-live="polite">
                            <p className="font-medium tabular-nums text-[var(--text)]">{dayText(T)}</p>
                            {rows.map(r => (
                                <p key={r.id} className="flex items-center gap-1.5 whitespace-nowrap text-[var(--text-muted)]">
                                    <span className="font-medium" style={{ color: colors(r.id) }}>
                                        {names(r.id)}
                                    </span>
                                    {within(r.full, T) ? tr('fully tolerant') : within(r.half, T) ? tr('half tolerant') : tr('back to normal')}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <p className="mt-2 px-4 md:px-6 text-xs text-[var(--text-muted)]">
                {rows.length > 0 && tr('From each dose up to this session: darker until tolerance is halved, lighter until it’s back to normal.')}
                {rows.length > 0 && unknown.length > 0 && ' '}
                {unknown.length > 0 && tr('No tolerance is documented for {0}.', { 0: phraseList(unknown.map(names)) })}
            </p>
        </div>
    );
}
