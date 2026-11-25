import { useEffect, useRef } from 'react';
import { hrtLine, sparkleFrom } from '../lib/eggs';
import PixelCat from './PixelCat';
import { External } from './icons';

/* What a search for estradiol finds besides the catalogue: a card in the
   flag's colours with a cat on it, the line for whatever was searched, and
   the way to the app that's for exactly this. A burst of hearts the first
   time it shows on a visit. */

let burst = false;

export function HrtEgg({ q }: { q: string }) {
    const card = useRef<HTMLAnchorElement>(null);
    const line = hrtLine(q) ?? 'Estradiol: the good stuff.';
    useEffect(() => {
        if (burst) return;
        burst = true;
        const id = window.setTimeout(() => sparkleFrom(card.current), 250);
        return () => window.clearTimeout(id);
    }, []);
    return (
        <a ref={card} href="https://hrt.mahiro.uk" target="_blank" rel="noreferrer" className="trans-card m-appear mt-6 no-underline">
            <span className="trans-stripes" aria-hidden="true" />
            <span className="shrink-0 -my-1" aria-hidden="true">
                <PixelCat pose="donut" size={52} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text)]">{line}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                    {'Hormones have an app of their own: Oyama’s HRT Tracker draws your levels by route and ester, from your own doses.'}
                </span>
            </span>
            <External size={16} className="shrink-0 text-[var(--text-muted)]" />
        </a>
    );
}
