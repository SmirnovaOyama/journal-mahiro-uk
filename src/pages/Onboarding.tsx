import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import Doodle from '../components/Doodle';
import LevelRail from '../components/LevelRail';
import { Molecule } from '../components/Molecule';
import { Odometer } from '../components/Odometer';
import { SessionChart, type ChartDose } from '../components/SessionChart';
import { SessionMark } from '../components/SessionMark';
import { Check, ChevronLeft, Clover } from '../components/icons';
import { PALETTE } from '../lib/journal';
import { VERDICT, type Verdict } from '../lib/mix';
import type { Course } from '../lib/time';

/* The intro: a short story told with the app itself. Each screen is a
   stage (a live piece of the site: the dose rail rolling through its bands,
   the mix checker answering, a night on the journal's clock) over a few
   words. Swipe, tap Next or use the arrow keys; the bars at the foot say
   how far along it is. Shown once; Settings can bring it back. */

const SEEN_KEY = 'journal-onboarding-seen';

let showing = (() => {
    try {
        return localStorage.getItem(SEEN_KEY) !== 'true';
    } catch {
        return false;
    }
})();
const subs = new Set<() => void>();

function setShowing(v: boolean) {
    showing = v;
    subs.forEach(f => f());
}

export function useOnboarding(): boolean {
    return useSyncExternalStore(
        f => {
            subs.add(f);
            return () => {
                subs.delete(f);
            };
        },
        () => showing,
    );
}

export function showOnboardingAgain() {
    setShowing(true);
}

function finish() {
    try {
        localStorage.setItem(SEEN_KEY, 'true');
    } catch {
        /* fine: it just shows again next time */
    }
    setShowing(false);
}

const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Steps through `n` states every `ms` while its screen is the one shown. */
function useCycle(n: number, ms: number, active: boolean, from = 0) {
    const [k, setK] = useState(from);
    useEffect(() => {
        if (!active || still()) return;
        const t = window.setInterval(() => setK(x => (x + 1) % n), ms);
        return () => window.clearInterval(t);
    }, [active, n, ms]);
    return k;
}

/* ── the stages ─────────────────────────────────────────────────────── */

