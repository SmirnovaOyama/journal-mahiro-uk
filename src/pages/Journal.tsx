import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { loadCombos, loadDetail, type ComboMatrix, type Detail, type IndexEntry, convertAmount } from '../lib/data';
import {
    RATINGS,
    clearPrefill,
    colorOf,
    historyOf,
    peekPrefill,
    sessionsOf,
    useJournal,
    type Ingestion,
    type JournalData,
    type Prefill,
    type Session,
} from '../lib/journal';
import { RANK, VERDICT, checkPair, type PairResult } from '../lib/mix';
import { go, useOpenedFromLink } from '../lib/router';
import { useAccount } from '../lib/account';
import { isHrt, sparkleFrom, toast } from '../lib/eggs';
import { courseFor, courseOf, formatMinutes } from '../lib/time';
import Doodle from '../components/Doodle';
import { IngestionForm } from '../components/IngestionForm';
import { Link } from '../components/Link';
import PageHeader, { PAGE_COLUMN, headerAction, headerActionAccent } from '../components/PageHeader';
import Segmented from '../components/Segmented';
import Tabs, { useSwitchAnimation } from '../components/Tabs';
import { StackedBars, type Bucket } from '../components/StackedBars';
import { AlcoholLine } from '../components/AlcoholLine';
import { SessionChart, type ChartDose } from '../components/SessionChart';
import { SessionMark, starPath } from '../components/SessionMark';
import { rowBleed } from '../components/SettingsListItem';
import { ChevronDown, ChevronRight, Plus } from '../components/icons';

/* The journal, as PsychonautWiki Journal lays its own out, in Oyama's hand:
   the page's title with Log on the right and the form folding open under
   it; then the session still going, on its clock, with what it holds that
   doesn't mix; then every session before it, newest first, one row each:
   a disc in the colours of what was taken (a star on it for a favourite),
   its name or its day, what was in it, and the time. A session opens to its
   own page: its doses, its total, its rating and notes. Stats sit beside
   the log: sessions month by month, the most used, and each substance's
   own history. */

const muted = 'text-[var(--text-muted)]';
const on = 'text-[var(--text)]';

function clock(t: number) {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayLabel(t: number) {
    const d = new Date(t);
    const today = new Date();
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return 'Today';
    if (same(d, y)) return 'Yesterday';
    return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
}

function ago(t: number, now: number) {
    const m = Math.max(0, Math.round((now - t) / 60000));
    if (m < 1) return 'just now';
    if (m < 60 * 48) return `${formatMinutes(m)} ago`;
    const d = Math.round(m / 1440);
    return `${d} days ago`;
}

const fmtDose = (n: number) => (n >= 100 ? String(Math.round(n)) : String(Math.round(n * 100) / 100));
const amountOf = (i: Ingestion) =>
    i.dose == null ? ('amount unknown') : `${i.estimate ? '~' : ''}${fmtDose(i.dose)} ${i.unit}`;

/** Ticks every minute, so "now" and "2 h ago" stay true while the page is open. */
function useNow() {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(t);
    }, []);
    return now;
}

/** The details of every catalogue substance in these doses, as they load. */
function useDetails(ingestions: Ingestion[], byId: Map<string, IndexEntry>) {
    const [details, setDetails] = useState<Record<string, Detail>>({});
    const ids = useMemo(() => [...new Set(ingestions.map(i => i.substance).filter(s => byId.has(s)))], [ingestions, byId]);
    useEffect(() => {
        for (const id of ids)
            if (!details[id])
                loadDetail(id)
                    .then(d => setDetails(p => ({ ...p, [d.id]: d })))
                    .catch(() => {});
    }, [ids, details]);
    return details;
}

function chartDoses(s: Session, details: Record<string, Detail>, colors: (id: string) => string): ChartDose[] {
    return s.ingestions.map(i => {
        const d = details[i.substance];
        const course = courseOf(d?.durationRows.find(r => r.roa === i.route) ?? (d?.durationRows.length === 1 ? d.durationRows[0] : undefined));
        const row = d?.doseRows.find(r => r.roa === i.route);
        const common = row?.segments?.common;
        // In the row's own unit: 0.1 mg of LSD is 100 µg against its µg doses.
        const amount = i.dose != null && row ? convertAmount(i.dose, i.unit, row.unit) : null;
        const strength = amount != null && common ? amount / ((common[0] + common[1]) / 2) : 1;
        return { id: i.id, time: i.time, color: colors(i.substance), course, strength, label: d?.name ?? i.name };
    });
}

/** When a session is over: its last dose's effects done (or 6 hours on, if not known). */
function sessionEnd(s: Session, details: Record<string, Detail>) {
    return Math.max(
        ...s.ingestions.map(i => {
            const d = details[i.substance];
            // By its own route, or the longest any route lasts: never another
            // route's shorter timing.
            const c = courseFor(d?.durationRows, i.route);
            return i.time + (c ? c.course.over : 360) * 60_000;
        }),
    );
}

