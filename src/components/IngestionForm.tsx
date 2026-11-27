import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCombos, loadDetail, search, type ComboMatrix, type Detail, type DoseRow, type IndexEntry, convertAmount, fmtAmount, isPerKg, nameOf } from '../lib/data';
import { useJournal, type Ingestion, type Prefill } from '../lib/journal';
import { RANK, VERDICT, checkPair, type PairResult } from '../lib/mix';
import { courseFor, formatMinutes } from '../lib/time';
import { useDetail } from '../lib/useIndex';
import LevelRail from './LevelRail';
import { formatWeight, useWeight } from '../lib/store';
import { absorbedText } from './Absorption';
import { useNavHeldAway } from './BottomNav';
import Choice from './Choice';
import { Molecule } from './Molecule';
import { SearchField } from './SearchField';
import { CareNote } from './CareNote';
import { isCareSearch } from '../lib/care';
import { WaitMark } from './Waiting';
import Switch from './Switch';
import { Alert, Close } from './icons';
import { roaName, tr } from '../lib/i18n';
import { LINGER_DAYS, PARACETAMOL, PARACETAMOL_DAY_MG, PARACETAMOL_SOURCE, lastNightOf, lastTime, lingering, nightTotal, paracetamolMg } from '../lib/advice';
import { medicinesOf, usePerson } from '../lib/person';
import { LastTimeNote, gramsText } from './JournalNotes';
import { Link } from './Link';

/* Logging one dose: what, how, how much, when. Laid out as hrt.mahiro.uk's
   dose form is, labelled lines one under another, and as it's filled in it
   says what the journal already knows: the same thing taken again too soon,
   or something taken in the last day that it mixes badly with. It reads
   further than a day too: a medicine taken every day (lib/person.ts), a
   drug logged days ago that is still at work, a limit set while sober, and
   the last night's own notes (lib/advice.ts). */

