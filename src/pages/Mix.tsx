import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCombos, loadDetail, search, type ComboMatrix, type Detail, type IndexEntry } from '../lib/data';
import { RANK, VERDICT, checkPair, worst, type PairResult } from '../lib/mix';
import { go } from '../lib/router';
import { Link } from '../components/Link';
import { Molecule } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SearchField, listKeys } from '../components/SearchField';
import { rowBleed } from '../components/SettingsListItem';
import { SubstanceRow } from '../components/SubstanceRow';
import { ChevronRight, Clover, Close } from '../components/icons';

const EXAMPLES: [string, string][] = [
    ['alcohol', 'ketamine'],
    ['mdma', 'lsd'],
    ['alprazolam', 'oxycodone'],
    ['cocaine', 'alcohol'],
    ['cannabis', 'mdma'],
];

/** The mix checker: put substances on the table, read one answer. */
export function Mix({ ids, index, byId }: { ids: string[]; index: IndexEntry[] | null; byId: Map<string, IndexEntry> }) {
    const chosen = useMemo(() => ids.map(id => byId.get(id)).filter((e): e is IndexEntry => !!e), [ids, byId]);
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const [details, setDetails] = useState<Record<string, Detail>>({});
    const [matrix, setMatrix] = useState<ComboMatrix>();

    useEffect(() => {
        document.title = 'Mix';
    }, []);
    useEffect(() => {
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);

    useEffect(() => {
        for (const e of chosen)
            if (!details[e.id])
                loadDetail(e.id)
                    .then(d => setDetails(prev => ({ ...prev, [d.id]: d })))
                    .catch(() => {});
    }, [chosen, details]);

    const hits = useMemo(
        () => (index ? search(index, q, 30).filter(h => !ids.includes(h.entry.id)).slice(0, 6) : []),
        [index, q, ids],
    );
    useEffect(() => setActive(0), [q]);

    const setIds = (next: string[]) => go({ page: 'mix', ids: next }, { replace: true });
    const add = (e: IndexEntry) => {
        setIds([...ids, e.id]);
        setQ('');
        input.current?.focus();
    };
    const remove = (id: string) => setIds(ids.filter(x => x !== id));

    const pairs: PairResult[] = useMemo(() => {
        const out: PairResult[] = [];
        for (let i = 0; i < chosen.length; i++)
            for (let j = i + 1; j < chosen.length; j++)
                out.push(checkPair(chosen[i], chosen[j], details[chosen[i].id], details[chosen[j].id], matrix));
        return out.sort((a, b) => RANK[b.verdict] - RANK[a.verdict]);
    }, [chosen, details, matrix]);
    const ready = chosen.every(e => details[e.id]) && matrix;
    const top = worst(pairs);

    const sourceWords = (s?: string) =>
        s === 'PsychonautWiki'
            ? 'Documented by PsychonautWiki'
            : s === 'TripSit'
              ? 'Documented by TripSit'
              : s === 'Guess'
                ? 'Not documented for this exact pair. A cautious guess from what kind of drug each one is'
                : 'No source covers this pair';

    return (
        <>
            <PageHeader title={'Mix'} subtitle={'Is it safe to take these together?'} />
            <div className={`${PAGE_COLUMN} pb-8`}>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                    {'Add everything you plan to take, including alcohol and any medication.'}
                </p>

                {chosen.length > 0 && (
                    <ul className="flex flex-wrap gap-2 mb-4" aria-label={'On the table'}>
                        {chosen.map(e => (
                            <li
                                key={e.id}
                                className="m-appear inline-flex items-center gap-1.5 h-11 ps-2.5 pe-1 rounded-full bg-[var(--surface-muted)]"
                            >
                                <Molecule id={e.id} form={e.form} size="xs" />
                                <Link
                                    to={{ page: 'substance', id: e.id }}
                                    className="text-sm font-medium text-[var(--text)] no-underline"
                                >
                                    {e.name}
                                </Link>
                                <button
                                    type="button"
                                    className="btn-ghost !size-8 !p-0"
                                    aria-label={`Take ${e.name} off`}
                                    onClick={() => remove(e.id)}
                                >
                                    <Close size={18} />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <SearchField
                    ref={input}
                    value={q}
                    onChange={setQ}
                    label={'Add a substance'}
                    placeholder={chosen.length ? 'Add another' : 'Add the first substance'}
                    listId="mix-results"
                    activeId={hits[active] ? `mix-${hits[active].entry.id}` : undefined}
                    onKeyDown={e => listKeys(e, hits.length, active, setActive, n => hits[n] && add(hits[n].entry))}
                    autoFocus={chosen.length < 2 && !('ontouchstart' in window)}
                />
                {q.trim() && (
                    <div className="settings-section mt-1 m-appear" id="mix-results" role="listbox">
                        {hits.length ? (
                            hits.map((h, i) => (
                                <SubstanceRow
                                    key={h.entry.id}
                                    id={`mix-${h.entry.id}`}
                                    entry={h.entry}
                                    sub={h.via ? `Also called ${h.via}` : undefined}
                                    active={i === active}
                                    onPick={add}
                                />
                            ))
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] py-3">
                                {`Nothing called “${q.trim()}”.`}
                            </p>
                        )}
                    </div>
                )}

                {chosen.length === 0 && (
                    <section className="mt-8">
                        <h2 className="group-heading mb-1">{'Or try one of these'}</h2>
                        <div className="settings-section">
                            {EXAMPLES.filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b]) => (
                                <Link
                                    key={a + b}
                                    to={{ page: 'mix', ids: [a, b] }}
                                    move="none"
                                    className={`w-full min-h-12 flex items-center gap-3 py-3 text-sm text-[var(--text)] no-underline ${rowBleed}`}
                                >
                                    <span className="flex-1">
                                        {byId.get(a)!.name} {'and'} {byId.get(b)!.name}
                                    </span>
                                    <ChevronRight size={18} className="text-[var(--text-muted)] opacity-70" />
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {chosen.length === 1 && (
                    <p className="text-sm text-[var(--text-muted)] mt-5">
                        {'Add one more to see how they mix.'}
                    </p>
                )}

                {chosen.length >= 2 && !ready && (
                    <p className="text-sm text-[var(--text-muted)] mt-8">{'Checking…'}</p>
                )}

                {chosen.length >= 2 && ready && top && (
                    <section className="verdict m-appear" aria-live="polite">
                        <p className="group-heading">
                            {pairs.length === 1
                                ? 'Together'
                                : `The most serious of ${pairs.length} pairs`}
                        </p>
                        {VERDICT[top.verdict].tone === 'positive' && (
                            <Clover
                                key={top.verdict}
                                size={72}
                                strokeWidth={1.1}
                                className="verdict-clover ink-draw tone-positive"
                            />
                        )}
                        <p className={`verdict-word tone-${VERDICT[top.verdict].tone}`}>
                            {VERDICT[top.verdict].label}
                        </p>
                        <p className="verdict-says">
                            {VERDICT[top.verdict].meaning}
                        </p>

                        <div className="settings-section mt-7">
                            {pairs.map(p => {
                                const v = VERDICT[p.verdict];
                                const note = p.note;
                                return (
                                    <div className="py-3.5" key={p.a.id + p.b.id}>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-medium">
                                                {p.a.name} {'with'} {p.b.name}
                                            </span>
                                            <span
                                                className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold tone-${v.tone}`}
                                            >
                                                {v.tone === 'positive' && <Clover size={18} />}
                                                {v.label}
                                            </span>
                                        </div>
                                        {note && <p className="text-sm mt-1">{note}</p>}
                                        {pairs.length > 1 && !note && (
                                            <p className="text-sm mt-1">{v.meaning}</p>
                                        )}
                                        <p className="text-xs text-[var(--text-muted)] mt-1">{sourceWords(p.source)}</p>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="footnote">
                            {'Mixing advice from TripSit and PsychonautWiki. Information, not medical advice. If someone is unresponsive or breathing slowly, call emergency services.'}
                        </p>
                    </section>
                )}
            </div>
        </>
    );
}
