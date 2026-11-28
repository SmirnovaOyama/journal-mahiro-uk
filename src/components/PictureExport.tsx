import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from '../lib/eggs';
import { useFeature } from '../lib/features';
import { tr } from '../lib/i18n';
import type { NightPicture as Picture, PictureStyle } from '../lib/picture';
import { ImagePlus } from './icons';
import { headerAction } from './PageHeader';
import { WaitMark } from './Waiting';

/* A night in the journal saved as a picture (lib/picture.ts), in one tap:
   on a phone the share sheet opens with it (to keep it in Photos or send
   it), elsewhere it is saved as a file.

   A phone shares a file only straight from a tap, and drawing takes a
   moment, so the picture is drawn ahead, quietly, once the page has been
   open a little while and again whenever what it shows changes. A tap
   before it's ready draws it then; if the phone won't share after the
   wait, the picture is saved instead. */

/** Whether pictures are on (Settings, Features). */
export const usePictures = () => useFeature('picture');

/* How the night is drawn: round a dial, or along a line. Chosen once in
   Settings, Features, under the switch, and kept on this device, so the
   button stays one tap. */
const STYLE_KEY = 'journal.picture-style.v1';
const readStyle = (): PictureStyle => {
    try {
        const kept = localStorage.getItem(STYLE_KEY);
        return kept === 'lines' ? kept : 'dial';
    } catch {
        return 'dial';
    }
};
let style = readStyle();
const styleSubs = new Set<() => void>();
export function setPictureStyle(next: PictureStyle) {
    style = next;
    try {
        localStorage.setItem(STYLE_KEY, next);
    } catch {
        /* for this visit only */
    }
    styleSubs.forEach(f => f());
}
export const usePictureStyle = () =>
    useSyncExternalStore(
        f => {
            styleSubs.add(f);
            return () => {
                styleSubs.delete(f);
            };
        },
        () => style,
    );

async function drawn(make: () => Picture): Promise<File> {
    const picture = make();
    const { draw } = await import('../lib/picture');
    const blob = await draw(picture);
    return new File([blob], `${picture.file}.png`, { type: 'image/png' });
}

function save(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    toast(tr('The picture is saved.'));
}

/** Shared on a phone that can, saved anywhere else. Called straight from
 *  the tap: the share is asked for before anything is awaited. */
async function handOver(file: File) {
    const phone = window.matchMedia('(pointer: coarse)').matches;
    if (phone && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file] });
            return;
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
        }
    }
    save(file);
}

/** The header action. `signature` changes whenever the picture would. */
export function SavePicture({ make, signature }: { make: () => Picture; signature: string }) {
    const [busy, setBusy] = useState(false);
    const ready = useRef<{ signature: string; file: File } | null>(null);
    const latest = useRef(make);
    latest.current = make;

    useEffect(() => {
        let live = true;
        const t = window.setTimeout(() => {
            drawn(() => latest.current())
                .then(file => {
                    if (live) ready.current = { signature, file };
                })
                .catch(() => {});
        }, 1200);
        return () => {
            live = false;
            window.clearTimeout(t);
        };
    }, [signature]);

    const onClick = () => {
        if (busy) return;
        if (ready.current?.signature === signature) return void handOver(ready.current.file);
        setBusy(true);
        drawn(() => latest.current())
            .then(file => {
                ready.current = { signature, file };
                return handOver(file);
            })
            .catch(() => toast(tr('The picture couldn’t be drawn on this device.')))
            .finally(() => setBusy(false));
    };

    return (
        <button
            type="button"
            className={`${headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
            aria-label={tr('Save as a picture')}
            aria-busy={busy}
            onClick={onClick}
        >
            {busy ? <WaitMark size={18} /> : <ImagePlus size={18} />}
            <span className="max-sm:hidden">{tr('Save as a picture')}</span>
        </button>
    );
}
