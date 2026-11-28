import { useEffect } from 'react';
import type { IndexEntry } from '../lib/data';
import { useSaved } from '../lib/store';
import { useOpenedFromLink } from '../lib/router';
import Doodle from '../components/Doodle';
import { Link } from '../components/Link';
import PixelCat from '../components/PixelCat';
import { usePixelCats } from '../contexts/PixelCatContext';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SubstanceRow } from '../components/SubstanceRow';
import { tr } from '../lib/i18n';

/** What's been saved on this device. */
export function Saved({ byId }: { byId: Map<string, IndexEntry> }) {
    const saved = useSaved();
    const { showCats } = usePixelCats();
    const fromLink = useOpenedFromLink();
    useEffect(() => {
        document.title = tr('Saved');
    }, []);
    const list = saved.ids.map(id => byId.get(id)).filter((e): e is IndexEntry => !!e);

    return (
        <>
            <PageHeader
                title={tr('Saved')}
                backTo={fromLink}
                subtitle={list.length ? (list.length === 1 ? tr('1 substance') : tr('{0} substances', { 0: list.length })) : undefined}
            />
            <div className={`${PAGE_COLUMN} pb-8`}>
                {list.length === 0 ? (
                    // hrt.mahiro.uk's empty page: a drawing (or a cat, when the
                    // cats are on), a bold line, a quiet one, and the one action.
                    <div className="flex flex-col items-center text-center pt-20 pb-8">
                        {showCats ? <PixelCat pose="loaf" size={96} /> : <Doodle name="heart" size={4} />}
                        <p className="mt-5 text-sm font-semibold">{tr('No saved substances yet')}</p>
                        <p className="mt-1 text-sm text-[var(--text-muted)] max-w-xs">
                            {tr('Tap the bookmark on any substance to keep it here.')}
                        </p>
                        <Link to={{ page: 'home' }} move="none" className="btn-primary mt-6 no-underline">
                            {tr('Search substances')}
                        </Link>
                    </div>
                ) : (
                    <div className="settings-section">
                        {list.map(e => (
                            <SubstanceRow key={e.id} entry={e} />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
