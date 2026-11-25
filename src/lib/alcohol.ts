import { convertAmount } from './data';
import type { Ingestion } from './journal';

/* Blood alcohol, roughly, by Widmark's formula: the grams of alcohol drunk,
   over the body's water (its weight times a ratio, about 0.55 to 0.68: lower
   for more fat or less muscle, and usually for women), less about 0.015% an
   hour from the first drink. Without the person's sex the ratio is a range,
   so the answer is too. It counts a drink as absorbed at once, so it runs
   high just after one, which is the safe side to be wrong on. */

const RATIO = { low: 0.55, high: 0.68 };
/** Burned off an hour, as a percentage of blood. */
const PER_HOUR = 0.015;
const HOUR = 3600_000;

/** Grams of alcohol in a logged dose, when it's logged by weight. */
export function alcoholGrams(i: Ingestion): number | null {
    if (i.substance !== 'alcohol' || i.dose == null) return null;
    return convertAmount(i.dose, i.unit, 'g');
}

interface Drink {
    g: number;
    time: number;
}

const drinksOf = (doses: Ingestion[]): Drink[] =>
    doses.flatMap(i => {
        const g = alcoholGrams(i);
        return g != null && g > 0 ? [{ g, time: i.time }] : [];
    });

/** The estimate at time `t`, as [low, high] percent, or null when it's
 *  nothing (before the first drink, or after it's all burned off). */
export function bloodAlcoholAt(doses: Ingestion[], kg: number, t: number): [number, number] | null {
    const drunk = drinksOf(doses).filter(d => d.time <= t);
    if (!drunk.length) return null;
    const grams = drunk.reduce((a, d) => a + d.g, 0);
    const hours = (t - Math.min(...drunk.map(d => d.time))) / HOUR;
    const at = (r: number) => Math.max(0, (grams / (r * kg * 1000)) * 100 - PER_HOUR * hours);
    const range: [number, number] = [at(RATIO.high), at(RATIO.low)];
    return range[1] > 0 ? range : null;
}

/** Its highest, which by this reckoning is just after the last drink that
 *  raised it; and when the high end of the estimate is back to zero. */
export function bloodAlcohol(doses: Ingestion[], kg: number): { peak: [number, number]; peakAt: number; clearAt: number } | null {
    const drinks = drinksOf(doses).sort((a, b) => a.time - b.time);
    if (!drinks.length) return null;
    let peak: [number, number] = [0, 0];
    let peakAt = drinks[0].time;
    for (const d of drinks) {
        const r = bloodAlcoholAt(doses, kg, d.time);
        if (r && r[1] > peak[1]) {
            peak = r;
            peakAt = d.time;
        }
    }
    const grams = drinks.reduce((a, d) => a + d.g, 0);
    const clearAt = drinks[0].time + (((grams / (RATIO.low * kg * 1000)) * 100) / PER_HOUR) * HOUR;
    return { peak, peakAt, clearAt };
}

/** "0.05–0.06%", "under 0.01%". */
export function formatBac([lo, hi]: [number, number]): string {
    const f = (v: number) => v.toFixed(2);
    if (hi < 0.01) return 'under 0.01%';
    return f(lo) === f(hi) ? `${f(hi)}%` : `${f(lo)}–${f(hi)}%`;
}
