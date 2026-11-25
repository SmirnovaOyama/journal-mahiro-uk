import { useEffect, useMemo, useRef, useState } from 'react';
import type { DurationRow } from '../lib/data';
import {
    clockAt,
    courseOf,
    dayWord,
    formatMinutes,
    formatSpan,
    nowRounded,
    parseSpan,
    type Course,
} from '../lib/time';
import { ClockDial } from './ClockDial';
import { headerAction, headerActionAccent } from './PageHeader';
import { ChevronDown, Clock } from './icons';

/* How long, drawn as hrt.mahiro.uk draws its hormone level timeline
   (components/ResultChart.tsx there): a small title with its control on the
   right, then the plot run out a little past the column, flat gridlines across,
   the line in the chart colour sweeping in, the peak a quiet wash with dashed
   edges and its name in the corner the way the target band is, and "now" a
   dotted upright with a point where it meets the line. */

const H = 240;
const TOP = 16;
const BASE = 206;
const LEFT = 16;
const RIGHT = 16;

function toClock(m: number) {
    const h = String(Math.floor(m / 60) % 24).padStart(2, '0');
    const mm = String(Math.round(m) % 60).padStart(2, '0');
    return `${h}:${mm}`;
}

function at(start: number, add: number) {
    const c = clockAt(start, add);
    const d = dayWord(c.dayOffset);
    if (!d) return c.time;
    return `${c.time} ${d}`;
}

function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

function Curve({
    course,
    start,
    W,
    relative,
}: {
    course: Course;
    start: number;
    W: number;
    relative: boolean;
}) {
    // Long after-effects (LSD's run to two days) would squash the night into
    // a corner, so the plot shows at most half as long again after it ends and
    // lets the dashed tail run off the edge; the words give the real time.
    const tailEnd = course.afterEnd != null ? Math.min(course.afterEnd, course.over * 1.5) : null;
    const end = (tailEnd ?? course.over) * 1.03;
    const plotW = W - LEFT - RIGHT;
    const x = (m: number) => LEFT + (m / end) * plotW;
    const y = (lvl: number) => BASE - lvl * (BASE - TOP - 10);
    const { firstEffects: a, peakStart: b, peakEnd: c, over: d } = course;

    const main = [
        `M${x(0)} ${y(0)}`,
        `L${x(a)} ${y(0.02)}`,
        `C${x(a + (b - a) * 0.55)} ${y(0.05)} ${x(a + (b - a) * 0.6)} ${y(1)} ${x(b)} ${y(1)}`,
        `L${x(c)} ${y(1)}`,
        `C${x(c + (d - c) * 0.45)} ${y(1)} ${x(c + (d - c) * 0.5)} ${y(0.08)} ${x(d)} ${y(0.08)}`,
    ].join(' ');
    const tail =
        tailEnd != null
            ? `M${x(d)} ${y(0.08)} C${x(d + (tailEnd - d) * 0.5)} ${y(0.06)} ${x(tailEnd - (tailEnd - d) * 0.2)} ${y(0.01)} ${LEFT + plotW} ${y(0.01)}`
            : null;

    // About one label per 64px: whole hours on the clock, or minutes from
    // taking it for something that's over within the hour.
    const room = Math.max(2, Math.floor(plotW / 64));
    const steps = relative ? [0.5, 1, 2, 5, 10, 15, 30, 60] : [60, 120, 180, 240, 360, 720, 1440];
    const every = steps.find(m => end / m <= room) ?? steps[steps.length - 1];
    const ticks: number[] = [];
    const first = relative ? every : Math.ceil(start / every) * every - start;
    for (let t = first; t <= end; t += every) ticks.push(t);
    const label = (t: number) =>
        relative
            ? t < 1
                ? `${Math.round(t * 60)} s`
                : `${t} min`
            : toClock((((start + t) % 1440) + 1440) % 1440);

    // Where "now" falls, if the night drawn includes it.
    let nowAt: number | null = null;
    if (!relative) {
        const since = (((nowMinutes() - start) % 1440) + 1440) % 1440;
        if (since > 0.5 && since < end) nowAt = since;
    }
    const levelAt = (m: number) => {
        if (m <= a) return 0.02;
        if (m <= b) return 0.02 + 0.98 * ((m - a) / Math.max(b - a, 1e-6));
        if (m <= c) return 1;
        if (m <= d) return 1 - 0.92 * ((m - c) / Math.max(d - c, 1e-6));
        return 0.06;
    };

    const grid = [0, 0.5, 1].map(l => y(l));

    return (
        <svg
            width={W}
            height={H}
            className="block tabular-nums select-none"
            role="img"
            aria-label={'How strong it feels over time'}
        >
            {grid.map((gy, i) => (
                <line key={i} x1={LEFT} x2={LEFT + plotW} y1={gy} y2={gy} className="tl-grid" />
            ))}
            {/* The peak, as hrt marks its target band: a quiet wash, dashed edges, its name inside. */}
            <g className="chart-appear" style={{ animationDelay: '120ms' }}>
                <rect x={x(b)} y={TOP} width={Math.max(x(c) - x(b), 1)} height={BASE - TOP} className="tl-peak" />
                <line x1={x(b)} x2={x(b)} y1={TOP} y2={BASE} className="tl-peak-edge" />
                <line x1={x(c)} x2={x(c)} y1={TOP} y2={BASE} className="tl-peak-edge" />
                <text x={x(b) + 6} y={TOP + 14} className="tl-peak-label">
                    {'Peak'}
                </text>
            </g>
            {ticks
                .filter(t => x(t) > LEFT + 14 && x(t) < LEFT + plotW - 14)
                .map(t => (
                    <text key={t} x={x(t)} y={H - 10} className="tl-axis" textAnchor="middle">
                        {label(t)}
                    </text>
                ))}
            <path d={main} className="tl-line chart-sweep" pathLength={1} />
            {tail && <path d={tail} className="tl-tail" />}
            <circle cx={x(0)} cy={y(0)} r="4" className="tl-dose" />
            {nowAt != null && (
                <g className="chart-appear" style={{ animationDelay: '300ms' }}>
                    <line x1={x(nowAt)} x2={x(nowAt)} y1={TOP} y2={BASE} className="tl-now" />
                    <circle cx={x(nowAt)} cy={y(levelAt(nowAt))} r="4.5" className="tl-now-dot" />
                </g>
            )}
        </svg>
    );
}

