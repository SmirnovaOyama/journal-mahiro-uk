import { useEffect, useId, useRef, useState } from 'react';
import Tick from './Tick';
import { ChevronDown } from './icons';

export interface ChoiceOption<K extends string> {
    id: K;
    label: string;
}

/**
 * One choice out of a list too long for a Segmented: the dose's unit. Drawn
 * as hrt.mahiro.uk draws its own (.choice-trigger, index.css): a line like a
 * field, what's chosen on it, a chevron at its end. Pressed, the options
 * unfold under it in place as plain rows with a tick by the chosen one.
 * Nothing floats over the page, and none of it is the system's.
 *
 * The line and the list are siblings rather than one box, so in a wrapping
 * row the line can sit beside a field while the list takes the whole width
 * under both (it carries basis-full). On its own, put it in a column.
 *
 * Picking a row moves the tick to it and the list stays open; it folds away
 * when its line is pressed again, on Escape, or as Tab leaves it. Folding on
 * the pick shuts the list under the finger and pulls the form up with it.
 */
function Choice<K extends string>({
    options,
    value,
    onChange,
    label,
    className = '',
}: {
    options: readonly ChoiceOption<K>[];
    value: K;
    onChange: (id: K) => void;
    /** What is being chosen. Read out with the chosen value, never drawn. */
    label: string;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const lineRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    const chosen = options.find(o => o.id === value)?.label ?? value;

    // Closing from the keyboard hands focus back to the line, so the next Tab
    // carries on through the form from where the list was.
    const close = () => {
        setOpen(false);
        lineRef.current?.focus();
    };

    // The list opens with the chosen row focused, so the arrow keys start
    // from it, and once unfolded it's brought into view if it ran off the
    // bottom of the screen.
    useEffect(() => {
        if (!open) return;
        const list = listRef.current;
        const row =
            list?.querySelector<HTMLElement>('[aria-selected="true"]') ??
            list?.querySelector<HTMLElement>('[role="option"]');
        row?.focus({ preventScroll: true });
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const timer = window.setTimeout(
            () => list?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }),
            reduce ? 0 : 320,
        );
        return () => clearTimeout(timer);
    }, [open]);

    const onListKeyDown = (e: React.KeyboardEvent) => {
        const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
        const at = rows.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => {
            e.preventDefault();
            rows[Math.max(0, Math.min(rows.length - 1, i))]?.focus();
        };
        if (e.key === 'ArrowDown') go(at + 1);
        else if (e.key === 'ArrowUp') go(at - 1);
        else if (e.key === 'Home') go(0);
        else if (e.key === 'End') go(rows.length - 1);
        else if (e.key === 'Tab') setOpen(false);
        else if (e.key === 'Escape') {
            // Only the list folds, not whatever the form is sitting in.
            e.stopPropagation();
            close();
        }
    };

    return (
        <>
            <button
                ref={lineRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={`${label}, ${chosen}`}
                className={`choice-trigger ${className}`}
                onClick={() => setOpen(o => !o)}
                onKeyDown={e => {
                    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                        e.preventDefault();
                        setOpen(true);
                    } else if (open && e.key === 'Escape') {
                        e.stopPropagation();
                        setOpen(false);
                    }
                }}
            >
                <span className="min-w-0 flex-1 truncate text-sm">{chosen}</span>
                <ChevronDown
                    size={16}
                    strokeWidth={1.75}
                    className={`chev shrink-0 text-[var(--text-muted)] ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <div className="disclosure disclosure-bleed basis-full" data-open={open} {...(open ? {} : { inert: '' })}>
                <div className="disclosure-inner">
                    <div
                        ref={listRef}
                        id={listId}
                        role="listbox"
                        aria-label={label}
                        onKeyDown={onListKeyDown}
                        className="choice-options settings-section"
                    >
                        {options.map(o => (
                            <button
                                key={o.id}
                                type="button"
                                tabIndex={-1}
                                role="option"
                                aria-selected={o.id === value}
                                onClick={() => onChange(o.id)}
                                className="choice-option row-bleed"
                            >
                                <span className="min-w-0 flex-1">{o.label}</span>
                                <Tick on={o.id === value} size={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

export default Choice;
