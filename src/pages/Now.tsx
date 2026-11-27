import { useEffect, useMemo, useState } from 'react';
import { AlcoholLine } from '../components/AlcoholLine';
import { ParacetamolLine } from '../components/JournalNotes';
import { Link } from '../components/Link';
import { Molecule } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SessionChart, phaseAt, type ChartDose } from '../components/SessionChart';
import { ShareNight, CheckIn } from '../components/ShareNight';
import { loadCombos, type ComboMatrix, type IndexEntry } from '../lib/data';
import { tr } from '../lib/i18n';
import { colorOf, logFrom, sessionsOf, useJournal } from '../lib/journal';
import { RANK } from '../lib/mix';
import { Interactions, chartDoses, clock, pairsOf, sessionEnd, since, useDetails, useNow } from './Journal';

/* The night that's going on, on one screen, for someone who isn't at their
   sharpest: the time, where each thing taken is on its course and about
   when it's over, and two large buttons. The journal's own page says the
   same in smaller type between other things.

   "I don't feel right" asks first whether it's an emergency, with the
   emergency page's own signs. If it isn't, it says what FRANK says to do
   for someone panicking or hallucinating, turned to the reader, and keeps
   a slow breath going on screen. */

const muted = 'text-[var(--text-muted)]';
const big = 'w-full min-h-14 rounded-[var(--radius-lg)] px-5 text-base font-semibold';
const FRANK = 'https://www.talktofrank.com/get-help/what-to-do-in-an-emergency';

/** Keeps the screen on while this page shows, where the browser can. */
function useScreenOn(on: boolean) {
    useEffect(() => {
        if (!on) return;
        type Lock = { release(): Promise<void> };
        const wake = (navigator as Navigator & { wakeLock?: { request(kind: 'screen'): Promise<Lock> } }).wakeLock;
        if (!wake) return;
        let lock: Lock | null = null;
        let gone = false;
        const take = () => {
            if (document.visibilityState !== 'visible') return;
            wake.request('screen')
                .then(l => {
                    if (gone) void l.release();
                    else lock = l;
                })
                .catch(() => {});
        };
        take();
        document.addEventListener('visibilitychange', take);
        return () => {
            gone = true;
            document.removeEventListener('visibilitychange', take);
            void lock?.release().catch(() => {});
        };
    }, [on]);
}

/** A slow breath to follow: in for four seconds, out for six. */
function Breath() {
    const [inward, setInward] = useState(true);
    useEffect(() => {
        const t = window.setTimeout(() => setInward(i => !i), inward ? 4000 : 6000);
        return () => window.clearTimeout(t);
    }, [inward]);
    return (
        <div className="flex flex-col items-center py-6" aria-live="off">
            <div className="grid size-40 place-items-center">
                <div className="breath-ring size-40 rounded-full border-2 border-[var(--accent)]" data-in={inward} />
            </div>
            <p className="mt-4 text-lg text-[var(--text)]">{inward ? tr('Breathe in') : tr('Breathe out')}</p>
        </div>
    );
}

function NotRight({ ends }: { ends: { label: string; at: number }[] }) {
    return (
        <section className="mt-6 space-y-5 text-base leading-7 text-[var(--text)]" aria-label={tr('I don’t feel right')}>
            <div>
                <p className="font-semibold text-[var(--danger)]">{tr('Call an ambulance now if you, or someone with you:')}</p>
                <ul className="list-disc ps-5 mt-2 space-y-1.5">
                    <li>{tr('can’t be woken')}</li>
                    <li>{tr('is struggling to breathe, breathing very slowly, or not breathing')}</li>
                    <li>{tr('has blue or grey lips or fingertips')}</li>
                    <li>{tr('is having a seizure')}</li>
                    <li>{tr('is very hot and confused, or hot with dry skin')}</li>
                </ul>
                <Link to={{ page: 'emergency' }} className={`${big} mt-4 flex items-center justify-center bg-[var(--danger)] text-white no-underline`}>
                    {tr('In an emergency')}
                </Link>
            </div>
            <div>
                <p className="font-semibold">{tr('If it’s fear, and none of those:')}</p>
                <ul className="list-disc ps-5 mt-2 space-y-1.5">
                    <li>{tr('Go somewhere quiet and calm.')}</li>
                    <li>{tr('Keep away from bright lights and loud noise.')}</li>
                    <li>{tr('Breathe slowly and deeply.')}</li>
                    <li>{tr('Ask someone to stay with you until you feel better.')}</li>
                </ul>
                {ends.map(e => (
                    <p key={e.label} className="mt-3">
                        {tr('It passes: {0} is usually over around {1}.', { 0: e.label, 1: clock(e.at) })}
                    </p>
                ))}
                <Breath />
                <p className={`text-sm ${muted}`}>
                    <a href={FRANK} target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px]" lang="en">
                        FRANK: What to do in an emergency
                    </a>
                    {tr('. To talk to someone now: ')}
                    <a href="https://tripsit.me/webchat" target="_blank" rel="noopener noreferrer" className="underline underline-offset-[3px]">
                        tripsit.me/webchat
                    </a>
                    {tr(' (in English).')}
                </p>
            </div>
        </section>
    );
}

