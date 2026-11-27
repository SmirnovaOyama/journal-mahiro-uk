import { useEffect, useMemo, useRef, useState } from 'react';
import { PARACETAMOL, paracetamolMg } from '../lib/advice';
import { nameOf, type IndexEntry } from '../lib/data';
import { dateLocale, roaName, tr } from '../lib/i18n';
import { useJournal, type Ingestion } from '../lib/journal';
import { medicinesOf, usePerson } from '../lib/person';
import { formatWeight, useWeight } from '../lib/store';
import { Close } from './icons';
import { gramsText } from './JournalNotes';
import { Molecule } from './Molecule';
import { useFeature } from '../lib/features';

/* The emergency page's tools: what was taken, set out for whoever comes to
   help; a beat to press a chest to; the steps read aloud, for hands that
   are busy; and where this device is, to say on the call. None of them is
   advice. Each works with no connection, and nothing here leaves the
   device. */

const DAY = 24 * 3600_000;
const muted = 'text-[var(--text-muted)]';
const toolButton =
    'inline-flex h-9 items-center gap-1.5 px-3.5 text-sm font-medium rounded-full border-(length:--hairline) border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--surface-hover)]';

/* ── what was taken ─────────────────────────────────────────────────── */

function when(t: number, now: number) {
    const d = new Date(t);
    const clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (d.toDateString() === new Date(now).toDateString()) return clock;
    return `${d.toLocaleDateString(dateLocale(), { weekday: 'short' })} ${clock}`;
}

const amount = (i: Ingestion) => (i.dose == null ? tr('amount unknown') : `${i.estimate ? '~' : ''}${i.dose} ${i.unit}`);

/** A substance's name for someone who may read another language: as the
 *  reader's language has it, and the catalogue's own beside it. */
function Named({ id, name, byId }: { id: string; name: string; byId?: Map<string, IndexEntry> }) {
    const e = byId?.get(id);
    const local = e ? nameOf(e) : name;
    const latin = e?.name ?? name;
    return (
        <>
            {local}
            {latin !== local && <span className={`font-normal ${muted}`}> ({latin})</span>}
        </>
    );
}

/** What the journal holds for the last 24 hours, the medicines taken every
 *  day and the body weight, to show the crew or read out on the call.
 *  Nothing, when the journal holds none of it. */
