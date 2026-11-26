import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCombos, loadDetail, search, type ComboMatrix, type Detail, type DoseRow, type IndexEntry, convertAmount, fmtAmount, isPerKg } from '../lib/data';
import { useJournal, type Ingestion, type Prefill } from '../lib/journal';
import { RANK, VERDICT, checkPair, type PairResult } from '../lib/mix';
import { courseFor, formatMinutes } from '../lib/time';
import { useDetail } from '../lib/useIndex';
import LevelRail from './LevelRail';
import { formatWeight, useWeight } from '../lib/store';
import { absorbedText } from './Absorption';
import Choice from './Choice';
import { Molecule } from './Molecule';
import { SearchField } from './SearchField';
import { CareNote } from './CareNote';
import { isCareSearch } from '../lib/care';
import Switch from './Switch';
import { Alert, Close } from './icons';

/* Logging one dose: what, how, how much, when. Laid out as hrt.mahiro.uk's
   dose form is, labelled lines one under another, and as it's filled in it
   says what the journal already knows: the same thing taken again too soon,
   or something taken in the last day that it mixes badly with. */

const ROUTES = ['Oral', 'Sublingual', 'Insufflated', 'Smoked', 'Vaporized', 'Inhaled', 'Intravenous', 'Intramuscular', 'Rectal', 'Transdermal'];
const UNITS = ['mg', 'μg', 'g', 'mL', 'tabs', 'drinks', 'puffs'];

