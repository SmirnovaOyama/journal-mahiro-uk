import { useEffect, useRef } from 'react';
import { hrtLine, sparkleFrom } from '../lib/eggs';
import PixelCat from './PixelCat';
import { External } from './icons';
import { tr } from '../lib/i18n';

/* What a search for estradiol finds besides the catalogue. Not a card: a
   level curve, the thing the HRT Tracker draws, five doses long with one
   dose in each of the flag's colours, and a cat asleep on the end of it.
   The line for whatever was searched sits above it, and the way to the app
   below. A burst of hearts the first time it shows on a visit. */

let burst = false;

const FLAG = ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa'];
const W = 100;
const H = 48;

/* One dose at steady state: in fast, out slow, and back where it began. */
const KA = 12;
const KE = 1.6;
const level = (t: number) => Math.exp(-KE * t) / (1 - Math.exp(-KE)) - Math.exp(-KA * t) / (1 - Math.exp(-KA));
const PEAK = 0.82;
const DOSES = FLAG.map((_, d) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push(`${(d * W + t * W).toFixed(1)},${(H - 4 - (level(t) / PEAK) * (H - 8)).toFixed(1)}`);
    }
    return pts.join(' ');
});

export function HrtEgg({ q }: { q: string }) {
    const egg = useRef<HTMLAnchorElement>(null);
    const line = hrtLine(q) ?? tr('Estradiol: the main estrogen.');
    useEffect(() => {
        if (burst) return;
        burst = true;
        const id = window.setTimeout(() => sparkleFrom(egg.current), 250);
        return () => window.clearTimeout(id);
    }, []);
    return (
        <a ref={egg} href="https://hrt.mahiro.uk" target="_blank" rel="noreferrer" className="trans-egg m-appear mt-6 no-underline">
            <span className="block text-sm font-semibold text-[var(--text)]">{line}</span>
            <span className="trans-curve" aria-hidden="true">
                <svg viewBox={`0 0 ${W * FLAG.length} ${H}`} preserveAspectRatio="none">
                    {/* The white dose, on a white page: a wider line under it keeps it there. */}
                    <polyline points={DOSES[2]} className="trans-curve-under" />
                    {DOSES.map((points, d) => (
                        <polyline key={d} points={points} stroke={FLAG[d]} />
                    ))}
                </svg>
                <span className="trans-curve-cat">
                    <PixelCat pose="loaf" size={44} />
                </span>
            </span>
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-xs leading-relaxed text-[var(--text-muted)]">
                    {tr('Hormones have an app of their own: Oyama’s HRT Tracker draws your levels by route and ester, from your own doses.')}
                </span>
                <span className="trans-egg-link">
                    {tr('Open HRT Tracker')}
                    <External size={13} />
                </span>
            </span>
        </a>
    );
}