export function CrewCard({ byId }: { byId?: Map<string, IndexEntry> }) {
    const { data } = useJournal();
    const { person } = usePerson();
    const weight = useWeight();
    const [large, setLarge] = useState(false);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(t);
    }, []);
    useEffect(() => {
        if (!large) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLarge(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [large]);

    const doses = useMemo(() => data.ingestions.filter(i => now - i.time < DAY && i.time <= now + 3600_000).sort((a, b) => b.time - a.time), [data.ingestions, now]);
    const meds = medicinesOf(person);
    const wanted = useFeature('crewCard');
    if (!wanted || (!doses.length && !meds.length)) return null;
    const apap = doses.some(i => i.substance === PARACETAMOL) ? paracetamolMg(data.ingestions, now).mg : 0;

    const body = (big: boolean) => (
        <div className={big ? 'text-xl leading-8' : ''}>
            {doses.length > 0 ? (
                <ul className="settings-section">
                    {doses.map(i => (
                        <li key={i.id} className="flex items-center gap-3 py-2.5">
                            <span className={`shrink-0 tabular-nums ${muted} ${big ? 'w-24' : 'w-[4.5rem] text-sm'}`}>{when(i.time, now)}</span>
                            {byId?.get(i.substance) && <Molecule id={i.substance} form={byId.get(i.substance)!.form} size="sm" />}
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-[var(--text)] [overflow-wrap:anywhere]">
                                    <Named id={i.substance} name={i.name} byId={byId} />
                                </span>
                                <span className={`block tabular-nums ${big ? '' : 'text-sm'}`}>
                                    {amount(i)}, {roaName(i.route)}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className={muted}>{tr('Nothing logged in the last 24 hours.')}</p>
            )}
            {apap > 0 && <p className="mt-3">{tr('Paracetamol in 24 hours: {0}', { 0: gramsText(apap) })}</p>}
            {meds.length > 0 && (
                <div className="mt-3">
                    <p className={muted}>{tr('Takes every day:')}</p>
                    <ul className="mt-1 space-y-1.5">
                        {meds.map(m => (
                            <li key={m.id} className="flex items-center gap-3 font-semibold">
                                {byId?.get(m.id) && <Molecule id={m.id} form={byId.get(m.id)!.form} size="sm" />}
                                <span className="min-w-0 [overflow-wrap:anywhere]">
                                    <Named id={m.id} name={m.name} byId={byId} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {weight.kg && (
                <p className="mt-3">
                    <span className={muted}>{tr('Body weight:')} </span>
                    {formatWeight(weight.kg, weight.unit)}
                </p>
            )}
        </div>
    );

    return (
        <section aria-labelledby="crew-card">
            <div className="flex items-center justify-between gap-3">
                <h2 id="crew-card" className="text-lg font-semibold text-[var(--text)]">
                    {tr('What was taken')}
                </h2>
                <button type="button" className={toolButton} onClick={() => setLarge(true)}>
                    {tr('Show it large')}
                </button>
            </div>
            <p className={`text-sm ${muted} mt-0.5 mb-2`}>{tr('From the journal on this device, for the last 24 hours: to show the crew, or to read out on the call.')}</p>
            {body(false)}
            {large && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--bg)] text-[var(--text)]" role="dialog" aria-modal="true" aria-labelledby="crew-card-large">
                    <div className="mx-auto w-full max-w-2xl px-6 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-12">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h2 id="crew-card-large" className="text-2xl font-semibold">
                                {tr('What was taken')}
                            </h2>
                            <button type="button" className="btn-ghost !size-11 !p-0" aria-label={tr('Close')} onClick={() => setLarge(false)} autoFocus>
                                <Close size={24} />
                            </button>
                        </div>
                        {body(true)}
                    </div>
                </div>
            )}
        </section>
    );
}

/* ── a beat for chest compressions ──────────────────────────────────── */

/** 110 a minute: St John Ambulance gives 100 to 120. */
const BEATS = 110;

/** A tick, a flash and (where the device can) a buzz, 110 times a minute,
 *  to press a chest to. The sound is made on the device. */
export function Metronome() {
    const [on, setOn] = useState(false);
    const [beat, setBeat] = useState(0);
    const audio = useRef<AudioContext | null>(null);
    useEffect(() => {
        if (!on) return;
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const ctx = Ctx ? new Ctx() : null;
        audio.current = ctx;
        const tick = () => {
            setBeat(b => b + 1);
            navigator.vibrate?.(40);
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.09);
        };
        tick();
        const t = window.setInterval(tick, 60_000 / BEATS);
        return () => {
            window.clearInterval(t);
            void ctx?.close();
            audio.current = null;
        };
    }, [on]);
    const wanted = useFeature('emergencyTools');
    if (!wanted) return null;
    return (
        <span className="mt-2 flex items-center gap-3">
            <button type="button" className={toolButton} aria-pressed={on} onClick={() => setOn(o => !o)}>
                {on ? tr('Stop the beat') : tr('Keep the beat for me')}
            </button>
            {on && (
                <>
                    <span key={beat} aria-hidden="true" className="beat-mark size-4 rounded-full bg-[var(--danger)]" />
                    <span className={`text-sm tabular-nums ${muted}`}>{tr('Press on each tick')}</span>
                </>
            )}
        </span>
    );
}

/* ── the steps, read aloud ──────────────────────────────────────────── */

/** Reads lines aloud in the page's language, with the device's own voice. */
export function ReadAloud({ lines }: { lines: string[] }) {
    const [on, setOn] = useState(false);
    const can = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    useEffect(() => () => (can ? window.speechSynthesis.cancel() : undefined), [can]);
    const wanted = useFeature('emergencyTools');
    if (!can || !wanted) return null;
    const start = () => {
        window.speechSynthesis.cancel();
        lines.forEach((line, k) => {
            const u = new SpeechSynthesisUtterance(line);
            u.lang = document.documentElement.lang || dateLocale();
            u.rate = 0.95;
            if (k === lines.length - 1) u.onend = () => setOn(false);
            window.speechSynthesis.speak(u);
        });
        setOn(true);
    };
    const stop = () => {
        window.speechSynthesis.cancel();
        setOn(false);
    };
    return (
        <button type="button" className={`${toolButton} mt-2`} aria-pressed={on} onClick={on ? stop : start}>
            {on ? tr('Stop reading') : tr('Read it aloud')}
        </button>
    );
}

/* ── where this device is ───────────────────────────────────────────── */

/** The device's position, to read out on the call. Asked of the device
 *  only when pressed, and shown here: it is sent nowhere. */
export function Position() {
    const [state, setState] = useState<'idle' | 'asking' | 'failed'>('idle');
    const [at, setAt] = useState<{ lat: number; lon: number; within: number } | null>(null);
    const wanted = useFeature('emergencyTools');
    if (!wanted || !('geolocation' in navigator)) return null;
    const ask = () => {
        setState('asking');
        navigator.geolocation.getCurrentPosition(
            p => {
                setAt({ lat: p.coords.latitude, lon: p.coords.longitude, within: Math.round(p.coords.accuracy) });
                setState('idle');
            },
            () => setState('failed'),
            { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
        );
    };
    const f = (n: number) => n.toFixed(5);
    return (
        <div className="mt-3">
            <button type="button" className={toolButton} onClick={ask} disabled={state === 'asking'}>
                {state === 'asking' ? tr('Finding where you are…') : tr('Where am I?')}
            </button>
            {at && (
                <p className="mt-2" role="status">
                    <span className="text-lg font-semibold tabular-nums text-[var(--text)]">
                        {f(at.lat)}, {f(at.lon)}
                    </span>{' '}
                    <span className={`text-sm ${muted}`}>{tr('to within {0} m', { 0: at.within })}</span>{' '}
                    <a href={`geo:${f(at.lat)},${f(at.lon)}`} className="text-sm underline underline-offset-[3px]">
                        {tr('Open in maps')}
                    </a>
                </p>
            )}
            {state === 'failed' && (
                <p className={`mt-2 text-sm ${muted}`} role="status">
                    {tr('The device wouldn’t say where it is.')}
                </p>
            )}
            <p className={`mt-1 text-xs ${muted}`}>{tr('Your position as two numbers, to read out if you can’t say where you are. Read on this device and sent nowhere.')}</p>
        </div>
    );
}
