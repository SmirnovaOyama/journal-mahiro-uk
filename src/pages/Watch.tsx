import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '../components/Link';
import { Molecule } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { SessionChart, phaseAt, type ChartDose } from '../components/SessionChart';
import { loadCombos, nameOf, type ComboMatrix, type IndexEntry } from '../lib/data';
import { dateLocale, roaName, tr } from '../lib/i18n';
import { PALETTE, type Ingestion, type Session } from '../lib/journal';
import { RANK } from '../lib/mix';
import { formatMinutes } from '../lib/time';
import { WatchError, dueAt, fetchWatch, type Watched } from '../lib/watch';
import { Interactions, chartDoses, clock, pairsOf, useDetails } from './Journal';

/* Someone else's night, shared with a link (lib/watch.ts): what they've
   logged and where it is on its course, how long since their device last
   spoke, and whether they answered their check-in. The key that opens it
   is in the address after the #, and is read here on the device. This
   page writes nothing and keeps nothing. */

const muted = 'text-[var(--text-muted)]';
const POLL = 30_000;
/** Their device sends every two minutes while its page is open. Past this,
 *  it has gone quiet. */
const QUIET = 6 * 60_000;

function when(t: number, now: number) {
    const d = new Date(t);
    if (d.toDateString() === new Date(now).toDateString()) return clock(t);
    return `${d.toLocaleDateString(dateLocale(), { weekday: 'short' })} ${clock(t)}`;
}

/** A short tone, for a missed check-in. */
function beep() {
    try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.85);
        window.setTimeout(() => void ctx.close(), 1200);
    } catch {
        /* no sound here */
    }
}

