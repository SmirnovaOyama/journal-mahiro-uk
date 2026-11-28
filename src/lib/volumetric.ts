import { convertAmount, fmtAmount, isPerKg, type DoseRow } from './data';

/* Measuring a dose in a liquid (volumetric dosing), for a substance whose
   dose is too small to weigh. A milligram scale is accurate to a few
   milligrams, so more than one dose is weighed, dissolved in a measured
   amount of liquid, and a dose is measured out as liquid. What the page
   says of it is PsychonautWiki's (SOURCE). */

export const SOURCE = { name: 'PsychonautWiki, Volumetric liquid dosing', href: 'https://psychonautwiki.org/wiki/Volumetric_liquid_dosing' };

/** A common dose under this, in mg, is too small for a milligram scale:
 *  its few milligrams of error are a third of it or more. */
export const SCALE_MG = 10;

/** The marks on a 1 mL oral syringe are this far apart. */
export const SYRINGE_STEP_ML = 0.1;

/** The routes a liquid is taken by: swallowed, held in the mouth, sprayed
 *  up the nose, or rectally. Not smoked or injected. */
const LIQUID = /^(oral|sublingual|buccal|insufflated|rectal)\b/i;

/** Where a dose of this, taken this way, is too small to weigh. */
export function tooSmallToWeigh(row: DoseRow | undefined): boolean {
    if (!row || !LIQUID.test(row.roa) || isPerKg(row.unit)) return false;
    const at = row.segments?.common?.[0] ?? row.segments?.light?.[0];
    if (at == null) return false;
    const mg = convertAmount(at, row.unit, 'mg');
    return mg != null && mg > 0 && mg < SCALE_MG;
}

/** How much is in each mL, in `unit`, with `amount` (in `amountUnit`)
 *  dissolved in `ml` of liquid; null if either is missing. */
export function strengthOf(amount: number, amountUnit: string, ml: number, unit: string): number | null {
    if (!(amount > 0) || !(ml > 0)) return null;
    const a = convertAmount(amount, amountUnit, unit);
    return a == null ? null : a / ml;
}

/** The liquid that holds `dose`, in mL, at `strength` a mL (both in the
 *  same unit). */
export const mlFor = (dose: number, strength: number) => dose / strength;

/** An amount in the unit it reads best in: 1,000 μg is "1 mg". */
export function massText(v: number, unit: string): string {
    const ug = convertAmount(v, unit, 'μg');
    if (ug == null) return `${fmtAmount(v)} ${unit}`;
    if (ug >= 1e6) return `${fmtAmount(ug / 1e6)} g`;
    if (ug >= 1000) return `${fmtAmount(ug / 1000)} mg`;
    return `${fmtAmount(ug)} μg`;
}

/** A volume in mL as a syringe reads it, without its unit: "0.25", "1.5". */
export const mlNum = (v: number) => (v >= 0.1 ? fmtAmount(Math.round(v * 100) / 100) : fmtAmount(v));

/** The same, with its unit: "0.25 mL". */
export const mlText = (v: number) => `${mlNum(v)} mL`;
