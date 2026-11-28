import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import Doodle from '../components/Doodle';
import LevelRail from '../components/LevelRail';
import { Molecule } from '../components/Molecule';
import { Odometer } from '../components/Odometer';
import { SessionChart, type ChartDose } from '../components/SessionChart';
import { SessionMark } from '../components/SessionMark';
import { Check, ChevronLeft, Clover, Heart } from '../components/icons';
import { PALETTE } from '../lib/journal';
import { VERDICT, type Verdict } from '../lib/mix';
import type { Course } from '../lib/time';
import type { DosageForm } from '../components/doodles';
import { tr } from '../lib/i18n';
import { LANG_NAMES, useLang } from '../lib/lang';
import type { Lang } from '../lib/i18n';

/* The intro: a short story told with the app itself. Each screen is a
   stage (a live piece of the site: the dose rail rolling through its bands,
   the mix checker answering, a night on the journal's clock) over a few
   words. Swipe, tap Next or use the arrow keys; the bars at the foot say
   how far along it is. Shown once; Settings can bring it back.

   It opens on the language, so the rest is read in the reader's own, and
   closes on the disclaimer, which has to be agreed to before the site
   opens: Skip and Escape go to it rather than past it. Someone who saw the
   intro before the disclaimer was part of it is shown just that screen. */

const SEEN_KEY = 'journal-onboarding-seen';
/** Bumped when the disclaimer's words change enough to be read again. */
const AGREED_KEY = 'journal-disclaimer-agreed-v1';

const stored = (key: string) => {
    try {
        return localStorage.getItem(key) === 'true';
    } catch {
        return null;
    }
};

// Storage that can't be read at all (some private windows) shows nothing,
// as before, rather than the intro on every page load.
let showing = (() => {
    const seen = stored(SEEN_KEY);
    const agreed = stored(AGREED_KEY);
    if (seen === null || agreed === null) return false;
    return !seen || !agreed;
})();
/** Straight to the disclaimer: the intro was seen before it was added. */
let onlyDisclaimer = stored(SEEN_KEY) === true && stored(AGREED_KEY) === false;
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
        localStorage.setItem(AGREED_KEY, 'true');
    } catch {
        /* fine: it just shows again next time */
    }
    onlyDisclaimer = false;
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

/* The substances the dose screen reads off one after another: each its own
   route, unit, common band and scale, landing in a different band. Bands
   are PsychonautWiki's common range for that route. */
const DOSES: { id: string; name: string; form: DosageForm; route: string; unit: string; band: [number, number]; domain: [number, number]; v: number }[] = [
    { id: 'lsd', name: 'LSD', form: 'blotter', route: 'Sublingual', unit: 'µg', band: [75, 150], domain: [12, 405], v: 113 },
    { id: 'caffeine', name: 'Caffeine', form: 'tablet', route: 'Oral', unit: 'mg', band: [50, 150], domain: [8, 800], v: 35 },
    { id: 'mdma', name: 'MDMA', form: 'capsule', route: 'Oral', unit: 'mg', band: [80, 120], domain: [15, 300], v: 100 },
    { id: 'alcohol', name: 'Alcohol', form: 'dropper', route: 'Oral', unit: 'g', band: [20, 30], domain: [4, 80], v: 36 },
    { id: 'ketamine', name: 'Ketamine', form: 'spray', route: 'Insufflated', unit: 'mg', band: [30, 75], domain: [4, 300], v: 50 },
    { id: '2c-b', name: '2C-B', form: 'tablet', route: 'Oral', unit: 'mg', band: [15, 25], domain: [4, 80], v: 12 },
];
const BANDS = {
    light: { name: 'Light', tone: 'text-[var(--status-info)]' },
    common: { name: 'Common', tone: 'text-[var(--accent-ink)]' },
    strong: { name: 'Strong', tone: 'text-[var(--warning)]' },
};
/** Where `v` sits on a substance's scale, 0 at its left end to 1 at its right. */
const along = (v: number, [lo, hi]: [number, number]) => Math.log(v / lo) / Math.log(hi / lo);
/* Each scale is drawn on one shared 1–1000 rail, so moving from one
   substance to the next glides the reading and the band together. */
const RAIL: [number, number] = [1, 1000];
const onRail = (f: number) => 1000 ** f;

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

/** One substance's dose after another, read off its rail: the tick and the
 *  band glide to the next substance's scale while the number rolls with
 *  them and the name and route give way, all over the same time. */