export function Watch({ id, byId }: { id: string; byId: Map<string, IndexEntry> }) {
    // Read once: the key never changes, and the address keeps it.
    const key = useMemo(() => window.location.hash.replace(/^#/, ''), []);
    const [night, setNight] = useState<Watched | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'key' | 'offline'>('loading');
    const [now, setNow] = useState(Date.now());
    const [alerts, setAlerts] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');
    const [matrix, setMatrix] = useState<ComboMatrix>();
    const told = useRef(0);

    useEffect(() => {
        document.title = tr('Watching over a night');
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!key) {
            setState('key');
            return;
        }
        let live = true;
        const load = () =>
            fetchWatch(id, key)
                .then(got => {
                    if (!live) return;
                    setNight(got.night);
                    setState('ok');
                })
                .catch(e => {
                    if (!live) return;
                    const code = e instanceof WatchError ? e.code : 'OFFLINE';
                    // What was read stays on screen when the connection drops.
                    setState(code === 'GONE' ? 'gone' : code === 'KEY' ? 'key' : 'offline');
                });
        void load();
        const poll = window.setInterval(load, POLL);
        const tick = window.setInterval(() => setNow(Date.now()), 15_000);
        return () => {
            live = false;
            window.clearInterval(poll);
            window.clearInterval(tick);
        };
    }, [id, key]);

    const doses = useMemo(() => (night?.doses ?? []).map(d => ({ ...d }) as Ingestion), [night]);
    const details = useDetails(doses, byId);
    const session: Session | null = doses.length ? { id: doses[0].id, start: doses[0].time, end: doses[doses.length - 1].time, ingestions: doses } : null;
    const colors = useMemo(() => {
        const m = new Map<string, string>();
        for (const d of doses) if (!m.has(d.substance)) m.set(d.substance, PALETTE[m.size % PALETTE.length]);
        return m;
    }, [doses]);
    const chart: ChartDose[] = session ? chartDoses(session, details, s => colors.get(s) ?? PALETTE[0]) : [];
    const latest = new Map<string, ChartDose>();
    for (const d of chart) {
        const k = d.label ?? d.id;
        if (!latest.has(k) || latest.get(k)!.time < d.time) latest.set(k, d);
    }

    const due = night ? dueAt(night) : null;
    const missed = due != null && now > due;
    const quiet = night ? now - night.sent > QUIET : false;
    // Once for each check-in that's missed, while this page is open.
    useEffect(() => {
        if (!missed || due == null || told.current === due) return;
        told.current = due;
        beep();
        if (alerts)
            try {
                new Notification(tr('A check-in was missed'), { body: tr('Last answered at {0}.', { 0: clock(night!.checked) }), tag: 'watch-missed' });
            } catch {
                /* the page itself still says so */
            }
    }, [missed, due, alerts, night]);

    const who = night?.name;
    const title = who ? tr('Watching over {0}', { 0: who }) : tr('Watching over a night');
    const local = (substance: string, name: string) => (byId.get(substance) ? nameOf(byId.get(substance)!) : name);

    if (state === 'gone' || state === 'key' || (state !== 'ok' && !night))
        return (
            <div>
                <PageHeader title={tr('Watching over a night')} />
                <div className={`${PAGE_COLUMN} mt-3 pb-12 text-base leading-7`}>
                    <p className="font-semibold text-[var(--text)]">
                        {state === 'gone'
                            ? tr('This link has ended.')
                            : state === 'key'
                              ? tr('This link is incomplete.')
                              : state === 'offline'
                                ? tr('Couldn’t reach the server.')
                                : tr('Opening…')}
                    </p>
                    <p className={`mt-1 text-sm ${muted}`}>
                        {state === 'gone'
                            ? tr('The person who shared it stopped sharing, or its 12 hours ran out. A phone call is the way to reach them now.')
                            : state === 'key'
                              ? tr('The part after the # is the key that opens it, and it is missing here. The whole link is needed.')
                              : state === 'offline'
                                ? tr('There is no connection, or the server didn’t answer. This page tries again every half minute.')
                                : ''}
                    </p>
                    <p className="mt-6">
                        <Link to={{ page: 'emergency' }} className="font-semibold text-[var(--danger)] underline underline-offset-[3px]">
                            {tr('In an emergency')}
                        </Link>
                    </p>
                </div>
            </div>
        );
    if (!night) return null;

    return (
        <div className="md:pb-32">
            <PageHeader title={title} subtitle={tr('Shared until {0}', { 0: when(night.expires, now) })} />
            <div className={`${PAGE_COLUMN} mt-3 pb-12`}>
                <section className="space-y-2 text-base leading-7" aria-live="polite">
                    {due != null && (
                        <p className={`text-xl font-semibold ${missed ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                            {missed
                                ? tr('Missed a check-in. Last answered at {0}, {1} ago.', { 0: clock(night.checked), 1: formatMinutes(Math.max(1, Math.round((now - night.checked) / 60000))) })
                                : tr('Checked in at {0}. The next is due by {1}.', { 0: clock(night.checked), 1: clock(due) })}
                        </p>
                    )}
                    <p className={quiet ? 'font-semibold text-[var(--warning)]' : muted}>
                        {quiet
                            ? tr('Nothing from their device for {0}. Its page may be closed, the screen off, or the signal gone.', { 0: formatMinutes(Math.round((now - night.sent) / 60000)) })
                            : tr('Their device last spoke at {0}.', { 0: clock(night.sent) })}
                        {state === 'offline' && ` ${tr('This device has no connection now.')}`}
                    </p>
                    {(missed || quiet) && <p>{tr('Call them, or go to them. If they can’t be woken or aren’t breathing normally, call an ambulance.')}</p>}
                    <p className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                        <Link to={{ page: 'emergency' }} className="font-semibold text-[var(--danger)] underline underline-offset-[3px]">
                            {tr('In an emergency')}
                        </Link>
                        {due != null && typeof Notification !== 'undefined' && !alerts && Notification.permission !== 'denied' && (
                            <button type="button" className="link-button" onClick={() => void Notification.requestPermission().then(p => setAlerts(p === 'granted'))}>
                                {tr('Tell me when a check-in is missed')}
                            </button>
                        )}
                    </p>
                    {due != null && <p className={`text-xs ${muted}`}>{tr('This page sounds a tone when a check-in is missed, for as long as it stays open.')}</p>}
                </section>

                <section className="mt-8">
                    <h2 className="group-heading mb-1">{tr('What was taken')}</h2>
                    {doses.length ? (
                        <ul className="settings-section">
                            {[...doses].reverse().map(i => (
                                <li key={i.id} className="flex items-center gap-3 py-2.5">
                                    <span className={`w-[4.5rem] shrink-0 text-sm tabular-nums ${muted}`}>{when(i.time, now)}</span>
                                    {byId.get(i.substance) && <Molecule id={i.substance} form={byId.get(i.substance)!.form} size="sm" />}
                                    <span className="min-w-0 flex-1">
                                        <Link to={{ page: 'substance', id: i.substance }} className="block font-semibold text-[var(--text)] no-underline [overflow-wrap:anywhere]">
                                            {local(i.substance, i.name)}
                                        </Link>
                                        <span className="block text-sm tabular-nums">
                                            {i.dose == null ? tr('amount unknown') : `${i.estimate ? '~' : ''}${i.dose} ${i.unit}`}, {roaName(i.route)}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={`text-sm ${muted}`}>{tr('Nothing logged yet tonight.')}</p>
                    )}
                    {night.medicines.length > 0 && (
                        <p className="mt-3 text-sm">
                            <span className={muted}>{tr('Takes every day:')} </span>
                            {night.medicines.map(m => local(m.id, m.name)).join(tr(', '))}
                        </p>
                    )}
                    {night.weightKg && (
                        <p className="mt-1 text-sm">
                            <span className={muted}>{tr('Body weight:')} </span>
                            {Number(night.weightKg.toFixed(1))} kg
                        </p>
                    )}
                </section>

                {chart.length > 0 && (
                    <section className="mt-8">
                        <h2 className="group-heading mb-2">{tr('Where it is now')}</h2>
                        <SessionChart doses={chart} now={now} />
                        <div className="mt-2 space-y-1">
                            {[...latest.values()]
                                .filter(d => d.course)
                                .map(d => {
                                    const end = d.time + d.course!.over * 60_000;
                                    return (
                                        <p key={d.id} className="text-sm text-[var(--text)]">
                                            {now >= end ? tr('{0} is over', { 0: d.label ?? '' }) : tr('{0}: {1}, over around {2}', { 0: d.label ?? '', 1: phaseAt(d, now), 2: clock(end) })}
                                        </p>
                                    );
                                })}
                            <p className={`text-xs ${muted}`}>{tr('Times are estimates from typical durations; theirs can differ.')}</p>
                        </div>
                    </section>
                )}

                {session && (
                    <section className="mt-6">
                        <Interactions pairs={pairsOf(session, byId, details, matrix).filter(p => RANK[p.verdict] >= RANK.Caution)} />
                    </section>
                )}

                <p className={`mt-10 text-xs ${muted}`}>
                    {tr('Read on this device with the key in the link. The server that passes it on can’t read it, and this page keeps none of it.')}
                </p>
            </div>
        </div>
    );
}
