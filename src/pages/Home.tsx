import { useEffect, useMemo, useRef, useState } from 'react';
import { search, type IndexEntry, nameOf } from '../lib/data';
import { go, useOpenedFromLink } from '../lib/router';
import { isHrtSearch } from '../lib/eggs';
import { HrtEgg } from '../components/HrtEgg';
import { isCareSearch } from '../lib/care';
import { CareNote } from '../components/CareNote';
import { N55Egg, isN55Search } from '../components/N55Egg';
import { xunxunEntry } from '../lib/xunxun';
import { useRecent } from '../lib/store';
import { Link } from '../components/Link';
import PixelCat from '../components/PixelCat';
import PageHeader, { PAGE_COLUMN, headerAction } from '../components/PageHeader';
import { SearchField, listKeys } from '../components/SearchField';
import { SubstanceRow } from '../components/SubstanceRow';
import { KindList } from './Browse';
import { tr } from '../lib/i18n';

const QUICK = ['alcohol', 'cannabis', 'mdma', 'lsd', 'ketamine', 'cocaine', 'caffeine', 'mushrooms'];

/** Search: a field, and under it what was looked at lately. Typing replaces
 *  that with answers. */
export function Home({ index, byId }: { index: IndexEntry[] | null; byId: Map<string, IndexEntry> }) {
    const fromLink = useOpenedFromLink();
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const [limit, setLimit] = useState(20);
    const input = useRef<HTMLInputElement>(null);
    const recent = useRecent();

    // 寻寻 isn't in the catalogue's files, but it is searched as a substance
    // is: "xu", "寻" or "尋" finds it while the name is still being typed.
    const searched = useMemo(() => (index ? [...index, xunxunEntry()] : null), [index]);
    const hits = useMemo(() => (searched ? search(searched, q, 200) : []), [searched, q]);
    const care = isCareSearch(q);
    const n55 = isN55Search(q);
    useEffect(() => {
        setActive(0);
        setLimit(20);
    }, [q]);

    // "/" or ⌘K puts the cursor in the field from anywhere on the page.
    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
            if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
                e.preventDefault();
                input.current?.focus();
            }
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, []);

    const pick = (n: number) => {
        const h = hits[n];
        if (h) go({ page: 'substance', id: h.entry.id });
    };

    const list = (ids: string[]) => ids.map(id => byId.get(id)).filter((e): e is IndexEntry => !!e);
    const recentList = list(recent.ids).slice(0, 6);
    const quick = list(QUICK);

    return (
        <>
            <PageHeader
                title={tr('Search')}
                backTo={fromLink}
                subtitle={index ? tr('{0} substances', { 0: index.length }) : undefined}
                actions={
                    // The cats sit by the page's title, as they sit by the reading on hrt's Overview.
                    <span className="flex items-end gap-1 pe-2" aria-hidden="true">
                        <PixelCat pose="donut" size={32} />
                        <PixelCat pose="loaf" size={32} />
                    </span>
                }
            />
            <div className={`${PAGE_COLUMN} pt-1 pb-8`}>
                <SearchField
                    ref={input}
                    value={q}
                    onChange={setQ}
                    label={tr('Search substances')}
                    placeholder={tr('Name, street name or family')}
                    listId="home-results"
                    activeId={hits[active] ? `hit-${hits[active].entry.id}` : undefined}
                    onKeyDown={e => listKeys(e, Math.min(hits.length, limit), active, setActive, pick)}
                    autoFocus={!('ontouchstart' in window)}
                />

                {care ? <CareNote q={q} /> : n55 ? <N55Egg /> : isHrtSearch(q) && <HrtEgg q={q} />}
                {q.trim() ? (
                    <section className="m-appear mt-6" aria-live="polite">
                        {hits.length === 0 ? (
                            // After the check-in, "nothing called that" would only be cold.
                            !care && !n55 && <div className="py-8">
                                <p className="text-sm font-semibold">
                                    {tr('Nothing called “{0}”', { 0: q.trim() })}
                                </p>
                                <p className="text-sm text-[var(--text-muted)] mt-1">
                                    {tr('Try another spelling, a street name, or the family it belongs to, like “tryptamine”.')}
                                </p>
                            </div>
                        ) : (
                            <>
                                <h2 className="group-heading mb-1">
                                    {hits.length >= 200
                                        ? tr('200+ matches')
                                        : hits.length === 1 ? tr('One match') : tr('{0} matches', { 0: hits.length })}
                                </h2>
                                <div className="settings-section" id="home-results" role="listbox">
                                    {hits.slice(0, limit).map((h, i) => (
                                        <SubstanceRow
                                            key={h.entry.id}
                                            id={`hit-${h.entry.id}`}
                                            entry={h.entry}
                                            sub={h.via ? tr('Also called {0}', { 0: h.via }) : undefined}
                                            active={i === active}
                                        />
                                    ))}
                                </div>
                                {hits.length > limit && (
                                    <button
                                        type="button"
                                        className="btn-secondary mt-4"
                                        onClick={() => setLimit(l => l + 40)}
                                    >
                                        {tr('Show more')}
                                    </button>
                                )}
                            </>
                        )}
                    </section>
                ) : (
                    <>
                        {recentList.length > 0 ? (
                            <section className="mt-8">
                                <div className="flex items-center justify-between mb-1">
                                    <h2 className="group-heading">{tr('Looked at lately')}</h2>
                                    <button type="button" className={`${headerAction} -me-2.5 text-[var(--text-muted)]`} onClick={recent.clear}>
                                        {tr('Clear')}
                                    </button>
                                </div>
                                <div className="settings-section">
                                    {recentList.map(e => (
                                        <SubstanceRow key={e.id} entry={e} />
                                    ))}
                                </div>
                            </section>
                        ) : (
                            <section className="mt-8">
                                <h2 className="group-heading mb-3">{tr('Often looked up')}</h2>
                                <div className="flex flex-wrap gap-2">
                                    {quick.map(e => (
                                        <Link key={e.id} to={{ page: 'substance', id: e.id }} className="btn-secondary btn-sm no-underline">
                                            {nameOf(e)}
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}
                        {/* Browsing by kind, under the search it narrows. */}
                        <section className="mt-10">
                            <h2 className="group-heading mb-1">{tr('By kind')}</h2>
                            <KindList index={index} />
                        </section>
                    </>
                )}
            </div>
        </>
    );
}
