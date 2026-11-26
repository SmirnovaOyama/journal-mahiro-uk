import { useEffect, useRef, useState } from 'react';
import { useWeights, type WeightEntry } from '../lib/journal';
import { KG_PER_LB, WEIGHT_KG_MAX, WEIGHT_KG_MIN, setWeightUnit, useWeight } from '../lib/store';
import Doodle from './Doodle';
import Segmented from './Segmented';
import { useScrub } from './scrub';
import { ChevronDown, Close, Plus } from './icons';
import { dateLocale, tr } from '../lib/i18n';

/* Body weight, beside the log and the stats: a line of every weighing, the
   latest and how far it has moved, a form to log one, and each one listed,
   newest first, to change or delete. Kept in kg in the journal (so it syncs
   and exports with it); shown in the unit of the body weight in Settings.
   Logging the newest weighing also sets that body weight, so per-kilogram
   doses and blood alcohol read from the latest one. */

type WeightUnit = 'kg' | 'lb';
const LB_PER_KG = 1 / KG_PER_LB;

const muted = 'text-[var(--text-muted)]';
const on = 'text-[var(--text)]';

const toUnit = (kg: number, u: WeightUnit) => (u === 'lb' ? kg * LB_PER_KG : kg);
const fromUnit = (n: number, u: WeightUnit) => (u === 'lb' ? n / LB_PER_KG : n);
const fmt = (kg: number, u: WeightUnit) => (Math.round(toUnit(kg, u) * 10) / 10).toFixed(1);

