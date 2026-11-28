import { useMemo, useState } from 'react';
import { fmtAmount, type DoseRow } from '../lib/data';
import { useFeature } from '../lib/features';
import { isZh, tr } from '../lib/i18n';
import { newId } from '../lib/journal';
import { productsOf, usePerson } from '../lib/person';
import { SOURCE, SYRINGE_STEP_ML, massText, mlFor, mlNum, mlText, strengthOf } from '../lib/volumetric';
import { Fold } from './Fold';
import Segmented from './Segmented';

/* A dose too small for a milligram scale, measured in a liquid: how strong
   a liquid is, from what was weighed and how much liquid it went into, and
   how much of it each band of the dose rail is (lib/volumetric.ts). A
   liquid can be kept in the journal as a product taken by the mL, so a
   dose of it is logged as so much of the substance. */

type Band = 'light' | 'common' | 'strong' | 'heavy';
const BANDS: { id: Band; label: string; tone: string }[] = [
    { id: 'light', label: 'Light', tone: 'text-[var(--status-info)]' },
    { id: 'common', label: 'Common', tone: 'text-[var(--accent-ink)]' },
    { id: 'strong', label: 'Strong', tone: 'text-[var(--warning)]' },
    { id: 'heavy', label: 'Heavy', tone: 'text-[var(--danger)]' },
];

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));
const WEIGHED_UNITS = [
    { id: 'mg', label: 'mg' },
    { id: 'μg', label: 'μg' },
] as const;