function DoseStage({ active }: { active: boolean }) {
    const k = useCycle(DOSES.length, 2800, active);
    const d = DOSES[k];
    const v = useGlide(along(d.v, d.domain));
    const low = useGlide(along(d.band[0], d.domain));
    const high = useGlide(along(d.band[1], d.domain));
    const b = v < low - 1e-6 ? BANDS.light : v > high + 1e-6 ? BANDS.strong : BANDS.common;
    // The band's two ends roll to the next substance's as the amount above
    // them does, on the same reels over the same time. Written plain, they
    // changed at once while the band they name was still gliding.
    const mark = (n: number) => <Odometer value={n} decimals={0} places={3} rollMs={GLIDE_MS} gentle />;
    const head = (i: number) => {
        const x = DOSES[i];
        return (
            <div className="flex items-center gap-3">
                <Molecule id={x.id} form={x.form} size="sm" />
                <div>
                    <p className="text-sm font-medium text-[var(--text)]">{tr(x.name)}</p>
                    <p className="text-xs text-[var(--text-muted)]">{tr('{0}, in {1}', { 0: tr(x.route), 1: x.unit })}</p>
                </div>
            </div>
        );
    };
    return (
        <div className="w-full max-w-[22rem]">
            <Crossfade k={k} render={head} />
            <div className="mt-4 flex items-baseline gap-2 font-display font-light leading-none tracking-[-0.035em] text-[3.25rem] text-[var(--text)]">
                <Odometer value={d.v} decimals={0} places={3} rollMs={GLIDE_MS} gentle />
                <Crossfade
                    k={k}
                    delay={110}
                    render={i => <span className="text-sm font-normal tracking-normal text-[var(--text-muted)]">{DOSES[i].unit}</span>}
                />
            </div>
            <div className="mt-1">
                <LevelRail
                    value={onRail(v)}
                    band={{ low: onRail(low), high: onRail(high) }}
                    domain={RAIL}
                    marks={[mark(d.band[0]), mark(d.band[1])]}
                    label={tr(b.name)}
                    tone={b.tone}
                />
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
                    {tr(an)}
                </span>
                <span className="text-[var(--text-muted)]">{'+'}</span>
                <span className="chip chip-static text-[var(--text)]">
                    <Molecule id={b} form="capsule" size="xs" />
                    {tr(bn)}
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
                    {tr(v.label)}
                </span>
            </div>
        );
    };
    const meaning = (i: number) => (
        <p className="mx-auto max-w-[18rem] text-xs leading-relaxed text-[var(--text-muted)]">{tr(VERDICT[PAIRS[i][4]].meaning)}</p>
    );
    return (
        <div className="w-full max-w-[22rem] text-center">
            <Crossfade k={k} render={chips} />
            <Crossfade k={k} delay={110} render={word} className="mt-6" />
            <Crossfade k={k} delay={220} render={meaning} className="mt-3 min-h-[2.5rem]" />
        </div>
    );
}

/** A night on the journal's clock: one session after another, each its
 *  substances' curves in their colours, the "now" line partway through. */
type Dose = [substance: string, minutesAgo: number, course: [number, number, number, number], strength: number];
const SESSIONS: { title: string; what: string; star?: boolean; doses: Dose[] }[] = [
    {
        title: 'Saturday night',
        what: 'MDMA and Cannabis',
        star: true,
        doses: [
            ['MDMA', 150, [40, 90, 210, 330], 1],
            ['Cannabis', 50, [10, 30, 100, 200], 0.7],
        ],
    },
    {
        title: 'Friday',
        what: 'LSD and Cannabis',
        doses: [
            ['LSD', 300, [45, 150, 420, 660], 1],
            ['Cannabis', 90, [10, 30, 100, 200], 0.5],
        ],
    },
    {
        title: 'Thursday',
        what: 'Ketamine, taken twice',
        doses: [
            ['Ketamine', 100, [4, 12, 40, 80], 0.9],
            ['Ketamine', 30, [4, 12, 40, 80], 0.6],
        ],
    },
    {
        title: 'Sunday afternoon',
        what: 'Mushrooms and a Cannabis edible',
        doses: [
            ['Mushrooms', 130, [40, 100, 200, 360], 1],
            ['Cannabis', 70, [60, 150, 330, 540], 0.6],
        ],
    },
    {
        title: 'Monday',
        what: 'Caffeine, twice, and L-Theanine',
        doses: [
            ['Caffeine', 200, [15, 45, 150, 300], 0.9],
            ['L-Theanine', 200, [30, 60, 180, 360], 0.7],
            ['Caffeine', 70, [15, 45, 150, 300], 0.6],
        ],
    },
];
/** Each substance keeps its colour from one session to the next. */
const HUE: Record<string, string> = {
    MDMA: PALETTE[0],
    Cannabis: PALETTE[1],
    LSD: PALETTE[4],
    Ketamine: PALETTE[5],
    Mushrooms: PALETTE[3],
    Caffeine: PALETTE[2],
    'L-Theanine': PALETTE[7],
};