function toLocalInput(t: number) {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const dateOf = (t: number) => new Date(t).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const clockOf = (t: number) => new Date(t).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', hour12: false });

function WeightForm({
    unit,
    editing,
    onSave,
    onCancel,
    onDelete,
}: {
    unit: WeightUnit;
    editing?: WeightEntry;
    onSave: (w: { kg: number; time: number; note?: string }) => void;
    onCancel: () => void;
    onDelete?: () => void;
}) {
    const [text, setText] = useState(editing ? fmt(editing.kg, unit) : '');
    const [time, setTime] = useState(editing?.time ?? Date.now());
    const [note, setNote] = useState(editing?.note ?? '');
    const n = Number(text.replace(',', '.'));
    const kg = fromUnit(n, unit);
    const ok = text.trim() !== '' && Number.isFinite(n) && kg >= WEIGHT_KG_MIN && kg <= WEIGHT_KG_MAX;
    const label = `block text-xs font-medium ${muted} mb-1.5`;
    return (
        <form
            className="flex flex-col gap-5"
            onSubmit={e => {
                e.preventDefault();
                if (!ok) return;
                const trimmed = note.trim();
                onSave({ kg: Math.round(kg * 1000) / 1000, time, ...(trimmed ? { note: trimmed } : {}) });
            }}
        >
            <div>
                <label className={label} htmlFor="weight-amount">
                    {tr('Weight')}
                </label>
                <div className="flex items-center gap-3">
                    <input
                        id="weight-amount"
                        className={`input-base flex-1 text-lg tabular-nums ${text ? 'is-inked' : ''}`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={unit === 'kg' ? '62.5' : '138'}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        aria-invalid={text !== '' && !ok}
                        autoFocus={!editing}
                    />
                    <span className={`text-sm ${muted} w-6`}>{unit}</span>
                </div>
            </div>
            <div>
                <label className={label} htmlFor="weight-time">
                    {tr('Weighed at')}
                </label>
                <div className="flex items-end gap-3">
                    <input
                        id="weight-time"
                        type="datetime-local"
                        className="input-base flex-1 tabular-nums is-inked"
                        value={toLocalInput(time)}
                        onChange={e => {
                            const t = new Date(e.target.value).getTime();
                            if (Number.isFinite(t)) setTime(t);
                        }}
                    />
                    <button
                        type="button"
                        className="inline-flex h-8 items-center px-2.5 text-sm font-medium rounded-full text-[var(--accent-ink)] hover:bg-[var(--accent-subtle)]"
                        onClick={() => setTime(Date.now())}
                    >
                        {tr('Now')}
                    </button>
                </div>
            </div>
            <div>
                <label className={label} htmlFor="weight-note">
                    {tr('Note')}
                </label>
                <input
                    id="weight-note"
                    className={`input-base w-full ${note ? 'is-inked' : ''}`}
                    placeholder={tr('Morning, after a run…')}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-3 pt-1">
                <button type="submit" className="btn-primary" disabled={!ok}>
                    {editing ? tr('Save') : tr('Log it')}
                </button>
                <button type="button" className="btn-secondary" onClick={onCancel}>
                    {tr('Cancel')}
                </button>
                {onDelete && (
                    <button
                        type="button"
                        className="ms-auto inline-flex h-9 items-center gap-1 px-3 text-sm font-medium rounded-full text-[var(--danger)] hover:bg-[var(--surface-hover)]"
                        onClick={onDelete}
                    >
                        <Close size={15} />
                        {tr('Delete')}
                    </button>
                )}
            </div>
        </form>
    );
}

/* Every weighing on one line, oldest on the left, read by sliding along it. */
function WeightChart({ weights, unit }: { weights: WeightEntry[]; unit: WeightUnit }) {
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
    if (weights.length < 2) return null;

    const H = 168;
    const LEFT = 40;
    const RIGHT = 20;
    const TOP = 14;
    const BASE = H - 26;
    const plotW = W - LEFT - RIGHT;
    const vals = weights.map(w => toUnit(w.kg, unit));
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    // At least a couple of units tall, so a flat run doesn't look like a cliff.
    const pad = Math.max((hi - lo) * 0.15, 1);
    lo -= pad;
    hi += pad;
    const t0 = weights[0].time;
    const t1 = weights[weights.length - 1].time;
    const span = Math.max(1, t1 - t0);
    const x = (t: number) => LEFT + ((t - t0) / span) * plotW;
    const y = (v: number) => BASE - ((v - lo) / (hi - lo)) * (BASE - TOP);
    const d = weights.map((w, i) => `${i ? 'L' : 'M'}${x(w.time).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
    const grid = [lo + pad, (lo + hi) / 2, hi - pad];

    const cx = scrub.x === null ? null : Math.min(LEFT + plotW, Math.max(LEFT, scrub.x));
    let near = -1;
    if (cx !== null) {
        let best = Infinity;
        weights.forEach((w, i) => {
            const dist = Math.abs(x(w.time) - cx);
            if (dist < best) {
                best = dist;
                near = i;
            }
        });
    }
    const hit = near >= 0 ? weights[near] : null;
    const hx = hit ? x(hit.time) : 0;
    const onRight = hx < W / 2;

    return (
        <div ref={box} className="relative -mx-4 md:-mx-6 cursor-crosshair" style={{ touchAction: 'pan-y' }} {...scrub.handlers}>
            <svg width={W} height={H} className="block tabular-nums select-none" role="img" aria-label={tr('Body weight over time; press and slide along it to read each weighing')}>
                {grid.map(g => (
                    <g key={g}>
                        <line x1={LEFT} x2={LEFT + plotW} y1={y(g)} y2={y(g)} className="tl-grid" />
                        <text x={LEFT - 6} y={y(g) + 4} className="tl-axis" textAnchor="end">
                            {Math.round(g)}
                        </text>
                    </g>
                ))}
                <text x={LEFT} y={H - 8} className="tl-axis" textAnchor="start">
                    {dateOf(t0)}
                </text>
                <text x={LEFT + plotW} y={H - 8} className="tl-axis" textAnchor="end">
                    {dateOf(t1)}
                </text>
                <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="chart-appear" />
                {weights.length <= 60 &&
                    weights.map((w, i) => <circle key={w.id} cx={x(w.time)} cy={y(vals[i])} r={3} fill="var(--bg)" stroke="var(--accent)" strokeWidth={2} />)}
                {hit && (
                    <g>
                        <line x1={hx} x2={hx} y1={TOP} y2={BASE} stroke="var(--text)" strokeWidth={1} opacity={0.5} />
                        <circle cx={hx} cy={y(vals[near])} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
                    </g>
                )}
            </svg>
            {hit && (
                <div className="chart-readout pointer-events-none absolute top-1" style={onRight ? { left: hx + 10 } : { right: W - hx + 10 }} aria-live="polite">
                    <p className="font-medium tabular-nums text-[var(--text)]">{`${fmt(hit.kg, unit)} ${unit}`}</p>
                    <p className="whitespace-nowrap text-[var(--text-muted)]">{`${dateOf(hit.time)}, ${clockOf(hit.time)}`}</p>
                </div>
            )}
        </div>
    );
}

function WeightRow({ w, unit, open, onToggle }: { w: WeightEntry; unit: WeightUnit; open: boolean; onToggle: () => void }) {
    const { update, remove } = useWeights();
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className={`w-[calc(100%+1rem)] -mx-2 px-2 py-3 flex items-center gap-3 text-start rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] ${open ? 'bg-[var(--surface-hover)]' : ''}`}
            >
                <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                        <span className={`text-sm font-medium tabular-nums ${on}`}>{`${fmt(w.kg, unit)} ${unit}`}</span>
                        <span className={`text-xs tabular-nums ${muted} shrink-0`}>{`${dateOf(w.time)}, ${clockOf(w.time)}`}</span>
                    </span>
                    {w.note && <span className={`mt-0.5 block truncate text-xs ${muted}`}>{w.note}</span>}
                </span>
                <ChevronDown size={16} className={`chev ${muted} shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className="disclosure" data-open={open} {...(open ? {} : { inert: '' })}>
                <div className="disclosure-inner">
                    {open && (
                        <div className="pt-3 pb-5">
                            <WeightForm
                                unit={unit}
                                editing={w}
                                onSave={next => {
                                    update({ id: w.id, ...next });
                                    onToggle();
                                }}
                                onCancel={onToggle}
                                onDelete={() => {
                                    remove(w.id);
                                    onToggle();
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function WeightLog() {
    const { weights, add } = useWeights();
    const body = useWeight();
    const unit = body.unit;
    const setUnit = setWeightUnit;
    const [adding, setAdding] = useState(false);
    const [openRow, setOpenRow] = useState<string | null>(null);
    const latest = weights[weights.length - 1];
    // How far it has moved over the last 30 days, against the weighing nearest 30 days before the latest.
    const month = latest ? weights.filter(w => w.time <= latest.time - 30 * 86400_000).pop() : undefined;
    const change = latest && month ? toUnit(latest.kg, unit) - toUnit(month.kg, unit) : null;
    const newestFirst = [...weights].reverse();

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-5">
                <button
                    type="button"
                    className={`inline-flex h-9 items-center gap-1.5 px-3.5 text-sm font-medium rounded-full ${adding ? 'btn-secondary' : 'btn-primary'}`}
                    aria-expanded={adding}
                    onClick={() => setAdding(a => !a)}
                >
                    {!adding && <Plus size={16} />}
                    {adding ? tr('Close') : tr('Log weight')}
                </button>
                <Segmented
                    aria-label={tr('Unit')}
                    options={[
                        { id: 'kg', label: 'kg' },
                        { id: 'lb', label: 'lb' },
                    ]}
                    value={unit}
                    onChange={setUnit}
                />
            </div>

            <div className="disclosure" data-open={adding} {...(adding ? {} : { inert: '' })}>
                <div className="disclosure-inner">
                    {adding && (
                        <div className="pb-8">
                            <WeightForm
                                unit={unit}
                                onSave={w => {
                                    add(w);
                                    // The newest weighing is the body weight Settings keeps.
                                    const newest = !latest || w.time >= latest.time;
                                    if (newest && w.kg >= WEIGHT_KG_MIN && w.kg <= WEIGHT_KG_MAX) body.save(w.kg, unit);
                                    setAdding(false);
                                }}
                                onCancel={() => setAdding(false)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {weights.length === 0 ? (
                adding ? null : (
                    <div className="flex flex-col items-center text-center pt-6 pb-10">
                        <Doodle name="notebook" size={4.5} />
                        <p className={`mt-4 text-sm font-medium ${on}`}>{tr('No weight logged yet')}</p>
                        <p className={`mt-1 text-sm ${muted} max-w-xs`}>
                            {tr('Log your weight now and then to see it over time. It’s kept with the journal: on this device, and in your account if you sync. The newest one is also your body weight in Settings.')}
                        </p>
                    </div>
                )
            ) : (
                <>
                    <section className="mb-8">
                        <div className="flex items-baseline gap-3">
                            <span className={`text-3xl font-semibold tabular-nums ${on}`}>{fmt(latest.kg, unit)}</span>
                            <span className={`text-sm ${muted}`}>{unit}</span>
                            {change !== null && (
                                <span className={`ms-auto text-sm tabular-nums ${muted}`}>
                                    {tr('{0}{1} {2} in 30 days', { 0: change > 0 ? '+' : change < 0 ? '−' : '±', 1: Math.abs(Math.round(change * 10) / 10).toFixed(1), 2: unit })}
                                </span>
                            )}
                        </div>
                        <p className={`text-xs ${muted} mt-0.5`}>{tr('Last weighed {0}', { 0: dateOf(latest.time) })}</p>
                        <div className="mt-4">
                            <WeightChart weights={weights} unit={unit} />
                        </div>
                    </section>
                    <section className="mb-8">
                        <h2 className="group-heading mb-1">{weights.length === 1 ? tr('1 weighing') : tr('{0} weighings', { 0: weights.length })}</h2>
                        <div className="settings-section">
                            {newestFirst.map(w => (
                                <WeightRow key={w.id} w={w} unit={unit} open={openRow === w.id} onToggle={() => setOpenRow(o => (o === w.id ? null : w.id))} />
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
