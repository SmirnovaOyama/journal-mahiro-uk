import type { CSSProperties } from 'react';
import { describe, type IndexEntry } from '../lib/data';
import { ChevronRight } from './icons';
import { Link } from './Link';
import { Molecule } from './Molecule';
import { rowBleed } from './SettingsListItem';

interface Props {
    entry: IndexEntry;
    /** Shown instead of the description, e.g. the alias a search matched. */
    sub?: string;
    active?: boolean;
    onPick?: (e: IndexEntry) => void;
    id?: string;
}

/** One substance as a row, the way Oyama sets a row: its drawing (here the
 *  molecule), its name over what it is, a common dose, and a chevron. A link,
 *  unless the caller picks it into something (the mix). */
export function SubstanceRow({ entry, sub, active, onPick, id }: Props) {
    const band = entry.primaryBand;
    const cls = `w-full min-h-14 flex items-center gap-3 py-2.5 text-start text-[var(--text)] no-underline ${rowBleed} ${active ? 'bg-[var(--surface-hover)]' : ''}`;
    const style = { '--divider-inset': '3.25rem' } as CSSProperties;
    const body = (
        <>
            <Molecule id={entry.id} form={entry.form} />
            <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">{entry.name}</span>
                <span className="block text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    {sub ?? describe(entry)}
                </span>
            </span>
            {band && (
                <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
                    {fmt(band.low)}–{fmt(band.high)} {band.unit}
                </span>
            )}
            <ChevronRight size={18} className="shrink-0 text-[var(--text-muted)] opacity-70" />
        </>
    );
    if (onPick)
        return (
            <button
                type="button"
                id={id}
                role="option"
                aria-selected={active}
                className={cls}
                style={style}
                onClick={() => onPick(entry)}
            >
                {body}
            </button>
        );
    return (
        <Link id={id} to={{ page: 'substance', id: entry.id }} className={cls} style={style}>
            {body}
        </Link>
    );
}

export function fmt(n: number): string {
    if (n >= 100) return String(Math.round(n));
    if (n >= 10) return String(Math.round(n * 10) / 10);
    return String(Math.round(n * 100) / 100);
}
