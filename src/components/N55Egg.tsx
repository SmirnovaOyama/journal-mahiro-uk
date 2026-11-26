import { Link } from './Link';
import PixelCat from './PixelCat';
import { tr } from '../lib/i18n';

/* What a search for N55 finds: a few lines under the field on pregabalin
   and what too much of it does. Plain, in English, no window. */

/** N55 and N552AA, in any case, with or without spaces. */
export const isN55Search = (q: string) => /^n55(2aa)?$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

const HARMS = [
    'With opioids, benzodiazepines or alcohol, it slows breathing along with them. This is behind most deaths involving pregabalin.',
    'At high doses it brings dizziness, unsteadiness, double vision and slurred speech, and falls and injuries come easily.',
    'A lot at once can mean not waking up, or seizures.',
    'Taken daily, tolerance and dependence come fast. Stopping suddenly can bring insomnia, anxiety, sweating and even seizures, so taper slowly.',
    'Weak kidneys clear it slowly, so the same dose is more dangerous.',
];

export function N55Egg() {
    return (
        <section className="m-appear mt-6" aria-labelledby="n55-title">
            <div className="flex items-center gap-3">
                <PixelCat pose="donut" size={40} />
                <h2 id="n55-title" className="text-base font-semibold text-[var(--text)]">
                    {tr('What a pregabalin OD does')}
                </h2>
            </div>
            <ul className="n55-list mt-3 text-sm leading-relaxed text-[var(--text)]">
                {HARMS.map(h => (
                    <li key={h}>{tr(h)}</li>
                ))}
            </ul>
            <p className="mt-3 text-sm leading-relaxed font-medium text-[var(--text)]">
                {tr('If someone can’t be woken, is breathing slowly or is having a seizure, call emergency services now (120, 112, 911 or 999), lay them on their side, and stay with them.')}
            </p>
            <Link to={{ page: 'substance', id: 'pregabalin' }} className="btn-secondary btn-sm no-underline mt-4">
                {tr('Read about pregabalin')}
            </Link>
        </section>
    );
}
