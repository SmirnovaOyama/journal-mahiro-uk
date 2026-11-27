import { useEffect, useMemo, useState } from 'react';
import { CareNote } from '../components/CareNote';
import { Link } from '../components/Link';
import { Molecule } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SearchField, listKeys } from '../components/SearchField';
import { rowBleed } from '../components/SettingsListItem';
import { SubstanceRow } from '../components/SubstanceRow';
import { ChevronRight, Close } from '../components/icons';
import { useAccount } from '../lib/account';
import { isCareSearch } from '../lib/care';
import { loadCombos, nameOf, search, type ComboMatrix, type IndexEntry } from '../lib/data';
import { tr } from '../lib/i18n';
import { RANK, VERDICT, checkPair, type PairResult } from '../lib/mix';
import { medicinesOf, usePerson } from '../lib/person';
import { useDetails, useIndex } from '../lib/useIndex';

/* The medicines taken every day: an antidepressant, lithium, a hormone.
   Once they're here, every mix check, every substance's page and the dose
   form count them as already taken, without being asked each time. They
   are what a night's worst interaction is most often with, and the thing
   least likely to be thought of on the night. */

const muted = 'text-[var(--text-muted)]';

/** The pairs among `a` and `b` (or within `a`) that are a caution or worse, worst first. */
export function useMedicinePairs(entries: IndexEntry[], against?: IndexEntry) {
    const [matrix, setMatrix] = useState<ComboMatrix>();
    useEffect(() => {
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);
    const ids = useMemo(() => [...entries.map(e => e.id), ...(against ? [against.id] : [])], [entries, against]);
    const details = useDetails(ids);
    return useMemo(() => {
        const out: PairResult[] = [];
        if (against) for (const e of entries) e.id !== against.id && out.push(checkPair(against, e, details[against.id], details[e.id], matrix));
        else
            for (let i = 0; i < entries.length; i++)
                for (let j = i + 1; j < entries.length; j++) out.push(checkPair(entries[i], entries[j], details[entries[i].id], details[entries[j].id], matrix));
        return out.filter(p => RANK[p.verdict] >= RANK.Caution).sort((x, y) => RANK[y.verdict] - RANK[x.verdict]);
    }, [entries, against, details, matrix]);
}

export function MedicinesPage() {
    const { index, byId } = useIndex();
    const { person, setMedicine } = usePerson();
    const { account } = useAccount();
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    useEffect(() => {
        document.title = tr('Medicines I take every day');
    }, []);

    const meds = useMemo(() => medicinesOf(person), [person]);
    const entries = useMemo(() => meds.map(m => byId.get(m.id)).filter((e): e is IndexEntry => !!e), [meds, byId]);
    const pairs = useMedicinePairs(entries);
    const hits = useMemo(() => (index && q.trim() ? search(index, q, 30).filter(h => !meds.some(m => m.id === h.entry.id)).slice(0, 6) : []), [index, q, meds]);
    useEffect(() => setActive(0), [q]);
    const add = (e: IndexEntry) => {
        setMedicine(e.id, e.name, true);
        setQ('');
    };

    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={tr('Medicines I take every day')} />
            <div className={`${PAGE_COLUMN} mt-3 pb-10`}>
                <p className={`text-sm ${muted} mb-4`}>
                    {tr('What you take every day goes here: an antidepressant, lithium, a hormone. The mix checker, each substance’s page and the dose form then count it as already taken.')}
                </p>

                <SearchField
                    value={q}
                    onChange={setQ}
                    label={tr('Add a medicine')}
                    placeholder={tr('Name or brand name')}
                    listId="medicine-results"
                    activeId={hits[active] ? `med-${hits[active].entry.id}` : undefined}
                    onKeyDown={e => listKeys(e, hits.length, active, setActive, n => hits[n] && add(hits[n].entry))}
                />
                {isCareSearch(q) && <CareNote q={q} />}
                {q.trim() && (hits.length > 0 || !isCareSearch(q)) && (
                    <div className="settings-section mt-1 m-appear" id="medicine-results" role="listbox">
                        {hits.length ? (
                            hits.map((h, i) => (
                                <SubstanceRow key={h.entry.id} id={`med-${h.entry.id}`} entry={h.entry} sub={h.via ? tr('Also called {0}', { 0: h.via }) : undefined} active={i === active} onPick={add} />
                            ))
                        ) : (
                            <p className={`text-sm ${muted} py-3`}>{tr('Nothing called “{0}”.', { 0: q.trim() })}</p>
                        )}
                    </div>
                )}

                {meds.length > 0 && (
                    <section className="mt-8">
                        <h2 className="group-heading mb-1">{tr('Every day')}</h2>
                        <div className="settings-section">
                            {meds.map(m => {
                                const e = byId.get(m.id);
                                const name = e ? nameOf(e) : m.name;
                                return (
                                    <div key={m.id} className="flex min-h-14 items-center gap-3 py-2">
                                        {e && <Molecule id={e.id} form={e.form} size="sm" />}
                                        <Link to={{ page: 'substance', id: m.id }} className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text)] no-underline">
                                            {name}
                                        </Link>
                                        <button type="button" className="btn-ghost !size-9 !p-0" aria-label={tr('Take {0} off', { 0: name })} onClick={() => setMedicine(m.id, m.name, false)}>
                                            <Close size={18} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {pairs.length > 0 && (
                    <section className="mt-8">
                        <h2 className="group-heading mb-1">{tr('Together')}</h2>
                        <div className="settings-section">
                            {pairs.map(p => {
                                const v = VERDICT[p.verdict];
                                return (
                                    <Link key={p.a.id + p.b.id} to={{ page: 'mix', ids: [p.a.id, p.b.id] }} className={`w-full min-h-12 flex items-center gap-3 py-2.5 text-start no-underline ${rowBleed}`}>
                                        <span className="min-w-0 flex-1 text-sm text-[var(--text)]">
                                            {nameOf(p.a)} + {nameOf(p.b)}
                                        </span>
                                        <span className={`shrink-0 text-sm font-semibold tone-${v.tone}`}>{tr(v.label)}</span>
                                        <ChevronRight size={16} className={`${muted} shrink-0 opacity-70`} />
                                    </Link>
                                );
                            })}
                        </div>
                        <p className={`mt-2 text-xs ${muted}`}>
                            {tr('What the sources say of these together. Medicines prescribed together are a prescriber’s decision, and this line is no reason to stop one: the prescriber is the one to ask.')}
                        </p>
                    </section>
                )}

                <p className={`mt-8 text-xs ${muted}`}>
                    {account
                        ? tr('Kept in this browser and, encrypted, in your account.')
                        : tr('Kept in this browser only.')}
                </p>
            </div>
        </div>
    );
}

/** On a substance's page: what it does with the medicines taken every
 *  day, where that's a caution or worse. */
export function WithMedicines({ entry, byId }: { entry: IndexEntry; byId: Map<string, IndexEntry> }) {
    const { person } = usePerson();
    const entries = useMemo(
        () =>
            medicinesOf(person)
                .map(m => byId.get(m.id))
                .filter((e): e is IndexEntry => !!e && e.id !== entry.id),
        [person, byId, entry.id],
    );
    const pairs = useMedicinePairs(entries, entry);
    if (!pairs.length) return null;
    return (
        <div className="mt-4 space-y-2">
            {pairs.map(p => {
                const v = VERDICT[p.verdict];
                return (
                    <Link
                        key={p.b.id}
                        to={{ page: 'mix', ids: [entry.id, p.b.id] }}
                        className={`flex items-start gap-2 text-sm leading-relaxed no-underline ${v.tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--warning)]'}`}
                    >
                        <span>
                            {tr('{0} with {1}, which you take every day. {2}', { 0: tr(v.label), 1: nameOf(p.b), 2: tr(v.meaning) })}
                            <ChevronRight size={15} className="inline align-[-2px]" />
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}
