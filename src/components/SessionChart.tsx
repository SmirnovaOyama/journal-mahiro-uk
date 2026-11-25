import { useEffect, useRef, useState } from 'react';
import type { Course } from '../lib/time';

/* A session on one clock: each dose's curve from the time it was taken, in
   its substance's colour, drawn as the substance page draws one (Timeline):
   flat gridlines, clock times under, "now" a dotted upright. A dose whose
   timing isn't documented is a dot on the baseline, not a guessed curve.
   A dose's curve is as tall as its amount is against the common dose (a
   light one lower, a strong one taller), within reason. */

export interface ChartDose {
    id: string;
    time: number;
    color: string;
    course: Course | null;
    /** The amount against the common dose's middle; 1 when unknown. */
    strength: number;
}

const H = 196;
const TOP = 14;
const BASE = 160;
const LEFT = 12;
const RIGHT = 12;
const MIN = 60_000;

function clock(t: number) {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SessionChart({ doses, now }: { doses: ChartDose[]; now: number }) {
    const box = useRef<HTMLDivElement>(null);
    const [W, setW] = useState(600);
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    if (!doses.length) return null;

    const first = Math.min(...doses.map(d => d.time));
    const ends = doses.map(d => d.time + (d.course ? d.course.over : 60) * MIN);
    let start = first - 15 * MIN;
    let end = Math.max(...ends, first + 2 * 3600_000);
    // Now inside the night, or just after it: show it.
    if (now > start && now < end + 3 * 3600_000) end = Math.max(end, now + 20 * MIN);
    end = Math.min(end, start + 36 * 3600_000);
    if (now < start) start = Math.min(start, now);

    const plotW = W - LEFT - RIGHT;
    const x = (t: number) => LEFT + ((t - start) / (end - start)) * plotW;
    const y = (lvl: number) => BASE - lvl * (BASE - TOP - 8);

    const curve = (d: ChartDose) => {
        const c = d.course!;
        const h = Math.min(1.15, Math.max(0.35, d.strength)) / 1.15;
        const t = (m: number) => x(d.time + m * MIN);
        const { firstEffects: a, peakStart: b, peakEnd: e, over: f } = c;
        return [
            `M${t(0)} ${y(0)}`,
            `L${t(a)} ${y(0.01)}`,
            `C${t(a + (b - a) * 0.55)} ${y(0.04 * h)} ${t(a + (b - a) * 0.6)} ${y(h)} ${t(b)} ${y(h)}`,
            `L${t(e)} ${y(h)}`,
            `C${t(e + (f - e) * 0.45)} ${y(h)} ${t(e + (f - e) * 0.5)} ${y(0.02)} ${t(f)} ${y(0)}`,
        ].join(' ');
    };

    const span = end - start;
    const room = Math.max(2, Math.floor(plotW / 64));
    const every = [30, 60, 120, 180, 240, 360, 720].map(m => m * MIN).find(m => span / m <= room) ?? 720 * MIN;
    const ticks: number[] = [];
    const d0 = new Date(start);
    d0.setMinutes(0, 0, 0);
    for (let t = d0.getTime(); t <= end; t += every) if (t >= start) ticks.push(t);

    const showNow = now >= start && now <= end;

    return (
        <div ref={box} className="-mx-4 md:-mx-6">
            <svg width={W} height={H} className="block tabular-nums select-none" role="img" aria-label={'The session over time'}>
                {[0, 0.5, 1].map(l => (
                    <line key={l} x1={LEFT} x2={LEFT + plotW} y1={y(l)} y2={y(l)} className="tl-grid" />
                ))}
                {ticks
                    .filter(t => x(t) > LEFT + 14 && x(t) < LEFT + plotW - 14)
                    .map(t => (
                        <text key={t} x={x(t)} y={H - 10} className="tl-axis" textAnchor="middle">
                            {clock(t)}
                        </text>
                    ))}
                {doses.map(d =>
                    d.course ? (
                        <g key={d.id} className="chart-appear">
                            <path d={`${curve(d)} Z`} fill={d.color} opacity={0.1} stroke="none" />
                            <path d={curve(d)} fill="none" stroke={d.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                    ) : null,
                )}
                {doses.map(d => (
                    <circle key={`dot-${d.id}`} cx={x(d.time)} cy={y(0)} r={4} fill="var(--bg)" stroke={d.color} strokeWidth={2} />
                ))}
                {showNow && (
                    <g className="chart-appear">
                        <line x1={x(now)} x2={x(now)} y1={TOP} y2={BASE} className="tl-now" />
                        <text x={x(now)} y={TOP - 2} textAnchor={x(now) > LEFT + plotW - 30 ? 'end' : 'middle'} className="tl-axis">
                            {'now'}
                        </text>
                    </g>
                )}
            </svg>
        </div>
    );
}
