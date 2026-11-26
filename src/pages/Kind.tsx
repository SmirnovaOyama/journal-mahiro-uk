import { useEffect, useMemo, useState } from 'react';
import { categoryInfo, type IndexEntry } from '../lib/data';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import Segmented from '../components/Segmented';
import { SubstanceRow } from '../components/SubstanceRow';
import { tr } from '../lib/i18n';

/** Every substance of one kind, A to Z under letter headings, with a row of
 *  letters that sticks under the header to jump through a long list. The
 *  ones with doses come first; the reference entries (from Wikidata, names
 *  and what they are, no doses) join them on asking. */
/** Documented: with doses of its own, or (a reference entry) with FreeODwiki's. */
const isDocumented = (e: IndexEntry) => e.src !== 'wd' || !!e.primaryBand;

export function Kind({ category, index }: { category: string; index: IndexEntry[] | null }) {
    const info = categoryInfo(category);
    const title = tr(info.plural);
    useEffect(() => {
        document.title = title;
    }, [title]);

    const [all, setAll] = useState(false);
    const ofKind = useMemo(() => (index ?? []).filter(e => e.category === info.id), [index, info]);
    const documented = ofKind.filter(isDocumented).length;
    const showAll = all || documented === 0;
    const groups = useMemo(() => {
        const items = ofKind
            .filter(e => showAll || isDocumented(e))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const out: { letter: string; items: IndexEntry[] }[] = [];
        for (const e of items) {
            const c = e.name.charAt(0).toUpperCase();
            const letter = /[A-Z]/.test(c) ? c : '#';
            const last = out[out.length - 1];
            if (last?.letter === letter) last.items.push(e);
            else out.push({ letter, items: [e] });
        }
        return out;
    }, [ofKind, showAll]);
    const total = ofKind.length;

    return (
        <>
            <PageHeader
                title={title}
                subtitle={tr('{0}. {1} in all.', { 0: tr(info.blurb), 1: total })}
                backTo
            />
            <div className={`${PAGE_COLUMN} pb-8`}>
                {documented > 0 && documented < total && (
                    <Segmented
                        className="mb-2"
                        aria-label={tr('Show')}
                        options={[
                            { id: 'dosed', label: tr('With doses ({0})', { 0: documented }) },
                            { id: 'all', label: tr('All ({0})', { 0: total }) },
                        ]}
                        value={all ? 'all' : 'dosed'}
                        onChange={v => setAll(v === 'all')}
                    />
                )}
                {groups.length > 4 && (
                    <nav className="letters" aria-label={tr('Jump to letter')}>
                        {groups.map(g => (
                            <a
                                key={g.letter}
                                href={`#letter-${g.letter}`}
                                onClick={e => {
                                    e.preventDefault();
                                    document
                                        .getElementById(`letter-${g.letter}`)
                                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                            >
                                {g.letter}
                            </a>
                        ))}
                    </nav>
                )}
                {groups.map(g => (
                    <section key={g.letter} id={`letter-${g.letter}`} className="mt-6 scroll-mt-32">
                        <h2 className="group-heading mb-1">{g.letter === '#' ? '0–9' : g.letter}</h2>
                        <div className="settings-section">
                            {g.items.map(e => (
                                <SubstanceRow key={e.id} entry={e} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}