/** The logo, with molecules drifting round it. */
function WelcomeStage() {
    const drift: [string, string, CSSProperties][] = [
        ['caffeine', 'tablet', { left: '6%', top: '10%', '--d': '9s', '--r0': '-8deg', '--r1': '4deg' } as CSSProperties],
        ['lsd', 'blotter', { right: '4%', top: '6%', '--d': '11s', '--r0': '6deg', '--r1': '-4deg' } as CSSProperties],
        ['mdma', 'capsule', { left: '2%', bottom: '8%', '--d': '10s', '--r0': '4deg', '--r1': '-6deg' } as CSSProperties],
        ['mushrooms', 'capsule', { right: '6%', bottom: '10%', '--d': '12s', '--r0': '-5deg', '--r1': '5deg' } as CSSProperties],
    ];
    return (
        <div className="relative h-full w-full">
            {drift.map(([id, form, style]) => (
                <span key={id} className="ob-float absolute opacity-60" style={style}>
                    <Molecule id={id} form={form as 'capsule'} size="lg" />
                </span>
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
                <img
                    src="/logo.png"
                    alt=""
                    width={124}
                    height={124}
                    className="ob-pop size-[124px] rounded-[28px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]"
                />
            </div>
        </div>
    );
}

const BANDS = [
    { v: 30, name: 'Light', tone: 'text-[var(--status-info)]' },
    { v: 113, name: 'Common', tone: 'text-[var(--accent-ink)]' },
    { v: 225, name: 'Strong', tone: 'text-[var(--warning)]' },
];
const bandFor = (v: number) => (v >= 150 ? BANDS[2] : v >= 75 ? BANDS[1] : BANDS[0]);

const GLIDE_MS = 1100;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** A value that glides to each new target, slow in and slow out, frame by frame. */
function useGlide(target: number, ms = GLIDE_MS) {
    const [v, setV] = useState(target);
    const at = useRef(target);
    useEffect(() => {
        if (still()) {
            at.current = target;
            setV(target);
            return;
        }
        const from = at.current;
        const t0 = performance.now();
        let raf = 0;
        const step = (now: number) => {
            const t = Math.min(1, (now - t0) / ms);
            at.current = from + (target - from) * easeInOut(t);
            setV(at.current);
            if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);
    return v;
}

/** LSD's dose, read off its rail: the tick glides from band to band and the
 *  number rolls with it, both easing in and out over the same time. */
function DoseStage({ active }: { active: boolean }) {
    const k = useCycle(BANDS.length, 2800, active, 1);
    const target = BANDS[k].v;
    const v = useGlide(target);
    const b = bandFor(v);
    return (
        <div className="w-full max-w-[22rem]">
            <div className="flex items-center gap-3">
                <Molecule id="lsd" form="blotter" size="sm" />
                <div>
                    <p className="text-sm font-medium text-[var(--text)]">{'LSD'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{'Sublingual, in µg'}</p>
                </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2 font-display font-light leading-none tracking-[-0.035em] text-[3.25rem] text-[var(--text)]">
                <Odometer value={target} decimals={0} places={3} rollMs={GLIDE_MS} gentle />
                <span className="text-sm font-normal tracking-normal text-[var(--text-muted)]">{'µg'}</span>
            </div>
            <div className="mt-1">
                <LevelRail value={v} band={{ low: 75, high: 150 }} domain={[12, 405]} label={b.name} tone={b.tone} />
            </div>
        </div>
    );
}

const PAIRS: [string, string, string, string, Verdict][] = [
    ['alcohol', 'Alcohol', 'ketamine', 'Ketamine', 'Dangerous'],
    ['mdma', 'MDMA', 'cannabis', 'Cannabis', 'Caution'],
    ['lsd', 'LSD', 'mushrooms', 'Mushrooms', 'Synergy'],
    ['caffeine', 'Caffeine', 'l-theanine', 'L-Theanine', 'Low risk'],
];
const TONE: Record<string, string> = {
    danger: 'var(--danger)',
    warning: 'var(--warning)',
    info: 'var(--status-info)',
    positive: 'var(--positive)',
    neutral: 'var(--text-muted)',
};

/** One state giving way to the next: the old one drifts up and fades out
 *  while the new one rises into its place, each easing out, after `delay`. */
function Crossfade({ k, delay = 0, render, className = '' }: { k: number; delay?: number; render: (k: number) => ReactNode; className?: string }) {
    const [leaving, setLeaving] = useState<number | null>(null);
    const shown = useRef(k);
    useEffect(() => {
        if (shown.current === k) return;
        setLeaving(shown.current);
        shown.current = k;
        const t = window.setTimeout(() => setLeaving(null), 900 + delay);
        return () => window.clearTimeout(t);
    }, [k, delay]);
    const style = { '--delay': `${delay}ms` } as CSSProperties;
    return (
        <div className={`relative ${className}`}>
            {leaving !== null && (
                <div key={`out${leaving}`} className="ob-leave absolute inset-x-0 top-0" style={style} aria-hidden="true">
                    {render(leaving)}
                </div>
            )}
            <div key={`in${k}`} className={leaving !== null ? 'ob-enter' : ''} style={style}>
                {render(k)}
            </div>
        </div>
    );
}

/** The mix checker, answering for one pair after another. */
function MixStage({ active }: { active: boolean }) {
    const k = useCycle(PAIRS.length, 3000, active);
    const chips = (i: number) => {
        const [a, an, b, bn] = PAIRS[i];
        return (
            <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="chip chip-static text-[var(--text)]">
                    <Molecule id={a} form="capsule" size="xs" />
                    {an}
                </span>
                <span className="text-[var(--text-muted)]">{'+'}</span>
                <span className="chip chip-static text-[var(--text)]">
                    <Molecule id={b} form="capsule" size="xs" />
                    {bn}
                </span>
            </div>
        );
    };
    const word = (i: number) => {
        const v = VERDICT[PAIRS[i][4]];
        return (
            <div className="flex items-center justify-center gap-2">
                {v.tone === 'positive' && <Clover size={34} />}
                <span className="font-display font-light text-[2.75rem] leading-none tracking-[-0.03em]" style={{ color: TONE[v.tone] }}>
                    {v.label}
                </span>
            </div>
        );
    };
    const meaning = (i: number) => (
        <p className="mx-auto max-w-[18rem] text-xs leading-relaxed text-[var(--text-muted)]">{VERDICT[PAIRS[i][4]].meaning}</p>
    );
    return (
        <div className="w-full max-w-[22rem] text-center">
            <Crossfade k={k} render={chips} />
            <Crossfade k={k} delay={110} render={word} className="mt-6" />
            <Crossfade k={k} delay={220} render={meaning} className="mt-3 min-h-[2.5rem]" />
        </div>
    );
}

/** A night on the journal's clock, and the sessions it keeps. */
function JournalStage({ active }: { active: boolean }) {
    const [now] = useState(() => Date.now());
    const course = (a: number, b: number, c: number, d: number): Course => ({
        firstEffects: a,
        peakStart: b,
        peakEnd: c,
        over: d,
        afterEnd: null,
        total: null,
        spans: {},
    });
    const doses: ChartDose[] = [
        { id: 'a', time: now - 150 * 60_000, color: PALETTE[0], course: course(40, 90, 210, 330), strength: 1, label: 'MDMA' },
        { id: 'b', time: now - 50 * 60_000, color: PALETTE[1], course: course(10, 30, 100, 200), strength: 0.7, label: 'Cannabis' },
    ];
    return (
        <div className="w-full max-w-[24rem]">
            {/* The chart runs a little past its column, as on the journal; here
                that's inside the panel's padding, so nothing is cut off. */}
            <div className="px-4">{active && <SessionChart doses={doses} now={now} />}</div>
            <div className="mt-1 flex flex-col gap-2.5">
                {[
                    [[PALETTE[0], PALETTE[1]], 'Saturday night', 'MDMA and Cannabis', true],
                    [[PALETTE[2]], 'Monday', 'Caffeine', false],
                ].map(([colors, title, what, star]) => (
                    <div key={title as string} className="flex items-center gap-3">
                        <SessionMark colors={colors as string[]} size={24} star={star as boolean} />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-[var(--text)]">{title as string}</span>
                            <span className="block text-xs text-[var(--text-muted)]">{what as string}</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** What stays where. */
function PrivateStage() {
    return (
        <div className="flex w-full max-w-[20rem] flex-col items-center">
            <span className="ob-pop">
                <Doodle name="lock" size={5.5} />
            </span>
            <ul className="mt-5 flex w-full flex-col gap-2.5">
                {['No account needed', 'Kept on this device', 'Encrypted sync, if you want it'].map(t => (
                    <li key={t} className="flex items-center gap-2.5 text-sm text-[var(--text)]">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--accent-subtle)] text-[var(--accent-ink)]">
                            <Check size={13} strokeWidth={2.4} />
                        </span>
                        {t}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ── the story ──────────────────────────────────────────────────────── */

interface Screen {
    kicker: string;
    title: string;
    body: ReactNode;
    stage: (active: boolean) => ReactNode;
}

const SCREENS: Screen[] = [
    {
        kicker: 'Oyama Journal',
        title: 'Know what you take.',
        body: 'Look up over 3,000 substances, check what doesn’t mix, and keep a journal. Free, and kept on this device.',
        stage: () => <WelcomeStage />,
    },
    {
        kicker: 'Look it up',
        title: 'How much, and how long.',
        body: 'Doses by route on a rail from light to heavy, and when it starts, peaks and ends.',
        stage: active => <DoseStage active={active} />,
    },
    {
        kicker: 'Mix',
        title: 'One answer for any mix.',
        body: 'Put two or more together, alcohol and medicines too. The most serious risk comes first.',
        stage: active => <MixStage active={active} />,
    },
    {
        kicker: 'Journal',
        title: 'Remember your nights.',
        body: 'Log what you take. It warns before a redose or a bad mix, and keeps your stats.',
        stage: active => <JournalStage active={active} />,
    },
    {
        kicker: 'Yours',
        title: 'Private by default.',
        body: (
            <>
                {'Information, not advice: start low, test what you have, don’t use alone. '}
                <span className="text-[var(--danger)]">{'If someone is unresponsive or breathing slowly, call emergency services.'}</span>
            </>
        ),
        stage: () => <PrivateStage />,
    },
];

export function Onboarding() {
    const [step, setStep] = useState(0);
    const [drag, setDrag] = useState(0);
    const press = useRef<{ x: number; y: number; t: number; id: number; axis?: 'x' | 'y' } | null>(null);
    const frame = useRef<HTMLDivElement>(null);
    const last = SCREENS.length - 1;

    const go = (n: number) => setStep(Math.max(0, Math.min(last, n)));
    const next = () => (step === last ? finish() : go(step + 1));

    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') go(step + 1);
            else if (e.key === 'ArrowLeft') go(step - 1);
            else if (e.key === 'Escape') finish();
        };
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    });

    // A swipe: sideways moves the screens with the finger; let go past a
    // fifth of the width (or flicked) and it turns.
    const onDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        press.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    };
    const onMove = (e: React.PointerEvent) => {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (!p.axis && Math.hypot(dx, dy) > 8) {
            p.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            if (p.axis === 'x') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        }
        if (p.axis !== 'x') return;
        const edge = (step === 0 && dx > 0) || (step === last && dx < 0);
        setDrag(edge ? dx * 0.3 : dx);
    };
    const onUp = (e: React.PointerEvent) => {
        const p = press.current;
        press.current = null;
        if (!p || p.axis !== 'x') return setDrag(0);
        const dx = e.clientX - p.x;
        const w = frame.current?.clientWidth ?? 360;
        const fast = Math.abs(dx) / Math.max(1, performance.now() - p.t) > 0.5;
        if ((dx < -w / 5 || (fast && dx < -30)) && step < last) go(step + 1);
        else if ((dx > w / 5 || (fast && dx > 30)) && step > 0) go(step - 1);
        setDrag(0);
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={'Introduction'}
            className="fixed inset-0 z-50 flex h-[100dvh] w-full select-none flex-col bg-[var(--bg)] font-sans text-[var(--text)]"
        >
            <div className="mx-auto flex w-full max-w-lg shrink-0 items-center gap-2.5 px-6 pt-[calc(0.875rem+env(safe-area-inset-top,0px))]">
                <img src="/logo.png" alt="" width={30} height={30} className="size-[30px] rounded-[8px]" />
                <span className="font-display text-[1.25rem] leading-none tracking-[-0.015em]">
                    <span className="font-normal text-[var(--text)]">{'Oyama'}</span>{' '}
                    <span className="font-light text-[var(--text-muted)]">{'Journal'}</span>
                </span>
                <button
                    type="button"
                    onClick={finish}
                    className={`ms-auto rounded-full px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] ${step === last ? 'invisible' : ''}`}
                    tabIndex={step === last ? -1 : 0}
                >
                    {'Skip'}
                </button>
            </div>

            <div
                ref={frame}
                className="relative mx-auto w-full max-w-lg flex-1 overflow-hidden"
                style={{ touchAction: 'pan-y' }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
            >
                <div
                    className="flex h-full"
                    style={{
                        transform: `translate3d(calc(${-step * 100}% + ${drag}px), 0, 0)`,
                        transition: drag || still() ? 'none' : 'transform 560ms cubic-bezier(0.22, 0.9, 0.24, 1)',
                    }}
                >
                    {SCREENS.map((s, k) => (
                        <section
                            key={s.kicker}
                            className="ob-screen flex h-full w-full shrink-0 flex-col px-6 pt-5"
                            data-active={k === step}
                            aria-hidden={k !== step}
                            {...(k === step ? {} : { inert: '' })}
                        >
                            <div className="ob-stage relative grid min-h-[15rem] flex-1 max-h-[24rem] place-items-center overflow-hidden rounded-[1.75rem] bg-[var(--surface-muted)] px-6 py-6">
                                {s.stage(k === step)}
                            </div>
                            <div className="pt-7 pb-4">
                                <p className="ob-rise text-sm font-semibold text-[var(--accent-ink)]" style={{ '--i': 0 } as CSSProperties}>
                                    {s.kicker}
                                </p>
                                <h1 className="ob-rise mt-2 font-display text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.03em]" style={{ '--i': 1 } as CSSProperties}>
                                    {s.title}
                                </h1>
                                <p className="ob-rise mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]" style={{ '--i': 2 } as CSSProperties}>
                                    {s.body}
                                </p>
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            <div className="mx-auto w-full max-w-lg shrink-0 px-6 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                <div className="mb-4 flex gap-1.5" aria-hidden="true">
                    {SCREENS.map((s, k) => (
                        <button
                            key={s.kicker}
                            type="button"
                            tabIndex={-1}
                            onClick={() => go(k)}
                            className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
                        >
                            <span
                                className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out"
                                style={{ width: k <= step ? '100%' : '0%' }}
                            />
                        </button>
                    ))}
                </div>
                <p className="sr-only" aria-live="polite">{`Step ${step + 1} of ${SCREENS.length}`}</p>
                <div className="flex items-center gap-3">
                    {step > 0 && (
                        <button type="button" onClick={() => go(step - 1)} className="btn-secondary !px-3" aria-label={'Back'}>
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    <button type="button" onClick={next} className="btn-primary flex-1">
                        {step === last ? 'Get started' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
}
