import React from 'react';
import { rowBleed } from './SettingsListItem';
import { ChevronRight } from './icons';

/* The tile Settings opens its groups with (General, Data, About): the icon in
   a square, the name, a line under it, and the chevron. Account and
   Admin are made of the same tiles, so the three read as one place. */

const muted = 'text-[var(--text-muted)]';

export function SettingsTile({
    Icon,
    label,
    hint,
    hintTone,
    onClick,
    danger,
    chevron = true,
    expanded,
}: {
    Icon: React.ElementType;
    label: string;
    hint?: React.ReactNode;
    /** The hint's colour when it has news (a sync that failed). */
    hintTone?: string;
    onClick: () => void;
    /** Deletes something for good: the icon and name in red. */
    danger?: boolean;
    chevron?: boolean;
    /** For a tile that opens a line under itself rather than a page. */
    expanded?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-expanded={expanded}
            style={{ '--divider-inset': '3rem' } as React.CSSProperties}
            className={`w-full min-h-14 flex items-center justify-between gap-4 py-3.5 text-start ${rowBleed}`}
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center bg-[var(--surface-muted)]">
                    <Icon size={20} strokeWidth={1.75} className={danger ? 'text-[var(--danger)]' : muted} />
                </div>
                <div className="min-w-0 text-start">
                    <p className={`text-sm font-medium ${danger ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>{label}</p>
                    {hint && <p className={`text-xs mt-0.5 truncate ${hintTone ?? muted}`}>{hint}</p>}
                </div>
            </div>
            {chevron && <ChevronRight size={18} className={`${muted} shrink-0 opacity-70 rtl:-scale-x-100`} />}
        </button>
    );
}
