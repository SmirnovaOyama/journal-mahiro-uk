import React, { useState } from 'react';
import { back } from '../lib/router';
import { KG_PER_LB, WEIGHT_KG_MAX, WEIGHT_KG_MIN, useWeight } from '../lib/store';
import { useAccount } from '../lib/account';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import Segmented from '../components/Segmented';

/* Body weight, laid out as hrt.mahiro.uk's (pages/WeightSettings.tsx there):
   one big number, its unit beside it, the range under it, and Save. It reads
   doses per kilogram, turns a per-kilogram dose into an amount, and
   estimates blood alcohol. */

const toUnit = (kg: number, unit: 'kg' | 'lb') => (unit === 'lb' ? kg / KG_PER_LB : kg);
const fromUnit = (v: number, unit: 'kg' | 'lb') => (unit === 'lb' ? v * KG_PER_LB : v);
const shown = (kg: number, unit: 'kg' | 'lb') => String(unit === 'lb' ? Math.round(toUnit(kg, unit)) : Number(kg.toFixed(1)));

export function WeightPage() {
    const w = useWeight();
    const { account } = useAccount();
    const [unit, setUnit] = useState<'kg' | 'lb'>(w.unit);
    const [text, setText] = useState(w.kg ? shown(w.kg, w.unit) : '');
    // The weight as typed or saved, exactly: switching units shows it from
    // this, so 62 kg is 137 lb and back to 62 kg, not 62.1.
    const [exact, setExact] = useState<number | null>(w.kg);
    const [tried, setTried] = useState(false);

    const value = Number(text.replace(',', '.'));
    const kg = text.trim() ? fromUnit(value, unit) : NaN;
    const valid = Number.isFinite(kg) && kg >= WEIGHT_KG_MIN && kg <= WEIGHT_KG_MAX;
    const showError = tried && !valid;
    const range =
        unit === 'lb'
            ? `${Math.ceil(WEIGHT_KG_MIN / KG_PER_LB)}–${Math.floor(WEIGHT_KG_MAX / KG_PER_LB)} lb`
            : `${WEIGHT_KG_MIN}–${WEIGHT_KG_MAX} kg`;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return setTried(true);
        w.save(Math.round((exact ?? kg) * 10) / 10, unit);
        back();
    };

    const divider = 'border-b-(length:--hairline) border-[var(--border)]';
    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={'Body weight'} />
            <form onSubmit={submit} noValidate className={`${PAGE_COLUMN} mt-4`}>
                <div className={`flex items-center justify-between gap-4 py-5 ${divider}`}>
                    <div>
                        <div className="flex items-end gap-2">
                            <input
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="done"
                                value={text}
                                onChange={e => {
                                    setText(e.target.value);
                                    const v = Number(e.target.value.replace(',', '.'));
                                    setExact(e.target.value.trim() && Number.isFinite(v) ? fromUnit(v, unit) : null);
                                }}
                                aria-label={'Body weight'}
                                aria-invalid={showError}
                                aria-describedby="weight-help"
                                className="input-base w-28 text-center font-light tabular-nums text-[var(--text)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                placeholder={unit === 'lb' ? '150' : '70'}
                                style={{ fontSize: '40px' }}
                                autoFocus
                            />
                            <span className="pb-1 text-sm font-medium text-[var(--text-muted)]">{unit}</span>
                        </div>
                        <p id="weight-help" aria-live="polite" className={`mt-2 text-xs ${showError ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>
                            {showError ? `A body weight is between ${range}.` : range}
                        </p>
                    </div>
                    <Segmented
                        options={[
                            { id: 'kg', label: 'kg' },
                            { id: 'lb', label: 'lb' },
                        ]}
                        value={unit}
                        onChange={u => {
                            const next = u as 'kg' | 'lb';
                            // The number follows the unit, so it stays the same weight.
                            if (exact != null) setText(shown(exact, next));
                            setUnit(next);
                        }}
                        aria-label={'Unit'}
                    />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
                    {'It reads a dose per kilogram, turns a dose given per kilogram into an amount, and estimates blood alcohol. '}
                    {account ? 'Kept on this device, and in your account, encrypted.' : 'Kept on this device only.'}
                </p>
                <button type="submit" className="btn-primary mt-6 w-full">
                    {'Save'}
                </button>
                {w.kg != null && (
                    <button
                        type="button"
                        className="link-button mt-4 w-full text-center text-sm"
                        onClick={() => {
                            w.clear();
                            back();
                        }}
                    >
                        {'Forget my weight'}
                    </button>
                )}
            </form>
        </div>
    );
}
