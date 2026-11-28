import { useEffect, useState } from 'react';
import { useFeature } from '../lib/features';
import { tr } from '../lib/i18n';
import type { Picture } from '../lib/picture';
import { Download, ImagePlus, Share } from './icons';
import { headerAction, headerActionAccent } from './PageHeader';
import { Waiting } from './Waiting';

/* A page saved as a picture (lib/picture.ts): a header action that opens,
   under the header, the picture once drawn, with a way to share it or save
   it. It opens in place, as the journal's Log does: nothing floats over
   the page. The picture is drawn on this device, from what the page shows;
   the drawing code is loaded the first time one is asked for.

   Two steps, not one: a phone shares a file only straight from a tap, and
   drawing takes a moment, so the tap that draws can't be the one that
   shares. */

/** Whether pictures are on (Settings, Features). */
export const usePictures = () => useFeature('picture');

/** A chemical formula as a line of text, as the page sets it (Formula in
 *  pages/Substance.tsx): its counts low, a charge high. C₁₇H₂₁NO₄, Li⁺. */
export function formulaText(f: string): string {
    const low = '₀₁₂₃₄₅₆₇₈₉';
    const high = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    return (f.match(/[A-Z][a-z]?|\d+|[+-]\d*|./g) ?? [])
        .map(p =>
            /^\d+$/.test(p)
                ? p.replace(/\d/g, d => low[Number(d)])
                : /^[+-]/.test(p)
                  ? p.replace(/\d/g, d => high[Number(d)]).replace('+', '⁺').replace('-', '⁻')
                  : p,
        )
        .join('');
}

export function PictureAction({ open, onToggle }: { open: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            className={`${open ? headerActionAccent : headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
            aria-expanded={open}
            aria-label={tr('Picture')}
            onClick={onToggle}
        >
            <ImagePlus size={18} />
            <span className="max-sm:hidden">{tr('Picture')}</span>
        </button>
    );
}

type State = { at: 'drawing' } | { at: 'failed' } | { at: 'ready'; url: string; file: File };

export function PicturePanel({ open, make }: { open: boolean; make: () => Picture }) {
    const [state, setState] = useState<State>({ at: 'drawing' });

    useEffect(() => {
        if (!open) return;
        let live = true;
        let url = '';
        setState({ at: 'drawing' });
        const picture = make();
        import('../lib/picture')
            .then(m => m.draw(picture))
            .then(blob => {
                if (!live) return;
                url = URL.createObjectURL(blob);
                setState({ at: 'ready', url, file: new File([blob], `${picture.file}.png`, { type: 'image/png' }) });
            })
            .catch(() => live && setState({ at: 'failed' }));
        return () => {
            live = false;
            if (url) URL.revokeObjectURL(url);
        };
        // Drawn again each time it's opened, from what the page shows then.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const canShare = state.at === 'ready' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [state.file] });

    return (
        <div className="disclosure disclosure-bleed" data-open={open} {...(open ? {} : { inert: '' })}>
            <div className="disclosure-inner">
                {open && (
                    <div className="pt-2 pb-8" role="status">
                        {state.at === 'drawing' && <Waiting>{tr('Drawing the picture…')}</Waiting>}
                        {state.at === 'failed' && <p className="text-sm text-[var(--text-muted)]">{tr('The picture couldn’t be drawn on this device.')}</p>}
                        {state.at === 'ready' && (
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                                <img
                                    src={state.url}
                                    alt={tr('The picture')}
                                    width={1080}
                                    height={1440}
                                    className="w-56 h-auto rounded-[var(--radius-lg)] border-(length:--hairline) border-[var(--border)]"
                                />
                                <div className="flex flex-col gap-3 max-w-prose">
                                    <p className="text-sm text-[var(--text-muted)]">{tr('Drawn on this device, from what this page shows. It goes nowhere until it is shared.')}</p>
                                    <div className="flex flex-wrap gap-3">
                                        {canShare && (
                                            <button
                                                type="button"
                                                className="btn-primary"
                                                onClick={() => void navigator.share({ files: [state.file] }).catch(() => {})}
                                            >
                                                <Share size={16} />
                                                {tr('Share')}
                                            </button>
                                        )}
                                        <a className={`${canShare ? 'btn-secondary' : 'btn-primary'} no-underline`} href={state.url} download={state.file.name}>
                                            <Download size={16} />
                                            {tr('Save')}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