/** How long one night takes to fade before the next is drawn, ms. */
const NIGHT_OUT_MS = 260;

/* The chart's frame (its gridlines) stays where it is the whole time. When
   the next night comes, what's drawn on the frame fades out where it stands,
   with its line underneath, and nothing moves or blurs. Once it has gone,
   the next night is drawn the way the journal draws a session: dots land,
   curves are inked left to right, "now" comes last, and its line settles in
   underneath.

   The chart is drawn again each time this screen is shown. When the screen
   is left, the chart stays standing and slides away with it. */
function JournalStage({ active }: { active: boolean }) {
    const [now] = useState(() => Date.now());
    const k = useCycle(SESSIONS.length, 4200, active);
    // The night on the chart, a step behind `k` while the last one fades.
    const [shown, setShown] = useState(k);
    useEffect(() => {
        if (shown === k) return;
        const t = window.setTimeout(() => setShown(k), still() ? 0 : NIGHT_OUT_MS);
        return () => window.clearTimeout(t);
    }, [k, shown]);
    // Counts the visits, before the paint, so the first frame is already the new drawing.
    const [visit, setVisit] = useState(0);
    useLayoutEffect(() => {
        if (active) setVisit(v => v + 1);
    }, [active]);
    const doses = (i: number): ChartDose[] =>
        SESSIONS[i].doses.map(([name, ago, [a, b, c, d], strength], j) => ({
            id: `${i}-${j}`,
            time: now - ago * 60_000,
            color: HUE[name],
            course: { firstEffects: a, peakStart: b, peakEnd: c, over: d, afterEnd: null, total: null, spans: {} } as Course,
            strength,
            label: tr(name),
        }));
    const s = SESSIONS[shown];
    return (
        <div className="ob-night w-full max-w-[24rem]" data-fading={shown !== k || undefined}>
            {/* Its height kept before the first visit, so the line under it doesn't jump. */}
            <div className="min-h-[196px]">
                {visit > 0 && <SessionChart key={`${visit}-${shown}`} doses={doses(shown)} now={now} />}
            </div>
            <div className="ob-night-fade mt-1">
                <div key={shown} className="ob-night-in flex items-center gap-3">
                    <SessionMark colors={[...new Set(s.doses.map(d => HUE[d[0]]))]} size={24} />
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)]">
                            {tr(s.title)}
                            {s.star && <Heart size={13} fill="currentColor" className="text-[var(--text-muted)]" />}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">{tr(s.what)}</span>
                    </span>
                </div>
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
                {[tr('No account needed'), tr('Kept on this device'), tr('Optional encrypted sync')].map(t => (
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

/** The three languages, each under its own name. */
function LanguageStage() {
    const { lang, setChoice } = useLang();
    const langs: Lang[] = ['zh-Hans', 'zh-Hant', 'en'];
    return (
        <div className="flex w-full max-w-[18rem] flex-col gap-2.5" role="radiogroup" aria-label={tr('Language')}>
            {langs.map(l => {
                const on = l === lang;
                return (
                    <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        lang={l === 'en' ? 'en' : l}
                        onClick={() => void setChoice(l)}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-start text-base transition-colors ${
                            on
                                ? 'border-[var(--accent)] bg-[var(--accent-subtle)] font-semibold text-[var(--accent-ink)]'
                                : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
                        }`}
                    >
                        {LANG_NAMES[l]}
                        {on && <Check size={16} strokeWidth={2.4} />}
                    </button>
                );
            })}
        </div>
    );
}

/** What the reader agrees to before the site opens. The same ground as
 *  Settings › Disclaimer, said shortly. */
const DISCLAIMER_POINTS = [
    'This site is harm-reduction and educational information only. It is not medical advice and not legal advice.',
    'Nothing here encourages, promotes or helps anyone to get or use an illegal drug, and it is not a reason to take anything.',
    'Many of these substances are controlled by law, including in mainland China, Hong Kong and Taiwan. You are responsible for following the law where you are.',
    'Doses, durations and mix warnings come from public sources such as TripSit and PsychonautWiki, and some are AI’s estimates. Any of them can be wrong.',
    'Your journal is your own record. It stays on this device unless you turn on encrypted sync, and what you log is your own responsibility.',
];

function DisclaimerStage() {
    return (
        <div className="h-full w-full self-stretch overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>
            <ul className="flex flex-col gap-3 text-[0.875rem] leading-relaxed text-[var(--text)]">
                {DISCLAIMER_POINTS.map(t => (
                    <li key={t} className="flex gap-2.5">
                        <span className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                        <span>{tr(t)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** The box that has to be ticked before the site opens. */
function Agree({ agreed, onChange }: { agreed: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-snug text-[var(--text)]">
            <input
                type="checkbox"
                checked={agreed}
                onChange={e => onChange(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>{tr('I have read and understood this, and I will follow the law where I am.')}</span>
        </label>
    );
}

/* ── the story ──────────────────────────────────────────────────────── */

interface Screen {
    kicker: string;
    title: string;
    body: ReactNode;
    stage: (active: boolean) => ReactNode;
}

/** The last screen's line, with its warning in red. */
function LastWords() {
    return (
        <>
            {tr('For information only, not advice. Start low, test what you have, and don’t use alone. ')}
            <span className="text-[var(--danger)]">{tr('If someone is unresponsive or breathing slowly, call emergency services.')}</span>
        </>
    );
}

const SCREENS: Screen[] = [
    {
        kicker: 'Language',
        title: 'Choose your language.',
        body: 'You can change it any time in Settings.',
        stage: () => <LanguageStage />,
    },
    {
        kicker: 'Oyama Journal',
        title: 'Know what you take.',
        body: 'Look up over 3,000 substances, check combinations, and keep a journal. Free, and stored on your device.',
        stage: () => <WelcomeStage />,
    },
    {
        kicker: 'Look it up',
        title: 'Doses and durations.',
        body: 'Doses for each route, from light to heavy, and when effects start, peak and end.',
        stage: active => <DoseStage active={active} />,
    },
    {
        kicker: 'Mix',
        title: 'Check any combination.',
        body: 'Check two or more substances together, including alcohol and medicines. The most serious risk is shown first.',
        stage: active => <MixStage active={active} />,
    },
    {
        kicker: 'Journal',
        title: 'Keep a journal.',
        body: 'Log what you take. You’ll be warned before redosing or a risky mix, and you can see your stats.',
        stage: active => <JournalStage active={active} />,
    },
    {
        kicker: 'Yours',
        title: 'Private by default.',
        body: <LastWords />,
        stage: () => <PrivateStage />,
    },
    {
        kicker: 'Before you start',
        title: 'Please read this.',
        body: null, // the box to tick, drawn by Onboarding
        stage: () => <DisclaimerStage />,
    },
];

export function Onboarding() {
    const [step, setStep] = useState(onlyDisclaimer ? SCREENS.length - 1 : 0);
    const [agreed, setAgreed] = useState(false);
    const [drag, setDrag] = useState(0);
    const press = useRef<{ x: number; y: number; t: number; id: number; axis?: 'x' | 'y' } | null>(null);
    const frame = useRef<HTMLDivElement>(null);
    const last = SCREENS.length - 1;

    const go = (n: number) => setStep(Math.max(0, Math.min(last, n)));
    const next = () => (step !== last ? go(step + 1) : agreed && finish());
    const skip = () => go(last);

    useEffect(() => {
        const on = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') go(step + 1);
            else if (e.key === 'ArrowLeft') go(step - 1);
            else if (e.key === 'Escape') skip();
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
            aria-label={tr('Introduction')}
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
                    onClick={skip}
                    className={`ms-auto rounded-full px-3 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-hover)] ${step === last ? 'invisible' : ''}`}
                    tabIndex={step === last ? -1 : 0}
                >
                    {tr('Skip')}
                </button>
            </div>

            {/* The screens and the button under them, as one group: on a
                tall screen it stands in the middle, the button close under
                the words, not pinned to the foot with an empty field between. */}
            <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div
                ref={frame}
                className="relative mx-auto w-full max-w-lg flex-1 max-h-[40rem] overflow-hidden"
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
                                    {tr(s.kicker)}
                                </p>
                                <h1 className="ob-rise mt-2 font-display text-[2.125rem] font-semibold leading-[1.08] tracking-[-0.03em]" style={{ '--i': 1 } as CSSProperties}>
                                    {tr(s.title)}
                                </h1>
                                {s.body && (
                                    <p className="ob-rise mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]" style={{ '--i': 2 } as CSSProperties}>
                                        {typeof s.body === 'string' ? tr(s.body) : s.body}
                                    </p>
                                )}
                                {k === last && (
                                    <div className="ob-rise mt-4" style={{ '--i': 2 } as CSSProperties}>
                                        <Agree agreed={agreed} onChange={setAgreed} />
                                    </div>
                                )}
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
                <p className="sr-only" aria-live="polite">{tr('Step {0} of {1}', { 0: step + 1, 1: SCREENS.length })}</p>
                <div className="flex items-center gap-3">
                    {step > 0 && (
                        <button type="button" onClick={() => go(step - 1)} className="btn-secondary !px-3" aria-label={tr('Back')}>
                            <ChevronLeft size={18} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={next}
                        disabled={step === last && !agreed}
                        className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {step === last ? tr('Agree and start') : tr('Next')}
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
}