function pairsOf(s: Session, byId: Map<string, IndexEntry>, details: Record<string, Detail>, matrix?: ComboMatrix): PairResult[] {
    const ids = [...new Set(s.ingestions.map(i => i.substance).filter(id => byId.has(id)))];
    const out: PairResult[] = [];
    for (let a = 0; a < ids.length; a++)
        for (let b = a + 1; b < ids.length; b++)
            out.push(checkPair(byId.get(ids[a])!, byId.get(ids[b])!, details[ids[a]], details[ids[b]], matrix));
    return out.sort((x, y) => RANK[y.verdict] - RANK[x.verdict]);
}

const TONE_TEXT: Record<string, string> = {
    danger: 'text-[var(--danger)]',
    warning: 'text-[var(--warning)]',
    info: 'text-[var(--status-info)]',
    positive: 'text-[var(--positive)]',
    neutral: 'text-[var(--text-muted)]',
};

/* ── one dose, as a row that opens to be edited ─────────────────────── */

function DoseRow({
    i,
    index,
    byId,
    open,
    onToggle,
}: {
    i: Ingestion;
    index: IndexEntry[] | null;
    byId: Map<string, IndexEntry>;
    open: boolean;
    onToggle: () => void;
}) {
    const { update, remove } = useJournal();
    const entry = byId.get(i.substance);
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className={`w-[calc(100%+1rem)] -mx-2 px-2 py-3 flex items-center gap-3 text-start rounded-[var(--radius-md)] hover:bg-[var(--surface-hover)] ${open ? 'bg-[var(--surface-hover)]' : ''}`}
            >
                <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-3">
                        <span className={`text-sm font-medium ${on} [overflow-wrap:anywhere]`}>{entry?.name ?? i.name}</span>
                        <span className={`text-xs tabular-nums ${muted} shrink-0`}>{clock(i.time)}</span>
                    </span>
                    <span className={`mt-0.5 flex flex-wrap items-baseline gap-x-3 text-xs tabular-nums ${muted}`}>
                        <span className={i.dose != null ? `${on} font-medium` : ''}>{amountOf(i)}</span>
                        <span>{i.route}</span>
                        {i.note && <span className="truncate max-w-[14rem]">{i.note}</span>}
                    </span>
                </span>
                <ChevronDown size={16} className={`chev ${muted} shrink-0 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className="disclosure disclosure-bleed" data-open={open} {...(open ? {} : { inert: '' })}>
                <div className="disclosure-inner">
                    {open && (
                        <div className="pt-3 pb-5">
                            <IngestionForm
                                index={index}
                                byId={byId}
                                editing={i}
                                onSave={next => {
                                    update({ ...i, ...next, id: i.id });
                                    onToggle();
                                }}
                                onCancel={onToggle}
                                onDelete={() => {
                                    remove(i.id);
                                    onToggle();
                                }}
                            />
                            {entry && (
                                <Link to={{ page: 'substance', id: entry.id }} className={`mt-4 inline-flex items-center gap-1 text-sm ${muted}`}>
                                    {`About ${entry.name}`}
                                    <ChevronRight size={15} />
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── what a session holds that doesn't mix ──────────────────────────── */

function Interactions({ pairs }: { pairs: PairResult[] }) {
    const shown = pairs.filter(p => p.verdict !== 'Unknown' || pairs.length <= 3);
    if (!shown.length) return null;
    return (
        <div className="settings-section">
            {shown.map(p => {
                const v = VERDICT[p.verdict];
                return (
                    <Link
                        key={`${p.a.id}+${p.b.id}`}
                        to={{ page: 'mix', ids: [p.a.id, p.b.id] }}
                        className={`w-full min-h-12 flex items-center gap-3 py-2.5 text-start no-underline ${rowBleed}`}
                    >
                        <span className="flex-1 min-w-0">
                            <span className={`block text-sm ${on}`}>
                                {p.a.name} + {p.b.name}
                            </span>
                            <span className={`block text-xs ${muted} mt-0.5`}>{v.meaning}</span>
                        </span>
                        <span className={`text-sm font-semibold shrink-0 ${TONE_TEXT[v.tone]}`}>{v.label}</span>
                        <ChevronRight size={16} className={`${muted} shrink-0 opacity-70`} />
                    </Link>
                );
            })}
            <p className={`pt-2 text-xs ${muted}`}>{'Every pair taken in this session, worst first.'}</p>
        </div>
    );
}

/* ── a session's mark and row ───────────────────────────────────────── */

/** "A", "A and B", "A, B and C". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "24 Nov", or "24 Nov 2023" from another year. */
function shortDate(t: number) {
    const d = new Date(t);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

const substancesOf = (s: Session) => [...new Set(s.ingestions.map(i => i.substance))];
const nameOf = (x: string, s: Session | Ingestion[], byId: Map<string, IndexEntry>) =>
    byId.get(x)?.name ?? (Array.isArray(s) ? s : s.ingestions).find(i => i.substance === x)?.name ?? x;

function SessionRow({ s, data, byId }: { s: Session; data: JournalData; byId: Map<string, IndexEntry> }) {
    const meta = data.meta?.[s.id] ?? {};
    const subs = substancesOf(s);
    return (
        <Link
            to={{ page: 'journal', session: s.id }}
            className={`w-full min-h-16 flex items-center gap-3 py-3 text-start no-underline ${rowBleed}`}
            style={{ '--divider-inset': '2.75rem' } as CSSProperties}
        >
            <SessionMark colors={subs.map(x => colorOf(data, x))} star={!!meta.favorite} />
            <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium ${on} truncate`}>{meta.title || dayLabel(s.start)}</span>
                <span className={`block text-xs ${muted} mt-0.5 truncate`}>{andList(subs.map(x => nameOf(x, s, byId)))}</span>
            </span>
            <span className={`text-xs tabular-nums ${muted} shrink-0`}>{meta.title ? shortDate(s.start) : clock(s.start)}</span>
            <ChevronRight size={16} className={`${muted} shrink-0 opacity-70`} />
        </Link>
    );
}

