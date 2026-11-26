import { useEffect, useMemo } from 'react';
import { CATEGORIES, type IndexEntry } from '../lib/data';
import { Link } from '../components/Link';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { rowBleed } from '../components/SettingsListItem';
import { ChevronRight } from '../components/icons';
import { tr } from '../lib/i18n';

/** The kinds as rows: what each does, and how many there are. */
export function KindList({ index }: { index: IndexEntry[] | null }) {
    const counts = useMemo(() => {
        const m = new Map<string, number>();
        index?.forEach(e => m.set(e.category, (m.get(e.category) ?? 0) + 1));
        return m;
    }, [index]);
    return (
        <div className="settings-section">
            {CATEGORIES.filter(c => counts.get(c.id)).map(c => (
                <Link
                    key={c.id}
                    to={{ page: 'kind', category: c.id }}
                    className={`w-full min-h-14 flex items-center gap-3 py-3 text-start text-[var(--text)] no-underline ${rowBleed}`}
                >
                    <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium">{tr(c.plural)}</span>
                        <span className="block text-xs text-[var(--text-muted)] mt-0.5">{tr(c.blurb)}</span>
                    </span>
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">{counts.get(c.id)}</span>
                    <ChevronRight size={18} className="shrink-0 text-[var(--text-muted)] opacity-70" />
                </Link>
            ))}
        </div>
    );
}

/** Every kind of substance, with what it does and how many there are. */
export function Browse({ index }: { index: IndexEntry[] | null }) {
    useEffect(() => {
        document.title = tr('Browse');
    }, []);
    const kinds = useMemo(() => new Set(index?.map(e => e.category)).size, [index]);
    return (
        <>
            <PageHeader title={tr('Browse')} subtitle={index ? tr('{0} kinds', { 0: kinds }) : undefined} backTo />
            <div className={`${PAGE_COLUMN} pb-8`}>
                <KindList index={index} />
            </div>
        </>
    );
}