export function Now({ byId }: { byId: Map<string, IndexEntry> }) {
    const { data } = useJournal();
    const now = useNow();
    const [matrix, setMatrix] = useState<ComboMatrix>();
    const [help, setHelp] = useState(false);
    useEffect(() => {
        document.title = tr('Now');
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);

    const latest = useMemo(() => sessionsOf(data.ingestions)[0], [data.ingestions]);
    const details = useDetails(latest ? latest.ingestions : [], byId);
    const live = latest && now < sessionEnd(latest, details) + 60 * 60_000 ? latest : null;
    useScreenOn(!!live);

    const doses: ChartDose[] = live ? chartDoses(live, details, s => colorOf(data, s)) : [];
    // The latest dose of each thing taken says where it is.
    const latestOf = new Map<string, ChartDose>();
    for (const d of doses) {
        const k = d.label ?? d.id;
        if (!latestOf.has(k) || latestOf.get(k)!.time < d.time) latestOf.set(k, d);
    }
    const courses = [...latestOf.values()];
    const ends = courses.filter(d => d.course && now < d.time + d.course.over * 60_000).map(d => ({ label: d.label ?? '', at: d.time + d.course!.over * 60_000 }));
    const t = new Date(now);
    const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;

    return (
        <div className="md:pb-32">
            <PageHeader backTo title={tr('Now')} />
            <div className={`${PAGE_COLUMN} mt-2 pb-12`}>
                <p className="font-display font-light text-[4.5rem] leading-none tracking-[-0.04em] tabular-nums text-[var(--text)]" aria-label={tr('The time is {0}', { 0: time })}>
                    {time}
                </p>

                {!live ? (
                    <>
                        <p className={`mt-4 text-base ${muted}`}>{tr('Nothing is going on now: no dose in the journal is still working.')}</p>
                        <button type="button" className={`${big} mt-6 bg-[var(--accent)] text-[var(--on-accent,white)]`} onClick={() => logFrom({ time: Date.now() })}>
                            {tr('Log a dose')}
                        </button>
                    </>
                ) : (
                    <>
                        <p className={`mt-2 text-base ${muted}`}>{tr('Started {0}, {1} in', { 0: clock(live.start), 1: since(live.start, now) })}</p>

                        <CheckIn />

                        <ul className="mt-6 space-y-4">
                            {courses.map(d => {
                                const end = d.course ? d.time + d.course.over * 60_000 : null;
                                // Its structure beside its name, as everywhere a substance is shown.
                                const e = byId.get(live.ingestions.find(i => i.id === d.id)?.substance ?? '');
                                return (
                                    <li key={d.id} className="flex items-start gap-3">
                                        {e && (
                                            <span className="mt-1 shrink-0">
                                                <Molecule id={e.id} form={e.form} size="sm" />
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xl font-semibold leading-7 [overflow-wrap:anywhere]" style={{ color: d.color }}>
                                                {d.label}
                                            </p>
                                            <p className="text-lg leading-7 text-[var(--text)]">
                                                {end == null
                                                    ? tr('How long it lasts isn’t documented.')
                                                    : now >= end
                                                      ? tr('Over.')
                                                      : tr('{0}, over around {1}', { 0: phaseAt(d, now).replace(/^./, c => c.toUpperCase()), 1: clock(end) })}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        <div className="mt-6">
                            <SessionChart doses={doses} now={now} />
                            <AlcoholLine s={live} now={now} />
                            <ParacetamolLine doses={live.ingestions} now={now} />
                        </div>
                        <div className="mt-3">
                            <Interactions pairs={pairsOf(live, byId, details, matrix).filter(p => RANK[p.verdict] >= RANK.Caution)} />
                        </div>

                        <div className="mt-8 flex flex-col gap-3">
                            <button type="button" className={`${big} bg-[var(--accent)] text-[var(--on-accent,white)]`} onClick={() => logFrom({ time: Date.now() })}>
                                {tr('Log a dose')}
                            </button>
                            <button
                                type="button"
                                className={`${big} border-(length:--hairline) border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--surface-hover)]`}
                                aria-expanded={help}
                                onClick={() => setHelp(h => !h)}
                            >
                                {tr('I don’t feel right')}
                            </button>
                        </div>
                        {help && <NotRight ends={ends} />}

                        <ShareNight byId={byId} />

                        <p className={`mt-8 text-xs ${muted}`}>{tr('Times are estimates from typical durations; yours can differ. The screen stays on while this page is open, where the browser allows it.')}</p>
                    </>
                )}
            </div>
        </div>
    );
}
