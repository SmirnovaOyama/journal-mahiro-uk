import type { Session } from '../lib/journal';
import { alcoholGrams, bloodAlcohol, bloodAlcoholAt, formatBac } from '../lib/alcohol';
import { formatWeight, useWeight } from '../lib/store';
import { Link } from './Link';
import { tr } from '../lib/i18n';

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
                    {tr('Set your body weight')}
                </Link>
                {tr(' to see roughly how high blood alcohol went.')}
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
                {tr('Blood alcohol, roughly: at most {0}, around {1}', { 0: formatBac(est.peak), 1: clock(est.peakAt) })}
                {nowRange ? tr(', and {0} now. ', { 0: formatBac(nowRange) }) : tr('. ')}
                {est.clearAt > t ? tr('Back to zero by about {0}.', { 0: clock(est.clearAt) }) : ''}
            </p>
            <p className="text-xs">
                {tr('Estimated with the Widmark formula, using {0}. Food, sex and how fast you drink all affect it. Don’t use it to decide whether you can drive.', { 0: formatWeight(weight.kg, weight.unit) })}
            </p>
        </div>
    );
}
