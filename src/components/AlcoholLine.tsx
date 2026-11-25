import type { Session } from '../lib/journal';
import { alcoholGrams, bloodAlcohol, bloodAlcoholAt, formatBac } from '../lib/alcohol';
import { formatWeight, useWeight } from '../lib/store';
import { Link } from './Link';

/* Under a session with alcohol in it: how high blood alcohol went, roughly,
   from the body weight in Settings; where it is now while the session is
   on; and about when it's back to nothing. With no weight set, how to get
   one. */

const clock = (t: number) => {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function AlcoholLine({ s, now }: { s: Session; now: number }) {
    const weight = useWeight();
    const drinks = s.ingestions.filter(i => alcoholGrams(i) != null);
    if (!drinks.length) return null;
    const muted = 'text-[var(--text-muted)]';

    if (!weight.kg)
        return (
            <p className={`mt-3 text-xs ${muted}`}>
                <Link to={{ page: 'settings', sub: 'weight' }} className="text-[var(--accent-ink)] no-underline">
                    {'Set your body weight'}
                </Link>
                {' to see roughly how high blood alcohol went.'}
            </p>
        );

    const est = bloodAlcohol(drinks, weight.kg)!;
    // The page's clock moves on each minute; a drink logged a moment ago is
    // still "now".
    const t = Math.max(now, Date.now());
    const nowRange = t >= s.start ? bloodAlcoholAt(drinks, weight.kg, t) : null;
    return (
        <div className="callout mt-3 space-y-1">
            <p className="text-[var(--text)]">
                {`Blood alcohol, roughly: at most ${formatBac(est.peak)}, around ${clock(est.peakAt)}`}
                {nowRange ? `, and ${formatBac(nowRange)} now. ` : '. '}
                {est.clearAt > t ? `Back to none by about ${clock(est.clearAt)}.` : ''}
            </p>
            <p className="text-xs">
                {`By Widmark’s formula, from ${formatWeight(weight.kg, weight.unit)}. Food, sex and how fast you drink all change it, and it’s no guide to whether you can drive.`}
            </p>
        </div>
    );
}