/** How long: the night drawn out on the clock, from the time it's taken. */
export function Timeline({ row }: { row: DurationRow }) {
    const [start, setStart] = useState(nowRounded);
    const [dialOpen, setDialOpen] = useState(false);
    const course = useMemo(() => courseOf(row), [row]);
    // Drawn at its real width, so the clock labels stay 13px on any screen.
    const box = useRef<HTMLDivElement>(null);
    const [W, setW] = useState(640);
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, [course]);
    const total = parseSpan(row.total);
    const span = (x: NonNullable<ReturnType<typeof parseSpan>>) => formatSpan(x);
    const title = <h2 className="text-sm font-medium text-[var(--text)] truncate">{'How long'}</h2>;

    if (!course) {
        const rows = (
            [
                ['First effects after', row.onset],
                ['Coming up for', row.comeup],
                ['Peak lasts', row.peak],
                ['Wears off over', row.offset],
                ['After-effects', row.afterEffects],
                ['In total', row.total],
            ] as const
        ).filter(([, v]) => parseSpan(v));
        return (
            <div>
                <div className="flex items-center justify-between gap-3 mb-1">{title}</div>
                {rows.length ? (
                    <div className="settings-section">
                        {rows.map(([k, v]) => (
                            <div className="fact-row" key={k}>
                                <span>{k}</span>
                                <span className="tabular">{span(parseSpan(v)!)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[var(--text-muted)]">
                        {'No reliable timing is documented.'}
                    </p>
                )}
            </div>
        );
    }

    const s = course.spans;
    const isNow = start === nowRounded();
    const relative = course.over < 60;

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-1">
                {title}
                {!relative && (
                    <button
                        type="button"
                        className={`${dialOpen ? headerActionAccent : headerAction} -me-2.5 tabular-nums`}
                        aria-expanded={dialOpen}
                        onClick={() => setDialOpen(o => !o)}
                    >
                        <Clock size={16} />
                        {`Taken at ${toClock(start)}`}
                        <ChevronDown size={15} className={`chev ${dialOpen ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {!relative && (
                <div className="disclosure" data-open={dialOpen} {...(dialOpen ? {} : { inert: '' })}>
                    <div className="disclosure-inner">
                        <div className="pt-3 pb-2">
                            <ClockDial
                                start={start}
                                onChange={setStart}
                                onNow={() => setStart(nowRounded())}
                                isNow={isNow}
                                course={course}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div ref={box} className="-mx-4 md:-mx-6">
                <Curve course={course} start={relative ? 0 : start} W={W} relative={relative} />
            </div>

            {relative ? (
                <div className="settings-section mt-2">
                    <div className="fact-row">
                        <span>{'You’ll start to feel it'}</span>
                        <span className="tabular">
                            {s.onset ? `after ${span(s.onset)}` : 'at once'}
                        </span>
                    </div>
                    {s.peak && (
                        <div className="fact-row">
                            <span>{'Strongest for'}</span>
                            <span className="tabular">{span(s.peak)}</span>
                        </div>
                    )}
                    <div className="fact-row">
                        <span>{'Over after'}</span>
                        <span className="tabular">{total ? span(total) : formatMinutes(course.over)}</span>
                    </div>
                    {s.afterEffects && (
                        <div className="fact-row">
                            <span>{'After-effects'}</span>
                            <span className="tabular">
                                {`${span(s.afterEffects)} more`}
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="settings-section mt-2">
                    <div className="fact-row">
                        <span>{'You’ll start to feel it'}</span>
                        <span className="tabular">
                            {`around ${at(start, course.firstEffects)}`}
                            {s.onset && (
                                <span className="fact-sub">{`after ${span(s.onset)}`}</span>
                            )}
                        </span>
                    </div>
                    <div className="fact-row">
                        <span>{'Strongest'}</span>
                        <span className="tabular">
                            {`${at(start, course.peakStart)} to ${at(start, course.peakEnd)}`}
                            {s.peak && <span className="fact-sub">{`for ${span(s.peak)}`}</span>}
                        </span>
                    </div>
                    <div className="fact-row">
                        <span>{'Mostly over by'}</span>
                        <span className="tabular">
                            {at(start, course.over)}
                            {total && <span className="fact-sub">{`${span(total)} in all`}</span>}
                        </span>
                    </div>
                    {course.afterEnd != null && s.afterEffects && (
                        <div className="fact-row">
                            <span>{'After-effects can last until'}</span>
                            <span className="tabular">
                                {at(start, course.afterEnd)}
                                <span className="fact-sub">
                                    {`${span(s.afterEffects)} more`}
                                </span>
                            </span>
                        </div>
                    )}
                </div>
            )}
            <p className="footnote">
                {relative
                    ? 'It’s over in minutes, which makes it easy to take again and again. Repeated doses add up even when each one wears off.'
                    : `Times use the middle of each range, ${formatMinutes(course.over)} from start to finish. Yours can run faster or slower, and redosing before the peak is a common way to take too much.`}
            </p>
        </div>
    );
}