const DAY = 24 * 3600_000;

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
    onProduct,
}: {
    index: IndexEntry[] | null;
    byId: Map<string, IndexEntry>;
    initial?: Prefill;
    editing?: Ingestion;
    onSave: (i: Omit<Ingestion, 'id'> & { id?: string }) => void;
    onCancel: () => void;
    onDelete?: () => void;
    /** Opens the form for a product with several ingredients instead. */
    onProduct?: () => void;
}) {
    const { data } = useJournal();
    const start = editing ?? initial;
    // On a phone the form is taller than what's left of the screen, and its
    // last lines, what the journal warns of and Log it, opened under the
    // floating bar. The bar steps aside while the form is open; Close, Cancel
    // or logging the dose brings it back.
    useNavHeldAway();

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
    const name = entry?.name ?? custom.trim();
    const { detail, loading } = useDetail(entry ? entry.id : null);
    // The ways this substance is taken, once its page has arrived: null until
    // then. The general list is only for what has no routes of its own (a
    // name logged as written, or a page that didn't load). Offered while the
    // real ones were still on their way, it showed six chips, shrank to the
    // one or two that apply and pulled the form up under the finger, and its
    // first chip was already chosen: a substance that is only insufflated
    // stayed logged as "Oral".
    const routes = useMemo(() => {
        if (loading) return null;
        const seen: string[] = [];
        for (const r of detail?.doseRows ?? []) if (!seen.includes(r.roa)) seen.push(r.roa);
        for (const r of detail?.durationRows ?? []) if (!seen.includes(r.roa)) seen.push(r.roa);
        return seen.length ? seen : ROUTES.slice(0, 6);
    }, [detail, loading]);
    useEffect(() => {
        if (!routes) return;
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
            ? tr('{0} {1}/kg at {2}', { 0: fmtAmount(dose / weight.kg), 1: unit, 2: formatWeight(weight.kg, weight.unit) })
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
    // And what reaches further back than a day: the medicines taken every
    // day, and whatever was logged in the last weeks that may still be at work.
    const { person } = usePerson();
    const meds = useMemo(() => medicinesOf(person).filter(m => byId.has(m.id)), [person, byId]);
    const older = useMemo(
        () => [...new Set(data.ingestions.filter(i => i.id !== editing?.id && time - i.time > DAY && time - i.time <= LINGER_DAYS * DAY).map(i => i.substance))],
        [data.ingestions, editing?.id, time],
    );
    useEffect(() => {
        for (const id of new Set([...recent.map(i => i.substance), ...older, ...meds.map(m => m.id)]))
            if (byId.get(id) && !others[id])
                loadDetail(id)
                    .then(d => setOthers(p => ({ ...p, [d.id]: d })))
                    .catch(() => {});
    }, [recent, older, meds, byId, others]);
    const still = useMemo(() => lingering(data.ingestions, others, time, editing?.id), [data.ingestions, others, time, editing?.id]);

    // What this dose is logged under: the catalogue's id, or the name as typed.
    const key = substance && byId.get(substance) ? substance : custom.trim();
    const limit = key ? person.limits[key] : undefined;
    const paracetamol = useMemo(() => {
        if (key !== PARACETAMOL) return null;
        const before = paracetamolMg(data.ingestions, time, editing?.id);
        const mine = dose != null && doseOk ? convertAmount(dose, unit || 'mg', 'mg') : null;
        return { mg: before.mg + (mine ?? 0), before: before.mg };
    }, [key, data.ingestions, time, editing?.id, dose, doseOk, unit]);

    const warnings = useMemo(() => {
        const out: { key: string; tone: 'danger' | 'warning'; text: string; link?: { label: string; href: string } }[] = [];
        // The limits set while sober, said back.
        if (key && limit?.max && limit.unit) {
            const night = nightTotal(data.ingestions, key, time, limit.unit, editing?.id);
            const mine = dose != null && doseOk ? convertAmount(dose, unit || limit.unit, limit.unit) : null;
            const total = night.total + (mine ?? 0);
            if (total > limit.max)
                out.push({
                    key: 'limit-max',
                    tone: 'warning',
                    text: tr('You set {0} {1} of {2} as the most for one night. With this dose it comes to {3} {1}.', { 0: fmtAmount(limit.max), 1: limit.unit, 2: name, 3: fmtAmount(total) }),
                });
        }
        if (key && limit?.gap) {
            const last = lastNightOf(data.ingestions, key, time, editing?.id);
            if (last != null && time - last < limit.gap * DAY)
                out.push({
                    key: 'limit-gap',
                    tone: 'warning',
                    text: tr('You set {0} days between nights of {1}. The last was {2} ago.', { 0: limit.gap, 1: name, 2: formatMinutes(Math.max(1, Math.round((time - last) / 60000))) }),
                });
        }
        if (paracetamol && paracetamol.mg > PARACETAMOL_DAY_MG)
            out.push({
                key: 'paracetamol',
                tone: 'danger',
                text: tr('With this dose, {0} of paracetamol in 24 hours: more than the 4 g an adult should take. Too much can damage the liver: get medical advice now.', { 0: gramsText(paracetamol.mg) }),
                link: { label: PARACETAMOL_SOURCE.name, href: PARACETAMOL_SOURCE.href },
            });
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
                        ? tr('You logged {0}{1} {2} ago, and it usually lasts {3}. A redose adds to what’s still working.', { 0: nameOf(entry), 1: amount, 2: formatMinutes(ago), 3: formatMinutes(c!.course.over) })
                        : tr('You logged {0}{1} {2} ago. How long it lasts taken that way isn’t documented; other ways, up to {3}. A redose may add to what’s still working.', { 0: nameOf(entry), 1: amount, 2: formatMinutes(ago), 3: formatMinutes(c!.course.over) })
                    : tr('You logged {0}{1} {2} ago.', { 0: nameOf(entry), 1: amount, 2: formatMinutes(ago) }),
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
                    text: tr('{0} with {1}, logged in the last day. {2}', { 0: tr(v.label), 1: nameOf(p.b), 2: tr(v.meaning) }),
                });
            });
        // A medicine taken every day counts as taken today. Then what was
        // logged days ago and may still be at work.
        const further: { p: PairResult; ago?: number }[] = [];
        for (const m of meds) {
            const other = byId.get(m.id);
            if (!other || other.id === entry.id || seen.has(other.id)) continue;
            seen.add(other.id);
            further.push({ p: checkPair(entry, other, detail ?? undefined, others[other.id], matrix) });
        }
        for (const i of still) {
            const other = byId.get(i.substance);
            if (!other || other.id === entry.id || seen.has(other.id)) continue;
            seen.add(other.id);
            further.push({ p: checkPair(entry, other, detail ?? undefined, others[other.id], matrix), ago: Math.round((time - i.time) / 60000) });
        }
        further
            .filter(f => RANK[f.p.verdict] >= RANK.Caution)
            .sort((a, b) => RANK[b.p.verdict] - RANK[a.p.verdict])
            .forEach(({ p, ago }) => {
                const v = VERDICT[p.verdict];
                out.push({
                    key: p.b.id,
                    tone: v.tone === 'danger' ? 'danger' : 'warning',
                    text:
                        ago == null
                            ? tr('{0} with {1}, which you take every day. {2}', { 0: tr(v.label), 1: nameOf(p.b), 2: tr(v.meaning) })
                            : tr('{0} with {1}, logged {2} ago and likely still at work. {3}', { 0: tr(v.label), 1: nameOf(p.b), 2: formatMinutes(ago), 3: tr(v.meaning) }),
                });
            });
        return out;
    }, [entry, recent, time, detail, byId, others, matrix, meds, still, key, limit, paracetamol, data.ingestions, editing?.id, dose, doseOk, unit, name]);

    // What was written the last night this was taken, shown before it's taken again.
    const last = useMemo(() => (key && !editing ? lastTime(data, key, time) : null), [key, editing, data, time]);

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
                <span className={label}>{tr('Substance')}</span>
                {name ? (
                    <div className="flex items-center gap-3 min-h-11">
                        {entry && <Molecule id={entry.id} form={entry.form} size="sm" />}
                        <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-[var(--text)]">{name}</span>
                            {!entry && <span className="block text-xs text-[var(--text-muted)]">{tr('Not in the catalogue')}</span>}
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
                                {tr('Change')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div>
                        <SearchField
                            ref={searchRef}
                            value={q}
                            onChange={setQ}
                            label={tr('Find the substance')}
                            placeholder={tr('Name or street name')}
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
                        {!q.trim() && onProduct && (
                            <button type="button" className="link-button mt-3 block text-sm" onClick={onProduct}>
                                {tr('A product with several ingredients')}
                            </button>
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
                                            {nameOf(h.entry)}
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
                                    {tr('Log “{0}” as written', { 0: q.trim() })}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {name && (
                <>
                    {last && <LastTimeNote last={last} />}

                    {/* How */}
                    <div>
                        <span className={label}>{tr('Route')}</span>
                        {/* A row of chips tall from the start, so the lines
                            under it stay where they are when the routes come.
                            Until then: the route already known (an entry being
                            edited), or the wait mark, which keeps quiet for
                            the first 300ms. */}
                        <div className="flex min-h-8 flex-wrap items-center gap-2" aria-busy={!routes}>
                            {routes ? (
                                routes.map(r => (
                                    <button type="button" key={r} className={chip(route === r)} aria-pressed={route === r} onClick={() => setRoute(r)}>
                                        {roaName(r)}
                                    </button>
                                ))
                            ) : route ? (
                                <button type="button" className={chip(true)} aria-pressed>
                                    {roaName(route)}
                                </button>
                            ) : (
                                <WaitMark className="text-[var(--text-muted)]" />
                            )}
                        </div>
                    </div>

                    {/* How much */}
                    <div>
                        <label className={label} htmlFor="dose-amount">
                            {tr('Amount')}
                        </label>
                        {/* The unit's options unfold under the whole line, not under its own 6rem. */}
                        <div className="flex flex-wrap items-end gap-x-3">
                            <input
                                id="dose-amount"
                                className={`input-base min-w-0 flex-1 text-lg tabular-nums ${doseText ? 'is-inked' : ''}`}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder={tr('Leave empty if unknown')}
                                value={doseText}
                                onChange={e => setDoseText(e.target.value)}
                                aria-invalid={!doseOk}
                            />
                            <Choice
                                className="w-24 shrink-0"
                                options={[...new Set([row?.unit, unit, ...UNITS].filter(Boolean) as string[])].map(u => ({ id: u, label: u }))}
                                value={unit}
                                onChange={setUnit}
                                label={tr('Unit')}
                            />
                        </div>
                        {row?.segments && inRowUnit != null && (
                            <div className="mt-2">
                                <LevelRail
                                    value={Math.max(inRowUnit, row.domain?.[0] ?? 0.001)}
                                    band={row.segments.common ? { low: row.segments.common[0], high: row.segments.common[1] } : { low: inRowUnit, high: inRowUnit }}
                                    domain={[Math.max(row.domain?.[0] ?? (row.segments.light?.[0] ?? 1) / 2, 1e-6), row.domain?.[1] ?? (row.segments.heavy?.[0] ?? row.segments.common?.[1] ?? inRowUnit * 2) * 1.6]}
                                    label={band ? tr(BAND_NAMES[band]) : undefined}
                                    tone={band ? BAND_TONE[band] : ''}
                                />
                            </div>
                        )}
                        {perKgLine && <p className="mt-2 text-xs tabular-nums text-[var(--text-muted)]">{perKgLine}</p>}
                        {row && isPerKg(row.unit) && !weight.kg && (
                            <p className="mt-2 text-xs text-[var(--text-muted)]">{tr('Its doses are given per kilogram: set your body weight in Settings to see where this amount falls.')}</p>
                        )}
                        {paracetamol && paracetamol.mg > 0 && paracetamol.mg <= PARACETAMOL_DAY_MG && (
                            <p className="mt-2 text-xs tabular-nums text-[var(--text-muted)]">
                                {tr('With this dose, {0} of paracetamol in 24 hours. The limit for an adult is 4 g.', { 0: gramsText(paracetamol.mg) })}
                            </p>
                        )}
                        {row?.absorbed && (
                            <p className="mt-2 text-xs text-[var(--text-muted)]">
                                {tr('{0} of a dose taken this way reaches the blood.', { 0: absorbedText(row.absorbed).replace(/^./, c => c.toUpperCase()) })}
                            </p>
                        )}
                        <label className="mt-3 flex items-center justify-between gap-3 text-sm text-[var(--text)]">
                            <span>{tr('It’s a guess')}</span>
                            <Switch checked={estimate} onChange={setEstimate} label={tr('The amount is a guess')} />
                        </label>
                    </div>

                    {/* When */}
                    <div>
                        <label className={label} htmlFor="dose-time">
                            {tr('Taken at')}
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
                                {tr('Now')}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={label} htmlFor="dose-note">
                            {tr('Note')}
                        </label>
                        <textarea
                            id="dose-note"
                            rows={2}
                            className={`input-base w-full resize-none ${note ? 'is-inked' : ''}`}
                            placeholder={tr('Where you got it, how it felt…')}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    {key && !editing && !limit?.max && !limit?.gap && (
                        <p className="-mt-2 text-xs text-[var(--text-muted)]">
                            <Link to={{ page: 'journal', substance: key }} className="underline underline-offset-[3px]">
                                {tr('Set a limit for {0}', { 0: name })}
                            </Link>
                        </p>
                    )}

                    {warnings.length > 0 && (
                        <div className="flex flex-col gap-2" role="status">
                            {warnings.map(w => (
                                <p
                                    key={w.key}
                                    className={`flex gap-2 text-sm leading-relaxed ${w.tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`}
                                >
                                    <Alert size={16} className="mt-0.5 shrink-0" />
                                    <span>
                                        {w.text}
                                        {w.link && (
                                            <>
                                                {' '}
                                                <a href={w.link.href} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-[3px]">
                                                    {w.link.label}
                                                </a>
                                            </>
                                        )}
                                    </span>
                                </p>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="flex items-center gap-3 pt-1">
                <button type="submit" className="btn-primary" disabled={!canSave}>
                    {editing ? tr('Save') : tr('Log it')}
                </button>
                <button type="button" className="btn-secondary" onClick={onCancel}>
                    {tr('Cancel')}
                </button>
                {onDelete && (
                    <button type="button" className="ms-auto inline-flex h-9 items-center gap-1 px-3 text-sm font-medium rounded-full text-[var(--danger)] hover:bg-[var(--surface-hover)]" onClick={onDelete}>
                        <Close size={15} />
                        {tr('Delete')}
                    </button>
                )}
            </div>
        </form>
    );
}
