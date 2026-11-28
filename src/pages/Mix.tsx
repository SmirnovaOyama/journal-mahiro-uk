import { useEffect, useMemo, useRef, useState } from 'react';
import { loadCombos, loadDetail, search, type ComboMatrix, type Detail, type IndexEntry, nameOf } from '../lib/data';
import { RANK, VERDICT, checkPair, worst, type PairResult } from '../lib/mix';
import { go, useOpenedFromLink } from '../lib/router';
import { Link } from '../components/Link';
import { Molecule } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SearchField, listKeys } from '../components/SearchField';
import { CareNote } from '../components/CareNote';
import { isCareSearch } from '../lib/care';
import { rowBleed } from '../components/SettingsListItem';
import { SubstanceRow } from '../components/SubstanceRow';
import { ChevronRight, Clover, Close, Plus } from '../components/icons';
import { Linked } from '../components/Linked';
import { dataText, phraseList, tr } from '../lib/i18n';
import { sessionsOf, useJournal } from '../lib/journal';
import { courseFor } from '../lib/time';
import { medicinesOf, usePerson } from '../lib/person';
import { useFeature } from '../lib/features';

const EXAMPLES: [string, string][] = [
    ['alcohol', 'ketamine'],
    ['mdma', 'lsd'],
    ['alprazolam', 'oxycodone'],
    ['cocaine', 'alcohol'],
    ['cannabis', 'mdma'],
];

const TONE_TEXT: Record<string, string> = {
    danger: 'text-[var(--danger)]',
    warning: 'text-[var(--warning)]',
    info: 'text-[var(--status-info)]',
    positive: 'text-[var(--text-muted)]',
    neutral: 'text-[var(--text-muted)]',
};

/** What the journal says is still working: the latest session's substances
 *  whose effects aren't over yet (six hours, when how long isn't known). */
function useStillActive(byId: Map<string, IndexEntry>, details: Record<string, Detail>) {
    const { data } = useJournal();
    const now = Date.now();
    const latest = sessionsOf(data.ingestions)[0];
    const ids = new Set<string>();
    for (const i of latest?.ingestions ?? []) {
        if (!byId.has(i.substance)) continue;
        const c = courseFor(details[i.substance]?.durationRows, i.route);
        if (now < i.time + (c ? c.course.over : 360) * 60_000) ids.add(i.substance);
    }
    return { ids: [...ids], candidates: [...new Set((latest?.ingestions ?? []).map(i => i.substance).filter(x => byId.has(x)))] };
}

/** A pair's answer, and what it was read without (see `pairs` below).
 *  `daily`: its second substance is a medicine taken every day, not one
 *  put on the table. */
type Checked = PairResult & { without?: IndexEntry[]; unchecked?: boolean; daily?: boolean };