/** A star, drawn as the icons are: a line, filled when on. */
function Star({ on: filled, size = 17 }: { on: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <path
                d={starPath(12, 12.6, 9.6, 4.2)}
                fill={filled ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
            />
        </svg>
    );
}

/* ── the page ───────────────────────────────────────────────────────── */

export function Journal({
    index,
    byId,
    session,
    view,
    substance,
}: {
    index: IndexEntry[] | null;
    byId: Map<string, IndexEntry>;
    session?: string;
    view?: 'stats';
    substance?: string;
}) {
    if (substance) return <SubstanceHistory id={substance} byId={byId} />;
    if (session) return <SessionPage id={session} index={index} byId={byId} />;
    return <JournalHome index={index} byId={byId} view={view} />;
}

const JOURNAL_TAB_ORDER = ['log', 'stats'] as const;
const JOURNAL_TABS = [
    { id: 'log', label: 'Log' },
    { id: 'stats', label: 'Stats' },
] as const;

function JournalHome({ index, byId, view }: { index: IndexEntry[] | null; byId: Map<string, IndexEntry>; view?: 'stats' }) {
    const { data, add } = useJournal();
    const now = useNow();
    // Opened from a substance's Log: the way back to it.
    const fromLink = useOpenedFromLink();
    const { account } = useAccount();
    const [prefill] = useState<Prefill | null>(() => peekPrefill());
    useEffect(() => clearPrefill(), []);
    const [adding, setAdding] = useState(!!prefill);
    const [onlyStarred, setOnlyStarred] = useState(false);
    const [matrix, setMatrix] = useState<ComboMatrix>();
    useEffect(() => {
        document.title = 'Journal';
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);

    const sessions = useMemo(() => sessionsOf(data.ingestions), [data.ingestions]);
    const latest = sessions[0];
    const details = useDetails(latest ? latest.ingestions : [], byId);
    const live = latest && now < sessionEnd(latest, details) + 60 * 60_000 ? latest : null;
    const color = (s: string) => colorOf(data, s);
    const previous = sessions.filter(s => s !== live && (!onlyStarred || data.meta?.[s.id]?.favorite));
    // Each year its own heading once the record runs past this one.
    const years = new Map<number, Session[]>();
    for (const s of previous) {
        const y = new Date(s.start).getFullYear();
        if (!years.has(y)) years.set(y, []);
        years.get(y)!.push(s);
    }
    const thisYear = new Date().getFullYear();

    const count = sessions.length;
    const tab = view === 'stats' ? 'stats' : 'log';
    const anim = useSwitchAnimation(tab, JOURNAL_TAB_ORDER);
    return (
        <div className="md:pb-32">
            <PageHeader
                title={'Journal'}
                backTo={fromLink}
                subtitle={count ? (count === 1 ? '1 session' : `${count} sessions`) : account ? 'Kept in sync with your account' : 'Only on this device'}
                actions={
                    <>
                        {count > 0 && view !== 'stats' && (
                            <button
                                type="button"
                                className={`${onlyStarred ? headerActionAccent : headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
                                aria-pressed={onlyStarred}
                                aria-label={'Favourites only'}
                                onClick={() => setOnlyStarred(f => !f)}
                            >
                                <Star on={onlyStarred} />
                                <span className="max-sm:hidden">{'Favourites'}</span>
                            </button>
                        )}
                        <button type="button" className={`${adding ? headerAction : headerActionAccent} tap-target`} aria-expanded={adding} onClick={() => setAdding(a => !a)}>
                            <Plus size={16} />
                            {adding ? 'Close' : 'Log'}
                        </button>
                    </>
                }
            />
            <div className={`${PAGE_COLUMN} mt-3 pb-10`}>
                {/* Log and Stats are two panels of the page, so they are tabs
                    like Settings': a strip across the column, straight under
                    the title, that the form opening below never moves. */}
                <Tabs
                    tabs={JOURNAL_TABS}
                    value={tab}
                    onChange={v => go(v === 'stats' ? { page: 'journal', view: 'stats' } : { page: 'journal' }, { replace: true })}
                    className="mb-6"
                />
                <div className="disclosure disclosure-bleed" data-open={adding} {...(adding ? {} : { inert: '' })}>
                    <div className="disclosure-inner">
                        {adding && (
                            <div className="pb-8">
                                <IngestionForm
                                    index={index}
                                    byId={byId}
                                    initial={prefill ?? undefined}
                                    onSave={i => {
                                        add(i);
                                        if (isHrt(i.substance)) {
                                            sparkleFrom(document.activeElement);
                                            toast('Dose logged.');
                                        }
                                        setAdding(false);
                                    }}
                                    onCancel={() => setAdding(false)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div key={tab} className={anim}>
                    {view === 'stats' ? (
                        <Stats byId={byId} now={now} />
                    ) : count === 0 ? (
                        adding ? null : (
                            <div className="flex flex-col items-center text-center pt-6 pb-10">
                                <Doodle name="notebook" size={4.5} />
                                <p className={`mt-4 text-sm font-medium ${on}`}>{'Nothing logged yet'}</p>
                                <p className={`mt-1 text-sm ${muted} max-w-xs`}>
                                    {'Log what you take and when. The journal warns about redosing too soon and about what doesn’t mix. It stays on this device, unless you make an account to sync it.'}
                                </p>
                                <button type="button" className="btn-primary mt-5" onClick={() => setAdding(true)}>
                                    {'Log a dose'}
                                </button>
                            </div>
                        )
                    ) : (
                        <>
                            {live && (
                                <section className="mb-9">
                                    <h2 className="group-heading mb-1">{'Current'}</h2>
                                    <div className="settings-section">
                                        <SessionRow s={live} data={data} byId={byId} />
                                    </div>
                                    <div className="mt-3">
                                        <SessionChart doses={chartDoses(live, details, color)} now={now} />
                                        <AlcoholLine s={live} now={now} />
                                    </div>
                                    <div className="mt-3">
                                        <Interactions pairs={pairsOf(live, byId, details, matrix).filter(p => RANK[p.verdict] >= RANK.Caution)} />
                                    </div>
                                    {/* Thinking of adding something: check it against what's already in. */}
                                    <Link
                                        to={{ page: 'mix', ids: substancesOf(live).filter(x => byId.has(x)) }}
                                        className={`${headerActionAccent} tap-target -ms-2.5 mt-2 no-underline`}
                                    >
                                        {'Check something else against this'}
                                        <ChevronRight size={15} />
                                    </Link>
                                </section>
                            )}

                            {previous.length > 0 ? (
                                [...years.entries()].map(([y, list], k) => (
                                    <section key={y} className="mb-8">
                                        <h2 className="group-heading mb-1">
                                            {k === 0 && (y === thisYear || years.size === 1) ? (live ? 'Previous' : onlyStarred ? 'Favourites' : 'Sessions') : String(y)}
                                        </h2>
                                        <div className="settings-section">
                                            {list.map(s => (
                                                <SessionRow key={s.id} s={s} data={data} byId={byId} />
                                            ))}
                                        </div>
                                    </section>
                                ))
                            ) : onlyStarred ? (
                                <p className={`text-sm ${muted}`}>{'No favourites yet. Open a session and tap its star.'}</p>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── one session ────────────────────────────────────────────────────── */

function SessionPage({ id, index, byId }: { id: string; index: IndexEntry[] | null; byId: Map<string, IndexEntry> }) {
    const { data, add, setMeta } = useJournal();
    const now = useNow();
    const sessions = useMemo(() => sessionsOf(data.ingestions), [data.ingestions]);
    const s = sessions.find(x => x.id === id || x.ingestions.some(i => i.id === id));
    const meta = (s && data.meta?.[s.id]) || {};
    const details = useDetails(s ? s.ingestions : [], byId);
    const [matrix, setMatrix] = useState<ComboMatrix>();
    const [adding, setAdding] = useState(false);
    const [openRow, setOpenRow] = useState<string | null>(null);
    useEffect(() => {
        loadCombos()
            .then(setMatrix)
            .catch(() => {});
    }, []);
    useEffect(() => {
        if (s) document.title = meta.title || dayLabel(s.start);
    }, [s, meta.title]);

    if (!s)
        return (
            <>
                <PageHeader title={'Session'} backTo />
                <div className={`${PAGE_COLUMN} py-8 text-sm ${muted}`}>{'This session isn’t in the journal any more.'}</div>
            </>
        );

    const color = (x: string) => colorOf(data, x);
    const totals = new Map<string, { name: string; sum: number; unit: string; n: number; mixed: boolean }>();
    for (const i of s.ingestions) {
        const k = i.substance;
        const t = totals.get(k) ?? { name: byId.get(k)?.name ?? i.name, sum: 0, unit: i.unit, n: 0, mixed: false };
        t.n++;
        if (i.dose != null) {
            if (t.unit !== i.unit && t.sum) t.mixed = true;
            t.sum += i.dose;
            t.unit = i.unit;
        }
        totals.set(k, t);
    }
    const live = now < sessionEnd(s, details) + 60 * 60_000;

    return (
        <div className="md:pb-32">
            <PageHeader
                title={meta.title || dayLabel(s.start)}
                subtitle={`${meta.title ? `${shortDate(s.start)}, ` : ''}${clock(s.start)}${s.end - s.start > 60_000 ? `–${clock(s.end)}` : ''}`}
                backTo
                actions={
                    <>
                        <button
                            type="button"
                            className={`${meta.favorite ? headerActionAccent : headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
                            aria-pressed={!!meta.favorite}
                            aria-label={meta.favorite ? 'Favourite' : 'Add to favourites'}
                            onClick={() => setMeta(s.id, { favorite: !meta.favorite })}
                        >
                            <Star on={!!meta.favorite} />
                            <span className="max-sm:hidden">{meta.favorite ? 'Favourite' : 'Favourite'}</span>
                        </button>
                        <button type="button" className={`${adding ? headerAction : headerActionAccent} tap-target`} aria-expanded={adding} onClick={() => setAdding(a => !a)}>
                            <Plus size={16} />
                            {adding ? 'Close' : 'Add'}
                        </button>
                    </>
                }
            />
            <div className={`${PAGE_COLUMN} pb-10`}>
                <div className="disclosure disclosure-bleed" data-open={adding} {...(adding ? {} : { inert: '' })}>
                    <div className="disclosure-inner">
                        {adding && (
                            <div className="pt-2 pb-8">
                                <IngestionForm
                                    index={index}
                                    byId={byId}
                                    initial={{ time: live ? Date.now() : s.end + 30 * 60_000 }}
                                    onSave={i => {
                                        add(i);
                                        if (isHrt(i.substance)) {
                                            sparkleFrom(document.activeElement);
                                            toast('Dose logged.');
                                        }
                                        setAdding(false);
                                    }}
                                    onCancel={() => setAdding(false)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <input
                    className={`input-base w-full mb-5 text-base font-medium ${meta.title ? 'is-inked' : ''}`}
                    placeholder={'Name this session'}
                    aria-label={'Session name'}
                    value={meta.title ?? ''}
                    onChange={e => setMeta(s.id, { title: e.target.value })}
                />

                <SessionChart doses={chartDoses(s, details, color)} now={now} />
                <AlcoholLine s={s} now={now} />

                <section className="mt-6">
                    <h2 className="group-heading mb-2">{'How it went'}</h2>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={'Shulgin rating'}>
                        {RATINGS.map(r => (
                            <button
                                type="button"
                                key={r}
                                role="radio"
                                aria-checked={meta.rating === r}
                                className={`chip tabular-nums min-w-11 justify-center ${meta.rating === r ? 'bg-[var(--accent-subtle)] text-[var(--accent-ink)]' : 'chip-static text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                                onClick={() => setMeta(s.id, { rating: meta.rating === r ? undefined : r })}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    <p className={`mt-2 text-xs ${muted}`}>{meta.rating ? SHULGIN[meta.rating] : 'Shulgin’s scale, from nothing (−) to the strongest (++++).'}</p>
                    <textarea
                        rows={3}
                        className={`input-base w-full mt-4 resize-none ${meta.note ? 'is-inked' : ''}`}
                        placeholder={'What happened, how it felt, what you’d do differently…'}
                        aria-label={'Notes'}
                        value={meta.note ?? ''}
                        onChange={e => setMeta(s.id, { note: e.target.value })}
                    />
                </section>

                <section className="mt-8">
                    <h2 className="group-heading mb-1">{'In total'}</h2>
                    <div className="settings-section">
                        {[...totals.entries()].map(([k, t]) => (
                            <Link key={k} to={{ page: 'journal', substance: k }} className={`w-full min-h-12 flex items-center gap-3 py-2.5 no-underline ${rowBleed}`}>
                                <span className={`flex-1 min-w-0 text-sm ${on}`}>{t.name}</span>
                                <span className="text-sm tabular-nums text-end">
                                    <span className={on}>{t.sum && !t.mixed ? `${fmtDose(t.sum)} ${t.unit}` : '—'}</span>
                                    <span className={`${muted} ms-2`}>{t.n === 1 ? 'once' : `${t.n} times`}</span>
                                </span>
                                <ChevronRight size={16} className={`${muted} shrink-0 opacity-70`} />
                            </Link>
                        ))}
                    </div>
                </section>

                {totals.size > 1 && (
                    <section className="mt-8">
                        <h2 className="group-heading mb-1">{'Together'}</h2>
                        <Interactions pairs={pairsOf(s, byId, details, matrix)} />
                    </section>
                )}

                <section className="mt-8">
                    <h2 className="group-heading mb-1">{'Doses'}</h2>
                    {[...s.ingestions].reverse().map(i => (
                        <DoseRow
                            key={i.id}
                            i={i}
                            index={index}
                            byId={byId}
                            open={openRow === i.id}
                            onToggle={() => setOpenRow(o => (o === i.id ? null : i.id))}
                        />
                    ))}
                </section>
            </div>
        </div>
    );
}

/** Each rating in words, as Shulgin set them out. */
const SHULGIN: Record<string, string> = {
    '-': 'Nothing at all.',
    '±': 'A threshold: maybe something, maybe not.',
    '+': 'Something, though what it is isn’t clear yet.',
    '++': 'Clearly there, and its character is plain.',
    '+++': 'Fully there, and it takes over.',
    '++++': 'A rare, transcendent experience.',
};

/* ── charts ─────────────────────────────────────────────────────────── */

const MONTH = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' });

/** Months (or days, or years) back from now, each holding the sessions that began in it. */
function bucketsOf(sessions: Session[], range: '30' | '365' | 'all', now: number, colors: (s: string) => string, order: string[]): Bucket[] {
    const spans: { start: number; end: number; label: string; title: string }[] = [];
    const today = new Date(now);
    if (range === '30') {
        for (let k = 29; k >= 0; k--) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - k);
            const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
            spans.push({ start: d.getTime(), end: e.getTime(), label: String(d.getDate()), title: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) });
        }
    } else {
        const first = range === '365' ? new Date(today.getFullYear(), today.getMonth() - 11, 1) : new Date(Math.min(now, ...sessions.map(s => s.start)));
        const months = (today.getFullYear() - first.getFullYear()) * 12 + today.getMonth() - first.getMonth() + 1;
        if (months > 24) {
            for (let y = first.getFullYear(); y <= today.getFullYear(); y++)
                spans.push({ start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime(), label: String(y), title: String(y) });
        } else {
            for (let k = Math.max(months, 12) - 1; k >= 0; k--) {
                const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
                const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                spans.push({ start: d.getTime(), end: e.getTime(), label: MONTH(d).charAt(0), title: `${MONTH(d)} ${d.getFullYear()}` });
            }
        }
    }
    return spans.map(sp => {
        const share = new Map<string, number>();
        let total = 0;
        for (const s of sessions) {
            if (s.start < sp.start || s.start >= sp.end) continue;
            const subs = substancesOf(s);
            total++;
            // A session counts once, shared out among what was in it.
            for (const x of subs) share.set(x, (share.get(x) ?? 0) + 1 / subs.length);
        }
        const parts = order.filter(x => share.has(x)).map(x => ({ key: x, value: share.get(x)!, color: colors(x) }));
        const counts = order
            .map(x => ({ key: x, n: sessions.filter(s => s.start >= sp.start && s.start < sp.end && s.ingestions.some(i => i.substance === x)).length, color: colors(x) }))
            .filter(c => c.n > 0);
        return { label: sp.label, span: sp.title, parts, total, counts };
    });
}

/* ── stats ──────────────────────────────────────────────────────────── */

const RANGE_DAYS = { '30': 30, '365': 365, all: 0 } as const;
const RANGE_WORDS = { '30': 'in the last 30 days', '365': 'in the last 12 months', all: 'in all' } as const;

function Stats({ byId, now }: { byId: Map<string, IndexEntry>; now: number }) {
    const { data } = useJournal();
    const [range, setRange] = useState<'30' | '365' | 'all'>('365');
    const days = RANGE_DAYS[range];
    const from = days ? now - days * 86_400_000 : 0;
    const sessions = useMemo(() => sessionsOf(data.ingestions).filter(s => s.start >= from && s.start <= now + 86_400_000), [data.ingestions, from, now]);
    const list = useMemo(() => data.ingestions.filter(i => i.time >= from && i.time <= now + 86_400_000), [data.ingestions, from, now]);

    // Each substance: in how many sessions, how many doses, how much, and when last.
    const rows = useMemo(() => {
        const m = new Map<string, { name: string; sessions: number; n: number; sum: number; unit: string; mixed: boolean; last: number }>();
        for (const s of sessions)
            for (const x of substancesOf(s)) {
                const r = m.get(x) ?? { name: nameOf(x, s, byId), sessions: 0, n: 0, sum: 0, unit: '', mixed: false, last: 0 };
                r.sessions++;
                m.set(x, r);
            }
        for (const i of list) {
            const r = m.get(i.substance);
            if (!r) continue;
            r.n++;
            if (i.dose != null) {
                if (r.sum && r.unit !== i.unit) r.mixed = true;
                r.sum += i.dose;
                r.unit = i.unit;
            }
            r.last = Math.max(r.last, i.time);
        }
        return [...m.entries()].sort((a, b) => b[1].sessions - a[1].sessions || b[1].last - a[1].last);
    }, [sessions, list, byId]);

    const color = (x: string) => colorOf(data, x);
    const order = rows.map(([k]) => k);
    const buckets = useMemo(() => bucketsOf(sessions, range, now, color, order), [sessions, range, now, order.join('|'), data.colors]); // eslint-disable-line react-hooks/exhaustive-deps
    const top = rows.slice(0, 5);
    const most = top[0];

    return (
        <div>
            <Segmented
                className="mb-6"
                aria-label={'Over'}
                options={[
                    { id: '30', label: '30 days' },
                    { id: '365', label: '12 months' },
                    { id: 'all', label: 'All' },
                ]}
                value={range}
                onChange={setRange}
            />

            <section className="mb-9">
                <h2 className="group-heading mb-1">{'Sessions'}</h2>
                <p className="flex items-baseline gap-2">
                    <span className="font-display font-light text-[2.5rem] leading-none tracking-[-0.03em] tabular-nums text-[var(--text)]">{sessions.length}</span>
                    <span className={`text-sm ${muted}`}>{`${sessions.length === 1 ? 'session' : 'sessions'} ${RANGE_WORDS[range]}`}</span>
                </p>
                <div className="mt-4">
                    <StackedBars
                        buckets={buckets}
                        names={k => rows.find(([x]) => x === k)?.[1].name ?? k}
                        idle={range === '30' ? 'A bar a day. Tap one to read it.' : 'A bar a month. Tap one to read it.'}
                    />
                </div>
            </section>

            {most && (
                <section className="mb-9">
                    <h2 className="group-heading mb-1">{'Most used'}</h2>
                    <p className="font-display font-light text-[2rem] leading-tight tracking-[-0.02em] text-[var(--text)] truncate">{most[1].name}</p>
                    <div className="mt-3 flex flex-col gap-2.5">
                        {top.map(([k, r]) => (
                            <Link
                                key={k}
                                to={{ page: 'journal', substance: k }}
                                className="group -mx-2 flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1 no-underline hover:bg-[var(--surface-hover)]"
                                aria-label={`${r.name}: ${r.sessions} sessions`}
                            >
                                <span className={`w-24 shrink-0 truncate text-xs ${muted} group-hover:text-[var(--text)]`}>{r.name}</span>
                                <div className="flex-1 h-2.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                                        style={{ width: `${(r.sessions / most[1].sessions) * 100}%`, background: color(k) }}
                                    />
                                </div>
                                <span className={`w-6 shrink-0 text-end text-xs tabular-nums ${muted}`}>{r.sessions}</span>
                                <ChevronRight size={14} className={`${muted} shrink-0 opacity-0 transition-opacity group-hover:opacity-70`} />
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {rows.length ? (
                <section>
                    <h2 className="group-heading mb-1">{'Substances'}</h2>
                    <div className="settings-section">
                        {rows.map(([k, r]) => (
                            <Link
                                key={k}
                                to={{ page: 'journal', substance: k }}
                                className={`w-full min-h-14 flex items-center gap-3 py-2.5 no-underline ${rowBleed}`}
                            >
                                <span className="flex-1 min-w-0">
                                    <span className={`block text-sm font-medium ${on} truncate`}>{r.name}</span>
                                    <span className={`block text-xs ${muted} mt-0.5`}>
                                        {`${r.sessions === 1 ? '1 session' : `${r.sessions} sessions`}, last ${ago(r.last, now)}`}
                                    </span>
                                </span>
                                <span className={`text-sm tabular-nums ${on} shrink-0`}>{r.sum && !r.mixed ? `${fmtDose(r.sum)} ${r.unit}` : ''}</span>
                                <ChevronRight size={16} className={`${muted} shrink-0 opacity-70`} />
                            </Link>
                        ))}
                    </div>
                </section>
            ) : (
                <p className={`text-sm ${muted}`}>{'Nothing logged in this time.'}</p>
            )}
        </div>
    );
}

/* ── one substance's history ────────────────────────────────────────── */

function SubstanceHistory({ id, byId }: { id: string; byId: Map<string, IndexEntry> }) {
    const { data } = useJournal();
    const now = useNow();
    const doses = useMemo(() => historyOf(data.ingestions, id), [data.ingestions, id]);
    const entry = byId.get(id);
    const name = entry?.name ?? doses[0]?.name ?? id;
    const sessions = useMemo(() => sessionsOf(data.ingestions).filter(s => s.ingestions.some(i => i.substance === id)), [data.ingestions, id]);
    useEffect(() => {
        document.title = name;
    }, [name]);
    const color = colorOf(data, id);
    const units = new Set(doses.filter(i => i.dose != null).map(i => i.unit));
    const amounts = doses.filter(i => i.dose != null).map(i => i.dose!);
    // Amounts taken different ways aren't added up: a different share of
    // each gets in. With more than one route, each has its own totals.
    const routes = [...new Set(doses.map(i => i.route))];
    const oneRoute = routes.length === 1;
    const sameUnit = oneRoute && units.size === 1 ? [...units][0] : null;
    const total = amounts.reduce((a, b) => a + b, 0);
    const byRoute = routes.map(r => {
        const ds = doses.filter(i => i.route === r);
        const measured = ds.filter(i => i.dose != null);
        const u = new Set(measured.map(i => i.unit));
        const unit = u.size === 1 ? [...u][0] : null;
        const sum = measured.reduce((a, i) => a + i.dose!, 0);
        return { route: r, n: ds.length, unit, sum, avg: unit && measured.length ? sum / measured.length : null };
    });
    const buckets = useMemo(() => bucketsOf(sessions, '365', now, () => color, [id]), [sessions, now, color, id]);

    return (
        <div className="md:pb-32">
            <PageHeader
                title={name}
                subtitle={doses.length === 1 ? '1 dose' : `${doses.length} doses`}
                backTo
                actions={
                    entry ? (
                        <Link to={{ page: 'substance', id: entry.id }} className={`${headerAction} tap-target no-underline`}>
                            {'About'}
                            <ChevronRight size={15} />
                        </Link>
                    ) : undefined
                }
            />
            <div className={`${PAGE_COLUMN} pb-10`}>
                {doses.length === 0 ? (
                    <p className={`text-sm ${muted}`}>{`Nothing logged for ${name}.`}</p>
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-3 mb-8">
                            {[
                                [ago(doses[0].time, now).replace(' ago', ''), 'since last dose'],
                                [sameUnit && amounts.length ? `${fmtDose(total)} ${sameUnit}` : String(sessions.length), sameUnit && amounts.length ? 'in all' : 'sessions'],
                                [sameUnit && amounts.length ? `${fmtDose(total / amounts.length)} ${sameUnit}` : String(doses.length), sameUnit && amounts.length ? 'on average' : 'doses'],
                            ].map(([v, l]) => (
                                <div key={l}>
                                    <div className="font-display font-light text-[1.5rem] leading-tight tracking-[-0.02em] tabular-nums text-[var(--text)]">{v}</div>
                                    <div className={`mt-0.5 text-xs ${muted}`}>{l}</div>
                                </div>
                            ))}
                        </div>

                        {!oneRoute && (
                            <section className="mb-9">
                                <h2 className="group-heading mb-1">{'By route'}</h2>
                                <div className="settings-section">
                                    {byRoute.map(r => (
                                        <div key={r.route} className="flex min-h-12 items-center justify-between gap-3 py-2.5 text-sm">
                                            <span className={on}>{r.route}</span>
                                            <span className={`text-xs tabular-nums ${muted}`}>
                                                {[
                                                    r.n === 1 ? '1 dose' : `${r.n} doses`,
                                                    r.unit ? `${fmtDose(r.sum)} ${r.unit} in all` : null,
                                                    r.avg != null && r.n > 1 ? `${fmtDose(r.avg)} ${r.unit} on average` : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className={`mt-2 text-xs ${muted}`}>{'Kept apart, as a different share of a dose gets in each way.'}</p>
                            </section>
                        )}

                        <section className="mb-9">
                            <h2 className="group-heading mb-3">{'Sessions in the last 12 months'}</h2>
                            <StackedBars buckets={buckets} names={() => name} idle={'A bar a month. Tap one to read it.'} />
                        </section>

                        <section>
                            <h2 className="group-heading mb-1">{'Every dose'}</h2>
                            <div className="settings-section">
                                {doses.map(i => (
                                    <Link
                                        key={i.id}
                                        to={{ page: 'journal', session: i.id }}
                                        className={`w-full min-h-14 flex items-center gap-3 py-2.5 no-underline ${rowBleed}`}
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className={`block text-sm ${on}`}>{`${dayLabel(i.time)}, ${clock(i.time)}`}</span>
                                            <span className={`block text-xs ${muted} mt-0.5`}>{i.route}</span>
                                        </span>
                                        <span className={`text-sm tabular-nums ${i.dose != null ? on : muted} shrink-0`}>{amountOf(i)}</span>
                                        <ChevronRight size={16} className={`${muted} shrink-0 opacity-70`} />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
