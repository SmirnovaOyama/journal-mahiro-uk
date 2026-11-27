import { useEffect, useMemo, useState } from 'react';
import {
    PARACETAMOL,
    PARACETAMOL_DAY_MG,
    PARACETAMOL_SOURCE,
    STOP_SOURCES,
    paracetamolMg,
    runs,
    type LastTime,
    type StopKind,
} from '../lib/advice';
import { fmtAmount, nameOf, type IndexEntry } from '../lib/data';
import { dateLocale, tr } from '../lib/i18n';
import { useJournal, type Ingestion } from '../lib/journal';
import { kv } from '../lib/kv';
import { usePerson } from '../lib/person';
import Choice from './Choice';
import { Link } from './Link';

/* What the journal says back, in the places it's said: the last night's
   notes in the dose form, paracetamol's running total, a drug logged day
   after day, and the limits set while sober. The reckoning is lib/advice.ts. */

const muted = 'text-[var(--text-muted)]';
const on = 'text-[var(--text)]';

function shortDate(t: number) {
    const d = new Date(t);
    return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

/** A weight of paracetamol as it's read: "650 mg", "2.6 g". */
export const gramsText = (mg: number) => (mg >= 1000 ? `${fmtAmount(mg / 1000)} g` : `${fmtAmount(mg)} mg`);

/* ── last time ──────────────────────────────────────────────────────── */

/** In the dose form, once the substance is chosen: what was written the
 *  last night it was taken. The moment a note is of use is the next time. */
export function LastTimeNote({ last }: { last: LastTime }) {
    const amounts = last.doses.filter(i => i.dose != null);
    const units = new Set(amounts.map(i => i.unit));
    const total = units.size === 1 ? `${fmtAmount(amounts.reduce((a, i) => a + i.dose!, 0))} ${[...units][0]}` : null;
    return (
        <section className="callout space-y-1.5" aria-label={tr('Last time')}>
            <p className={`text-xs font-medium ${muted}`}>
                {[tr('Last time, {0}', { 0: shortDate(last.session.start) }), total, last.rating].filter(Boolean).join(tr(', '))}
            </p>
            {last.note && <p className={`text-sm leading-relaxed whitespace-pre-line ${on}`}>{last.note}</p>}
            {last.doseNotes.map((n, k) => (
                <p key={k} className={`text-sm leading-relaxed ${on}`}>
                    {n}
                </p>
            ))}
            <p>
                <Link to={{ page: 'journal', session: last.session.id }} className={`text-xs ${muted} underline underline-offset-[3px]`}>
                    {tr('Open that night')}
                </Link>
            </p>
        </section>
    );
}

/* ── paracetamol ────────────────────────────────────────────────────── */

/** Under a session with paracetamol in it: how much in the last 24 hours. */
export function ParacetamolLine({ doses, now }: { doses: Ingestion[]; now: number }) {
    const { data } = useJournal();
    if (!doses.some(i => i.substance === PARACETAMOL)) return null;
    const at = Math.min(now, Math.max(...doses.map(i => i.time)) + 24 * 3600_000);
    const { mg, unknown } = paracetamolMg(data.ingestions, at);
    if (!mg && !unknown) return null;
    const over = mg > PARACETAMOL_DAY_MG;
    return (
        <p className={`mt-2 text-sm ${over ? 'text-[var(--danger)]' : on}`}>
            {tr('Paracetamol: {0} in 24 hours.', { 0: gramsText(mg) })}{' '}
            {over ? tr('That is more than the 4 g an adult should take in 24 hours. Too much can damage the liver: get medical advice now.') : tr('The limit for an adult is 4 g.')}{' '}
            {unknown > 0 && tr('A dose with no amount isn’t counted.')}{' '}
            <a href={PARACETAMOL_SOURCE.href} target="_blank" rel="noopener noreferrer" className={`text-xs ${muted} underline underline-offset-[3px]`}>
                {PARACETAMOL_SOURCE.name}
            </a>
        </p>
    );
}

/* ── days in a row ──────────────────────────────────────────────────── */

const SEEN = 'journal.patterns.seen.v1';

const STOP_WORDS: Record<StopKind, string> = {
    gabapentinoid:
        'Stopping it suddenly after taking it every day can cause severe withdrawal symptoms, and seizures. They can be prevented by bringing the dose down gradually, with a doctor.',
    benzodiazepine: 'Stopping it suddenly after taking it every day can cause withdrawal symptoms such as confusion or seizures. A doctor brings the dose down gradually.',
    opioid: 'Stopping it suddenly after taking it every day can cause withdrawal symptoms. A doctor brings the dose down gradually, over weeks or months.',
    'z-drug': 'Stopping it suddenly after taking it every day can cause withdrawal symptoms. A doctor brings the dose down gradually.',
};

/** On the journal's first page: a drug that can't safely be stopped all at
 *  once, logged seven days or more in a row. Said once for each run: "Got
 *  it" puts it away until the run has grown by another week. */
export function PatternNotes({ byId, now }: { byId: Map<string, IndexEntry>; now: number }) {
    const { data } = useJournal();
    const found = useMemo(() => runs(data.ingestions, byId, now), [data.ingestions, byId, now]);
    const [seen, setSeen] = useState<Record<string, number>>(() => {
        try {
            return JSON.parse(kv.get(SEEN) ?? '{}') as Record<string, number>;
        } catch {
            return {};
        }
    });
    // Never put away, grown by a week since it was, or a new run (a shorter one).
    const shown = found.filter(r => {
        const s = seen[r.id];
        return s == null || r.days >= s + 7 || r.days < s;
    });
    if (!shown.length) return null;
    const dismiss = (id: string, days: number) => {
        const next = { ...seen, [id]: days };
        setSeen(next);
        // It names what's taken every day, so it's kept with the journal (lib/kv.ts).
        kv.set(SEEN, JSON.stringify(next));
    };
    return (
        <>
            {shown.map(r => {
                const e = byId.get(r.id)!;
                const src = STOP_SOURCES[r.kind];
                return (
                    <section key={r.id} className="callout mb-8 space-y-2" aria-label={tr('Days in a row')}>
                        <p className={`font-medium ${on}`}>{tr('{0}, {1} days in a row', { 0: nameOf(e), 1: r.days })}</p>
                        <p>{tr(STOP_WORDS[r.kind])}</p>
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <button type="button" className={`link-button !text-[var(--text)]`} onClick={() => dismiss(r.id, r.days)}>
                                {tr('Got it')}
                            </button>
                            <a href={src.href} target="_blank" rel="noopener noreferrer" className={`text-xs ${muted} underline underline-offset-[3px]`} lang="en">
                                {src.name}: {src.title}
                            </a>
                        </p>
                    </section>
                );
            })}
        </>
    );
}

/* ── limits ─────────────────────────────────────────────────────────── */

const LIMIT_UNITS = ['mg', 'μg', 'g', 'mL', 'tabs', 'drinks', 'puffs'];

/** On a substance's page in the journal: the most in one night, and the
 *  days to leave between nights. Set while sober; the dose form says them
 *  back when a dose would cross one. */
export function LimitEditor({ id, unit: usual }: { id: string; unit?: string }) {
    const { person, setLimit } = usePerson();
    const limit = person.limits[id];
    const [max, setMax] = useState(limit?.max != null ? String(limit.max) : '');
    const [unit, setUnit] = useState(limit?.unit ?? usual ?? 'mg');
    const [gap, setGap] = useState(limit?.gap != null ? String(limit.gap) : '');
    // Another device changed them: show theirs.
    useEffect(() => {
        setMax(limit?.max != null ? String(limit.max) : '');
        setGap(limit?.gap != null ? String(limit.gap) : '');
        if (limit?.unit) setUnit(limit.unit);
    }, [limit?.at]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = (nextMax: string, nextUnit: string, nextGap: string) => {
        const m = Number(nextMax.replace(',', '.'));
        const g = Math.round(Number(nextGap));
        const next = {
            ...(nextMax.trim() && Number.isFinite(m) && m > 0 ? { max: m, unit: nextUnit } : {}),
            ...(nextGap.trim() && Number.isFinite(g) && g > 0 ? { gap: g } : {}),
        };
        const same = (limit?.max ?? null) === (next.max ?? null) && (limit?.gap ?? null) === (next.gap ?? null) && (next.max == null || limit?.unit === next.unit);
        if (!same) setLimit(id, next);
    };
    const label = `block text-xs font-medium ${muted} mb-1.5`;
    return (
        <section className="mb-9">
            <h2 className="group-heading mb-1">{tr('Limits')}</h2>
            <p className={`text-xs ${muted} mb-4`}>{tr('Set them while sober. When a dose would cross one, the dose form says so.')}</p>
            <div className="flex flex-col gap-5">
                <div>
                    <label className={label} htmlFor="limit-max">
                        {tr('The most in one night')}
                    </label>
                    <div className="flex flex-wrap items-end gap-x-3">
                        <input
                            id="limit-max"
                            className={`input-base min-w-0 flex-1 tabular-nums ${max ? 'is-inked' : ''}`}
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder={tr('No limit')}
                            value={max}
                            onChange={e => setMax(e.target.value)}
                            onBlur={() => save(max, unit, gap)}
                        />
                        <Choice
                            className="w-24 shrink-0"
                            options={[...new Set([usual, unit, ...LIMIT_UNITS].filter(Boolean) as string[])].map(u => ({ id: u, label: u }))}
                            value={unit}
                            onChange={u => {
                                setUnit(u);
                                save(max, u, gap);
                            }}
                            label={tr('Unit')}
                        />
                    </div>
                </div>
                <div>
                    <label className={label} htmlFor="limit-gap">
                        {tr('Days between nights')}
                    </label>
                    <input
                        id="limit-gap"
                        className={`input-base w-full tabular-nums ${gap ? 'is-inked' : ''}`}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder={tr('No limit')}
                        value={gap}
                        onChange={e => setGap(e.target.value)}
                        onBlur={() => save(max, unit, gap)}
                    />
                </div>
            </div>
            {limit && (limit.max || limit.gap) && <p className={`mt-3 text-xs ${muted}`}>{tr('Set on {0}.', { 0: shortDate(limit.at) })}</p>}
        </section>
    );
}