/** The mix checker: put substances on the table, read one answer. */
export function Mix({ ids, index, byId }: { ids: string[]; index: IndexEntry[] | null; byId: Map<string, IndexEntry> }) {
    const chosen = useMemo(() => ids.map(id => byId.get(id)).filter((e): e is IndexEntry => !!e), [ids, byId]);
    // Opened from a substance's warnings or a session: the way back to it.
    const fromLink = useOpenedFromLink();
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const [details, setDetails] = useState<Record<string, Detail>>({});
    const [matrix, setMatrix] = useState<ComboMatrix>();
    // The ones whose own page couldn't be read: no connection, and not kept
    // on this device (lib/offline.ts). Asked for again once there is one.
    const [unread, setUnread] = useState<ReadonlySet<string>>(new Set());
    const [tries, setTries] = useState(0);
    useEffect(() => {
        const again = () => {
            setUnread(new Set());
            setTries(t => t + 1);
        };
        window.addEventListener('online', again);
        return () => window.removeEventListener('online', again);
    }, []);

    useEffect(() => {
        document.title = tr('Mix');
    }, []);
    useEffect(() => {
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);

    // The medicines taken every day (pages/Medicines.tsx) are on the table
    // without being put there: each is checked against everything chosen.
    const { person } = usePerson();
    const medicinesOn = useFeature('medicines');
    const daily = useMemo(
        () =>
            !medicinesOn
                ? []
                : medicinesOf(person)
                      .map(m => byId.get(m.id))
                      .filter((e): e is IndexEntry => !!e && !ids.includes(e.id)),
        [person, byId, ids, medicinesOn],
    );

    // What's still working from the journal, offered at the top to add.
    const working = useStillActive(byId, details);
    const activeOff = working.ids.filter(id => !ids.includes(id)).map(id => byId.get(id)!);
    // With nothing chosen, the common checks show their answer, so their
    // substances are read too.
    const exampleIds = chosen.length ? [] : EXAMPLES.flat();
    const wantedKey = [...new Set([...chosen.map(e => e.id), ...daily.map(e => e.id), ...working.candidates, ...exampleIds])].filter(id => byId.has(id)).join();
    const wanted = useMemo(() => wantedKey.split(',').filter(Boolean), [wantedKey]);
    useEffect(() => {
        for (const id of wanted)
            if (!details[id])
                loadDetail(id)
                    .then(d => setDetails(prev => ({ ...prev, [d.id]: d })))
                    .catch(() => setUnread(prev => (prev.has(id) ? prev : new Set(prev).add(id))));
    }, [wanted, details, tries]);

    const hits = useMemo(
        () => (index ? search(index, q, 30).filter(h => !h.entry.learn && !ids.includes(h.entry.id)).slice(0, 6) : []),
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

    /* A pair read without one of its substances' own pages has only the
       TripSit table and a guess to go on. More to read can only make an
       answer more serious, so a warning found that way stands. Anything
       milder can't be trusted, and is shown as not checked. */
    const pairs: Checked[] = useMemo(() => {
        const out: Checked[] = [];
        const check = (a: IndexEntry, b: IndexEntry, isDaily: boolean) => {
            const r = checkPair(a, b, details[a.id], details[b.id], matrix);
            const without = [a, b].filter(e => !details[e.id]);
            const more = isDaily ? { daily: true } : {};
            if (!without.length) out.push({ ...r, ...more });
            else if (RANK[r.verdict] >= RANK.Caution) out.push({ ...r, without, ...more });
            else out.push({ a: r.a, b: r.b, verdict: 'Unknown', without, unchecked: true, ...more });
        };
        for (let i = 0; i < chosen.length; i++) {
            for (let j = i + 1; j < chosen.length; j++) check(chosen[i], chosen[j], false);
            for (const m of daily) check(chosen[i], m, true);
        }
        return out.sort((a, b) => RANK[b.verdict] - RANK[a.verdict]);
    }, [chosen, daily, details, matrix]);
    const ready = [...chosen, ...daily].every(e => details[e.id] || unread.has(e.id)) && matrix;
    /** Enough on the table for an answer: two chosen, or one and a daily medicine. */
    const enough = chosen.length >= 2 || (chosen.length === 1 && daily.length > 0);
    const top: Checked | undefined = worst(pairs);
    const namesOf = (es: IndexEntry[]) => phraseList(es.map(e => nameOf(e)));

    const sourceWords = (s?: string) =>
        s === 'PsychonautWiki'
            ? tr('Documented by PsychonautWiki')
            : s === 'TripSit'
              ? tr('Documented by TripSit')
              : s === 'Wikidata'
                ? tr('Listed as a drug interaction on Wikidata')
                : s === 'Guess'
                  ? tr('No data on this exact combination. This is a cautious estimate based on each drug’s class')
                  : tr('No source covers this pair');

    return (
        <>
            <PageHeader title={tr('Mix')} backTo={fromLink} />
            <div className={`${PAGE_COLUMN} pb-8`}>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                    {tr('What are the risks of taking these together? Add everything you plan to take, including alcohol and any medication.')}
                </p>

                {daily.length > 0 ? (
                    <section className="mb-4" aria-label={tr('Taken every day')}>
                        <h2 className="group-heading mb-2">{tr('Taken every day')}</h2>
                        <ul className="flex flex-wrap items-center gap-2">
                            {daily.map(e => (
                                <li key={e.id} className="inline-flex items-center gap-1.5 h-9 ps-2.5 pe-3.5 rounded-full border-(length:--hairline) border-[var(--border-strong)]">
                                    <Molecule id={e.id} form={e.form} size="xs" />
                                    <Link to={{ page: 'substance', id: e.id }} className="text-sm font-medium text-[var(--text)] no-underline">
                                        {nameOf(e)}
                                    </Link>
                                </li>
                            ))}
                            <li>
                                <Link to={{ page: 'settings', sub: 'medicines' }} className="text-xs text-[var(--text-muted)] underline underline-offset-[3px]">
                                    {tr('Change')}
                                </Link>
                            </li>
                        </ul>
                    </section>
                ) : !medicinesOn ? null : (
                    <p className="-mt-2 mb-4 text-xs text-[var(--text-muted)]">
                        <Link to={{ page: 'settings', sub: 'medicines' }} className="underline underline-offset-[3px]">
                            {tr('Add the medicines you take every day')}
                        </Link>
                        {tr(', and every check will include them.')}
                    </p>
                )}

                {activeOff.length > 0 && (
                    <section className="mb-4" aria-label={tr('Still active, from your journal')}>
                        <h2 className="group-heading mb-2">{tr('Still active, from your journal')}</h2>
                        <ul className="flex flex-wrap gap-2">
                            {activeOff.map(e => (
                                <li key={e.id}>
                                    <button
                                        type="button"
                                        onClick={() => add(e)}
                                        className="inline-flex items-center gap-1.5 h-11 ps-3 pe-3.5 rounded-full border-(length:--hairline) border-[var(--border-strong)] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-hover)]"
                                    >
                                        <Plus size={16} />
                                        {nameOf(e)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {chosen.length > 0 && (
                    <ul className="flex flex-wrap gap-2 mb-4" aria-label={tr('Added')}>
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
                                    {nameOf(e)}
                                </Link>
                                <button
                                    type="button"
                                    className="btn-ghost !size-8 !p-0"
                                    aria-label={tr('Remove {0}', { 0: nameOf(e) })}
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
                    label={tr('Add a substance')}
                    placeholder={chosen.length ? tr('Add another') : tr('Add the first substance')}
                    listId="mix-results"
                    activeId={hits[active] ? `mix-${hits[active].entry.id}` : undefined}
                    onKeyDown={e => listKeys(e, hits.length, active, setActive, n => hits[n] && add(hits[n].entry))}
                    autoFocus={chosen.length < 2 && !('ontouchstart' in window)}
                />
                {isCareSearch(q) && <CareNote q={q} />}
                {q.trim() && (hits.length > 0 || !isCareSearch(q)) && (
                    <div className="settings-section mt-1 m-appear" id="mix-results" role="listbox">
                        {hits.length ? (
                            hits.map((h, i) => (
                                <SubstanceRow
                                    key={h.entry.id}
                                    id={`mix-${h.entry.id}`}
                                    entry={h.entry}
                                    sub={h.via ? tr('Also called {0}', { 0: h.via }) : undefined}
                                    active={i === active}
                                    onPick={add}
                                />
                            ))
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] py-3">
                                {tr('No results for “{0}”.', { 0: q.trim() })}
                            </p>
                        )}
                    </div>
                )}

                {chosen.length === 0 && (
                    <section className="mt-8">
                        <h2 className="group-heading mb-1">{tr('Common checks')}</h2>
                        <div className="settings-section">
                            {EXAMPLES.filter(([a, b]) => byId.has(a) && byId.has(b)).map(([a, b]) => {
                                // Its answer in words on the right, so a deadly pair
                                // doesn't look like the others; none until it's read.
                                const A = byId.get(a)!;
                                const B = byId.get(b)!;
                                const known = details[a] && details[b] && matrix;
                                const v = known ? VERDICT[checkPair(A, B, details[a], details[b], matrix).verdict] : null;
                                return (
                                    <Link
                                        key={a + b}
                                        to={{ page: 'mix', ids: [a, b] }}
                                        move="none"
                                        className={`w-full min-h-12 flex items-center gap-3 py-3 text-sm text-[var(--text)] no-underline ${rowBleed}`}
                                    >
                                        <span className="flex-1 min-w-0">
                                            {nameOf(A)} {tr('and')} {nameOf(B)}
                                        </span>
                                        {v && <span className={`shrink-0 text-sm font-medium ${TONE_TEXT[v.tone]}`}>{tr(v.label)}</span>}
                                        <ChevronRight size={18} className="shrink-0 text-[var(--text-muted)] opacity-70" />
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                )}

                {chosen.length === 1 && !enough && (
                    <p className="text-sm text-[var(--text-muted)] mt-5">
                        {tr('Add another substance to check the combination.')}
                    </p>
                )}

                {enough && !ready && (
                    <p className="text-sm text-[var(--text-muted)] mt-8">{tr('Checking…')}</p>
                )}

                {enough && ready && top && (
                    <section className="verdict m-appear" aria-live="polite">
                        <p className="group-heading">
                            {pairs.length === 1
                                ? tr('Together')
                                : tr('The most serious of {0} pairs', { 0: pairs.length })}
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
                            {top.unchecked ? tr('Not checked') : tr(VERDICT[top.verdict].label)}
                        </p>
                        <p className="verdict-says">
                            {top.unchecked
                                ? tr('Checking this needs a connection, because {0} isn’t saved on this device. Don’t assume it’s safe until it’s checked.', { 0: namesOf(top.without!) })
                                : tr(VERDICT[top.verdict].meaning)}
                        </p>

                        <div className="settings-section mt-7">
                            {pairs.map(p => {
                                const v = VERDICT[p.verdict];
                                const note = p.note;
                                return (
                                    <div className="py-3.5" key={p.a.id + p.b.id}>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-medium">
                                                {nameOf(p.a)} {tr('with')} {nameOf(p.b)}
                                            </span>
                                            <span
                                                className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold tone-${v.tone}`}
                                            >
                                                {v.tone === 'positive' && <Clover size={18} />}
                                                {p.unchecked ? tr('Not checked') : tr(v.label)}
                                            </span>
                                        </div>
                                        {p.daily && <p className="text-xs text-[var(--text-muted)] mt-0.5">{tr('You take {0} every day.', { 0: nameOf(p.b) })}</p>}
                                        {note && <p className="text-sm mt-1"><Linked text={dataText(note)} /></p>}
                                        {pairs.length > 1 && !note && !p.unchecked && (
                                            <p className="text-sm mt-1">{tr(v.meaning)}</p>
                                        )}
                                        {!p.unchecked && p.source === 'AI' && (
                                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                                <span className="ai-tag">AI</span>
                                                {tr('No source covers this pair, so AI worked this out from what each one does in the body. It may be wrong: ask a pharmacist before relying on it.')}
                                            </p>
                                        )}
                                        {!p.unchecked && p.source !== 'AI' && <p className="text-xs text-[var(--text-muted)] mt-1">{sourceWords(p.source)}</p>}
                                        {p.without && (
                                            <p className="text-xs text-[var(--text-muted)] mt-1">
                                                {p.unchecked
                                                    ? tr('{0} isn’t saved on this device, so checking this combination needs a connection.', { 0: namesOf(p.without) })
                                                    : tr('Checked offline without the page for {0}, so this may be incomplete.', { 0: namesOf(p.without) })}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <p className="footnote">
                            {tr('Mixing advice from TripSit and PsychonautWiki. Information, not medical advice. If someone is unresponsive or breathing slowly, call emergency services.')}{' '}
                            <Link to={{ page: 'emergency' }}>{tr('What to do until help comes')}</Link>
                        </p>
                    </section>
                )}
            </div>
        </>
    );
}
