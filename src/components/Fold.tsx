import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from './icons';
import { rowBleed } from './SettingsListItem';

/** A fold in the page: a row that opens in place to show more, on Oyama's
 *  `.disclosure`. Nothing floats over anything. */
export function Fold({
    title,
    hint,
    children,
    defaultOpen = false,
}: {
    title: string;
    hint?: string;
    children: ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const id = useId();
    return (
        <div>
            <button
                type="button"
                className={`w-full min-h-14 flex items-center gap-3 py-3 text-start ${rowBleed}`}
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen(o => !o)}
            >
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    {hint && <span className="block text-xs text-[var(--text-muted)] mt-0.5 truncate">{hint}</span>}
                </span>
                <ChevronDown
                    size={20}
                    className={`shrink-0 text-[var(--text-muted)] transition-transform duration-[var(--duration-base)] ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <div className="disclosure" data-open={open} id={id}>
                <div className="disclosure-inner">
                    <div className="pt-1 pb-5">{children}</div>
                </div>
            </div>
        </div>
    );
}