export function Volumetric({ row, substance, name, benzo }: { row: DoseRow; substance: string; name: string; benzo: boolean }) {
    const { person, saveProduct } = usePerson();
    const productsOn = useFeature('products');
    const [weighedText, setWeighedText] = useState('');
    const [weighedUnit, setWeighedUnit] = useState<'mg' | 'μg'>('mg');
    const [mlTextIn, setMlTextIn] = useState('');
    const [doseText, setDoseText] = useState('');

    const unit = row.unit;
    const seg = row.segments ?? {};
    const weighed = num(weighedText);
    const ml = num(mlTextIn);
    const strength = strengthOf(weighed, weighedUnit, ml, unit);
    const dose = num(doseText);
    const common = seg.common ?? seg.light;
    const tooFine = strength != null && seg.light != null && mlFor(seg.light[0], strength) < SYRINGE_STEP_ML;

    // The same liquid kept already: one part, this substance, this strength
    // (kept to six figures, so compared to within that).
    const kept = useMemo(
        () =>
            strength != null
                ? productsOf(person).find(
                      p => p.per === 'mL' && p.parts.length === 1 && p.parts[0].substance === substance && p.parts[0].unit === unit && Math.abs(p.parts[0].amount - strength) <= strength * 1e-5,
                  )
                : undefined,
        [person, strength, substance, unit],
    );

    const label = 'block text-xs font-medium text-[var(--text-muted)] mb-1.5';
    const muted = 'text-[var(--text-muted)]';
    // What follows each field, the same width on every line so the fields end together.
    const unitSlot = 'w-24 shrink-0';
    // Lines with a part drawn on its own, in the order the language puts them.
    const [fromBefore, fromAfter] = tr('From {0}.').split('{0}');
    const [isBefore, isAfter] = tr('is {0} of this liquid.').split('{0}');
    const [eachBefore, eachAfter] = tr('{0} in each mL').split('{0}');

    return (
        <section className="mt-7" aria-labelledby="volumetric-title">
            <h3 id="volumetric-title" className="group-heading mb-2">
                {tr('Measuring it in a liquid')}
            </h3>
            <p className="text-sm leading-relaxed max-w-prose">
                {common
                    ? tr('A milligram scale is accurate to a few milligrams, and a common dose of this is {0}: too little to weigh. So more than one dose is weighed, dissolved in a measured amount of liquid, and a dose is measured out as liquid.', {
                          0: `${fmtAmount(common[0])}–${fmtAmount(common[1])} ${unit}`,
                      })
                    : tr('A milligram scale is accurate to a few milligrams, too coarse for a dose of this. So more than one dose is weighed, dissolved in a measured amount of liquid, and a dose is measured out as liquid.')}
            </p>

            <div className="mt-4 flex flex-col gap-4 max-w-md">
                <div>
                    <label className={label} htmlFor="volumetric-weighed">
                        {tr('Weighed')}
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            id="volumetric-weighed"
                            className={`input-base min-w-0 flex-1 tabular-nums ${weighedText ? 'is-inked' : ''}`}
                            inputMode="decimal"
                            autoComplete="off"
                            value={weighedText}
                            onChange={e => setWeighedText(e.target.value)}
                            aria-invalid={weighedText.trim() !== '' && !(weighed > 0)}
                        />
                        <div className={unitSlot}>
                            <Segmented options={WEIGHED_UNITS} value={weighedUnit} onChange={setWeighedUnit} aria-label={tr('Unit')} />
                        </div>
                    </div>
                </div>
                <div>
                    <label className={label} htmlFor="volumetric-ml">
                        {tr('Dissolved in')}
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            id="volumetric-ml"
                            className={`input-base min-w-0 flex-1 tabular-nums ${mlTextIn ? 'is-inked' : ''}`}
                            inputMode="decimal"
                            autoComplete="off"
                            value={mlTextIn}
                            onChange={e => setMlTextIn(e.target.value)}
                            aria-invalid={mlTextIn.trim() !== '' && !(ml > 0)}
                        />
                        <span className={`${unitSlot} text-sm ${muted}`}>mL</span>
                    </div>
                </div>
            </div>

            {strength != null && (
                <div className="mt-5" role="status">
                    <p className="text-sm">
                        {eachBefore}
                        <span className="text-lg font-medium tabular-nums">{massText(strength, unit)}</span>
                        {eachAfter}
                    </p>
                    <div className="settings-section mt-3 max-w-md">
                        {BANDS.map(b => {
                            const s = seg[b.id];
                            if (!s) return null;
                            const a = mlFor(s[0], strength);
                            const z = mlFor(s[1], strength);
                            return (
                                <div key={b.id} className="flex min-h-10 items-center gap-3 py-2 text-sm">
                                    <span className={`w-20 shrink-0 font-medium ${b.tone}`}>{tr(b.label)}</span>
                                    <span className={`min-w-0 flex-1 tabular-nums ${muted}`}>
                                        {b.id === 'heavy' ? tr('{0} or more', { 0: `${fmtAmount(s[0])} ${unit}` }) : `${fmtAmount(s[0])}–${fmtAmount(s[1])} ${unit}`}
                                    </span>
                                    <span className="shrink-0 tabular-nums font-medium">
                                        {b.id === 'heavy' ? tr('{0} or more', { 0: mlText(a) }) : `${mlNum(a)}–${mlText(z)}`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {tooFine && (
                        <p className="mt-3 text-sm leading-relaxed text-[var(--warning)] max-w-prose">
                            {tr('At this strength a light dose is less than 0.1 mL, finer than the marks on a 1 mL oral syringe. The same amount in more liquid makes each mL weaker.')}
                        </p>
                    )}

                    <div className="mt-5 max-w-md">
                        <label className={label} htmlFor="volumetric-dose">
                            {tr('A dose of')}
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                id="volumetric-dose"
                                className={`input-base min-w-0 flex-1 tabular-nums ${doseText ? 'is-inked' : ''}`}
                                inputMode="decimal"
                                autoComplete="off"
                                value={doseText}
                                onChange={e => setDoseText(e.target.value)}
                                aria-invalid={doseText.trim() !== '' && !(dose > 0)}
                            />
                            <span className={`${unitSlot} text-sm ${muted}`}>{unit}</span>
                        </div>
                        {dose > 0 && (
                            <p className="mt-2 text-sm">
                                {isBefore}
                                <span className="font-medium tabular-nums">{mlText(mlFor(dose, strength))}</span>
                                {isAfter}
                            </p>
                        )}
                    </div>

                    {productsOn && (
                        <div className="mt-5">
                            {kept ? (
                                <p className={`text-sm ${muted}`}>{tr('Kept in the journal as “{0}”. A dose of {1} logged in the journal can be measured from it in mL.', { 0: kept.name, 1: name })}</p>
                            ) : (
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() =>
                                        saveProduct({
                                            id: newId(),
                                            name: tr('{0}, {1} in each mL', { 0: name, 1: massText(strength, unit) }),
                                            per: 'mL',
                                            parts: [{ substance, name, amount: Number(strength.toPrecision(6)), unit }],
                                            route: row.roa,
                                        })
                                    }
                                >
                                    {tr('Keep this liquid in the journal')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="settings-section mt-5">
                <Fold title={tr('How it’s made')} icon="vial">
                    <ul className="text-sm leading-relaxed max-w-prose list-disc ps-5 space-y-2">
                        <li>{tr('The powder is weighed on the scale, not taken at the amount on its bag: a seller can send more than it says, and the liquid is then that much stronger.')}</li>
                        <li>
                            {tr('What it dissolves in depends on the substance: water, alcohol (vodka, for one), propylene glycol or glycerine.')}
                            {/* Chinese sets no space after a full stop. */}
                            {benzo && `${isZh() ? '' : ' '}${tr('Benzodiazepines hardly dissolve in water, and do in the other three.')}`}
                        </li>
                        <li>{tr('It is dissolved when nothing floats in it or has settled. Warm water helps; boiling can break some compounds down. A liquid with something settled in it gives doses that differ.')}</li>
                        <li>{tr('It is shaken before each dose, and a dose is measured with an oral syringe, which measures most accurately.')}</li>
                        <li>{tr('The bottle is labelled with what is in it and how strong it is, and kept out of light and heat and out of children’s reach: one bottle holds many doses.')}</li>
                    </ul>
                    <p className="footnote">
                        {fromBefore}
                        <a href={SOURCE.href} target="_blank" rel="noopener noreferrer">
                            {SOURCE.name}
                        </a>
                        {fromAfter}
                    </p>
                </Fold>
            </div>
        </section>
    );
}