/** "2025-11-25T21:40", local time, as datetime-local reads and writes it. */
function toLocalInput(t: number) {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Band = 'below' | 'light' | 'common' | 'strong' | 'heavy';
const BAND_NAMES: Record<Band, string> = {
    below: 'Below threshold',
    light: 'Light',
    common: 'Common',
    strong: 'Strong',
    heavy: 'Heavy',
};
const BAND_TONE: Record<Band, string> = {
    below: 'text-[var(--text-muted)]',
    light: 'text-[var(--status-info)]',
    common: 'text-[var(--accent-ink)]',
    strong: 'text-[var(--warning)]',
    heavy: 'text-[var(--danger)]',
};

export function bandOf(row: DoseRow, v: number): Band | null {
    const seg = row.segments;
    if (!seg) return null;
    const threshold = parseFloat(row.threshold ?? '');
    if (Number.isFinite(threshold) && v < threshold) return 'below';
    for (const b of ['heavy', 'strong', 'common', 'light'] as const) {
        const s = seg[b];
        if (s && v >= s[0]) return b;
    }
    return seg.light && v < seg.light[0] ? 'below' : null;
}

/** Same unit, written either way: μg (Greek mu) and µg (micro sign). */

export function IngestionForm({
    index,
    byId,
    initial,
    editing,
    onSave,
    onCancel,
    onDelete,
}: {
    index: IndexEntry[] | null;
    byId: Map<string, IndexEntry>;
    initial?: Prefill;
    editing?: Ingestion;
    onSave: (i: Omit<Ingestion, 'id'> & { id?: string }) => void;
    onCancel: () => void;
    onDelete?: () => void;
}) {
    const { data } = useJournal();
    const start = editing ?? initial;

    const [substance, setSubstance] = useState<string | null>(editing?.substance ?? initial?.id ?? null);
    const [custom, setCustom] = useState<string>(editing && !byId.get(editing.substance) ? editing.name : '');
    const [q, setQ] = useState('');
    const [route, setRoute] = useState<string>(start?.route ?? '');
    const [doseText, setDoseText] = useState(start?.dose != null ? String(start.dose) : '');
    const [unit, setUnit] = useState(start?.unit ?? '');
    const [estimate, setEstimate] = useState(editing?.estimate ?? false);
    const [time, setTime] = useState(start?.time ?? Date.now());
    const [note, setNote] = useState(editing?.note ?? '');
    const searchRef = useRef<HTMLInputElement>(null);

    const entry = substance ? byId.get(substance) : undefined;
    const { detail } = useDetail(entry ? entry.id : null);
    const routes = useMemo(() => {
        const seen: string[] = [];
        for (const r of detail?.doseRows ?? []) if (!seen.includes(r.roa)) seen.push(r.roa);
        for (const r of detail?.durationRows ?? []) if (!seen.includes(r.roa)) seen.push(r.roa);
        return seen.length ? seen : ROUTES.slice(0, 6);
    }, [detail]);
    useEffect(() => {
        if (!route || (!routes.includes(route) && !ROUTES.includes(route))) setRoute(routes[0]);
    }, [routes, route]);
    const row = detail?.doseRows.find(r => r.roa === route);
    useEffect(() => {
        if (!unit && row?.unit) setUnit(row.unit);
        if (!unit && !row && detail) setUnit('mg');
    }, [row, unit, detail]);

    const dose = doseText.trim() === '' ? null : Number(doseText.replace(',', '.'));
    const doseOk = dose === null || (Number.isFinite(dose) && dose >= 0);
    // In the route's own unit: 0.1 mg is 100 µg, and with a body weight, an
    // amount is so much a kilogram (a dose given per kilogram).
    const weight = useWeight();
    const inRowUnit = row && dose != null && doseOk ? convertAmount(dose, unit, row.unit, weight.kg) : null;
    const mass = unit.split('/')[0].trim();
    const perKgLine =
        weight.kg && dose != null && doseOk && dose > 0 && /^(g|mg|μg|µg)$/.test(mass) && !isPerKg(unit)
            ? `${fmtAmount(dose / weight.kg)} ${unit}/kg at ${formatWeight(weight.kg, weight.unit)}`
            : null;
    const band = row && inRowUnit != null ? bandOf(row, inRowUnit) : null;

    // ── what the journal already says ──
    const [matrix, setMatrix] = useState<ComboMatrix>();
    const [others, setOthers] = useState<Record<string, Detail>>({});
    const recent = useMemo(
        () => data.ingestions.filter(i => i.id !== editing?.id && Math.abs(time - i.time) < 24 * 3600_000 && i.time <= time + 3600_000),
        [data.ingestions, editing?.id, time],
    );
    useEffect(() => {
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);
    useEffect(() => {
        for (const i of recent)
            if (byId.get(i.substance) && !others[i.substance])
                loadDetail(i.substance)
                    .then(d => setOthers(p => ({ ...p, [d.id]: d })))
                    .catch(() => {});
    }, [recent, byId, others]);

    const warnings = useMemo(() => {
        const out: { key: string; tone: 'danger' | 'warning'; text: string }[] = [];
        if (!entry) return out;
        // The same substance again.
        const same = recent.filter(i => i.substance === entry.id && i.time <= time).sort((a, b) => b.time - a.time)[0];
        if (same) {
            const ago = Math.max(1, Math.round((time - same.time) / 60000));
            // By the route it was taken; if that isn't documented, the longest
            // any route lasts, and the warning says so.
            const c = courseFor(detail?.durationRows, same.route);
            const still = c && ago < c.course.over;
            const amount = same.dose != null ? ` (${same.dose} ${same.unit})` : '';
            out.push({
                key: 'redose',
                tone: 'warning',
                text: still
                    ? c!.exact
                        ? `You logged ${entry.name}${amount} ${formatMinutes(ago)} ago, and it usually lasts ${formatMinutes(c!.course.over)}. A redose adds to what’s still working.`
                        : `You logged ${entry.name}${amount} ${formatMinutes(ago)} ago. How long it lasts taken that way isn’t documented; other ways, up to ${formatMinutes(c!.course.over)}. A redose may add to what’s still working.`
                    : `You logged ${entry.name}${amount} ${formatMinutes(ago)} ago.`,
            });
        }
        // Anything else from the last day it mixes badly with.
        const seen = new Set<string>();
        const pairs: PairResult[] = [];
        for (const i of recent) {
            const other = byId.get(i.substance);
            if (!other || other.id === entry.id || seen.has(other.id)) continue;
            seen.add(other.id);
            pairs.push(checkPair(entry, other, detail ?? undefined, others[other.id], matrix));
        }
        pairs
            .filter(p => RANK[p.verdict] >= RANK.Caution)
            .sort((a, b) => RANK[b.verdict] - RANK[a.verdict])
            .forEach(p => {
                const v = VERDICT[p.verdict];
                out.push({
                    key: p.b.id,
                    tone: v.tone === 'danger' ? 'danger' : 'warning',
                    text: `${v.label} with ${p.b.name}, logged in the last day. ${v.meaning}`,
                });
            });
        return out;
    }, [entry, recent, time, detail, byId, others, matrix]);

    const hits = useMemo(() => (index && q.trim() ? search(index, q, 6) : []), [index, q]);
    // What's been logged lately, to pick again in one tap.
    const lately = useMemo(() => {
        const seen = new Set<string>();
        const out: { substance: string; name: string }[] = [];
        for (const i of [...data.ingestions].sort((a, b) => b.time - a.time)) {
            if (seen.has(i.substance)) continue;
            seen.add(i.substance);
            out.push({ substance: i.substance, name: byId.get(i.substance)?.name ?? i.name });
            if (out.length >= 8) break;
        }
        return out;
    }, [data.ingestions, byId]);
    const name = entry?.name ?? custom.trim();
    const canSave = !!name && doseOk && Number.isFinite(time);

    const save = () => {
        if (!canSave) return;
        onSave({
            id: editing?.id,
            substance: entry?.id ?? name,
            name,
            route: route || 'Oral',
            dose: dose,
            unit: unit || row?.unit || 'mg',
            estimate,
            time,
            ...(note.trim() ? { note: note.trim() } : {}),
        });
    };

    const label = 'block text-xs font-medium text-[var(--text-muted)] mb-1.5';
    const chip = (active: boolean) =>
        `chip ${active ? 'bg-[var(--accent-subtle)] text-[var(--accent-ink)]' : 'chip-static text-[var(--text-muted)] hover:text-[var(--text)]'}`;

    return (
        <form
            className="flex flex-col gap-5"
            onSubmit={e => {
                e.preventDefault();
                save();
            }}
        >
            {/* What */}
            <div>
                <span className={label}>{'Substance'}</span>
                {name ? (
                    <div className="flex items-center gap-3 min-h-11">
                        {entry && <Molecule id={entry.id} form={entry.form} size="sm" />}
                        <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-[var(--text)]">{name}</span>
                            {!entry && <span className="block text-xs text-[var(--text-muted)]">{'Not in the catalogue'}</span>}
                        </span>
                        {!editing && (
                            <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 px-2.5 text-sm font-medium rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                                onClick={() => {
                                    setSubstance(null);
                                    setCustom('');
                                    setRoute('');
                                    setUnit('');
                                    setTimeout(() => searchRef.current?.focus(), 0);
                                }}
                            >
                                {'Change'}
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        <SearchField
                            ref={searchRef}
                            value={q}
                            onChange={setQ}
                            label={'Find the substance'}
                            placeholder={'Name or street name'}
                            autoFocus
                        />
                        {!q.trim() && lately.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {lately.map(l => (
                                    <button
                                        type="button"
                                        key={l.substance}
                                        className="chip chip-static text-[var(--text)] hover:bg-[var(--surface-hover)]"
                                        onClick={() => {
                                            if (byId.get(l.substance)) setSubstance(l.substance);
                                            else setCustom(l.name);
                                            setRoute('');
                                            setUnit('');
                                        }}
                                    >
                                        {l.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {isCareSearch(q) && <CareNote q={q} />}
                        {q.trim() && (
                            <div className="mt-2 flex flex-col">
                                {hits.map(h => (
                                    <button
                                        type="button"
                                        key={h.entry.id}
                                        className="flex items-center gap-3 py-2 text-start rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] -mx-2 px-2"
                                        onClick={() => {
                                            setSubstance(h.entry.id);
                                            setQ('');
                                            setRoute('');
                                            setUnit('');
                                        }}
                                    >
                                        <Molecule id={h.entry.id} form={h.entry.form} size="xs" />
                                        <span className="flex-1 min-w-0 text-sm text-[var(--text)]">
                                            {h.entry.name}
                                        </span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="flex items-center gap-3 py-2 text-start text-sm text-[var(--text-muted)] rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] -mx-2 px-2"
                                    onClick={() => {
                                        setCustom(q.trim());
                                        setQ('');
                                        setUnit('mg');
                                    }}
                                >
                                    {`Log “${q.trim()}” as written`}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {name && (
                <>
                    {/* How */}
                    <div>
                        <span className={label}>{'Route'}</span>
                        <div className="flex flex-wrap gap-2">
                            {routes.map(r => (
                                <button type="button" key={r} className={chip(route === r)} aria-pressed={route === r} onClick={() => setRoute(r)}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* How much */}
                    <div>
                        <label className={label} htmlFor="dose-amount">
                            {'Amount'}
                        </label>
                        {/* The unit's options unfold under the whole line, not under its own 6rem. */}
                        <div className="flex flex-wrap items-end gap-x-3">
                            <input
                                id="dose-amount"
                                className={`input-base min-w-0 flex-1 text-lg tabular-nums ${doseText ? 'is-inked' : ''}`}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder={'Leave empty if unknown'}
                                value={doseText}
                                onChange={e => setDoseText(e.target.value)}
                                aria-invalid={!doseOk}
                            />
                            <Choice
                                className="w-24 shrink-0"
                                options={[...new Set([row?.unit, unit, ...UNITS].filter(Boolean) as string[])].map(u => ({ id: u, label: u }))}
                                value={unit}
                                onChange={setUnit}
                                label={'Unit'}
                            />
                        </div>
                        {row?.segments && inRowUnit != null && (
                            <div className="mt-2">
                                <LevelRail
                                    value={Math.max(inRowUnit, row.domain?.[0] ?? 0.001)}
                                    band={row.segments.common ? { low: row.segments.common[0], high: row.segments.common[1] } : { low: inRowUnit, high: inRowUnit }}
                                    domain={[Math.max(row.domain?.[0] ?? (row.segments.light?.[0] ?? 1) / 2, 1e-6), row.domain?.[1] ?? (row.segments.heavy?.[0] ?? row.segments.common?.[1] ?? inRowUnit * 2) * 1.6]}
                                    label={band ? BAND_NAMES[band] : undefined}
                                    tone={band ? BAND_TONE[band] : ''}
                                />
                            </div>
                        )}
                        {perKgLine && <p className="mt-2 text-xs tabular-nums text-[var(--text-muted)]">{perKgLine}</p>}
                        {row && isPerKg(row.unit) && !weight.kg && (
                            <p className="mt-2 text-xs text-[var(--text-muted)]">{'Its doses are given per kilogram: set your body weight in Settings to see where this amount falls.'}</p>
                        )}
                        {row?.absorbed && (
                            <p className="mt-2 text-xs text-[var(--text-muted)]">
                                {`${absorbedText(row.absorbed).replace(/^./, c => c.toUpperCase())} of a dose taken this way reaches the blood.`}
                            </p>
                        )}
                        <label className="mt-3 flex items-center justify-between gap-3 text-sm text-[var(--text)]">
                            <span>{'It’s a guess'}</span>
                            <Switch checked={estimate} onChange={setEstimate} label={'The amount is a guess'} />
                        </label>
                    </div>

                    {/* When */}
                    <div>
                        <label className={label} htmlFor="dose-time">
                            {'Taken at'}
                        </label>
                        <div className="flex items-end gap-3">
                            <input
                                id="dose-time"
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
                                {'Now'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={label} htmlFor="dose-note">
                            {'Note'}
                        </label>
                        <textarea
                            id="dose-note"
                            rows={2}
                            className={`input-base w-full resize-none ${note ? 'is-inked' : ''}`}
                            placeholder={'Where you got it, how it felt…'}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    {warnings.length > 0 && (
                        <div className="flex flex-col gap-2" role="status">
                            {warnings.map(w => (
                                <p
                                    key={w.key}
                                    className={`flex gap-2 text-sm leading-relaxed ${w.tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`}
                                >
                                    <Alert size={16} className="mt-0.5 shrink-0" />
                                    <span>{w.text}</span>
                                </p>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-3 pt-1">
                <button type="submit" className="btn-primary" disabled={!canSave}>
                    {editing ? 'Save' : 'Log it'}
                </button>
                <button type="button" className="btn-secondary" onClick={onCancel}>
                    {'Cancel'}
                </button>
                {onDelete && (
                    <button type="button" className="ms-auto inline-flex h-9 items-center gap-1 px-3 text-sm font-medium rounded-full text-[var(--danger)] hover:bg-[var(--surface-hover)]" onClick={onDelete}>
                        <Close size={15} />
                        {'Delete'}
                    </button>
                )}
            </div>
        </form>
    );
}
