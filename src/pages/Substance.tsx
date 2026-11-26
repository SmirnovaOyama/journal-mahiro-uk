import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    describe,
    resolveName,
    nameOf,
    squash,
    type ActHow,
    type BodyStep,
    type Combination,
    type ComboStatus,
    type Detail,
    type Quoted,
    type IndexEntry,
    convertAmount,
    fmtAmount,
    isPerKg,
} from '../lib/data';
import { historyOf, logFrom, useJournal } from '../lib/journal';
import { RANK } from '../lib/mix';
import { pushRecent, useSaved, formatWeight, useWeight } from '../lib/store';
import { courseFor, formatMinutes } from '../lib/time';
import { useDetail } from '../lib/useIndex';
import { DoseRuler } from '../components/DoseRuler';
import { Absorption } from '../components/Absorption';
import { hrtLine, isHrt, sparkleFrom, toast } from '../lib/eggs';
import Doodle, { Route } from '../components/Doodle';
import { Fold } from '../components/Fold';
import { Link } from '../components/Link';
import { Molecule, useStructure } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN, headerAction, headerActionAccent } from '../components/PageHeader';
import Segmented from '../components/Segmented';
import { rowBleed } from '../components/SettingsListItem';
import { Timeline } from '../components/Timeline';
import { Alert, ChevronRight, Clover, External, Heart, Info, Plus } from '../components/icons';
import { Waiting } from '../components/Waiting';
import { Linked } from '../components/Linked';
import { dataText, dateLocale, isZh, roaName, spanText, tr } from '../lib/i18n';

/** A link's line. The sync writes a handful of these, in English. */
const linkSays = (d: string) => {
    if (d.startsWith('zh:')) return tr(d.slice(3));
    const m = d.match(/^Structured data on (.+)$/);
    return m ? tr('Structured data on {0}', { 0: m[1] }) : tr(d);
};

const MIX_GROUPS: {
    title: string;tone: string;
    says: string;statuses: ComboStatus[];
}[] = [
    {
        title: 'Don’t mix with',
        tone: 'danger',
        says: 'Combinations that can cause serious harm.',
        statuses: ['Dangerous', 'Unsafe'],
    },
    {
        title: 'Take care with',
        tone: 'warning',
        says: 'Can feel bad or overwhelming. Lower both doses.',
        statuses: ['Caution'],
    },
    {
        title: 'Stronger together',
        tone: 'info',
        says: 'Low risk if you take less of each.',
        statuses: ['Synergy'],
    },
    {
        title: 'Low risk',
        tone: 'positive',
        says: 'No harmful interaction known.',
        statuses: ['Low risk', 'Decrease'],
    },
];


function routesOf(d: Detail): string[] {
    const seen: string[] = [];
    for (const r of [...d.doseRows, ...d.durationRows]) if (!seen.includes(r.roa)) seen.push(r.roa);
    return seen;
}

/** One entry per name, keeping the most serious status any source gave. */
function dedupe(combos: Combination[]): Combination[] {
    const best = new Map<string, Combination>();
    for (const c of combos) {
        const k = squash(c.substance);
        const prev = best.get(k);
        if (!prev || RANK[c.status] > RANK[prev.status]) best.set(k, c);
    }
    return [...best.values()].sort((a, b) => a.substance.localeCompare(b.substance));
}

/** Ends a line from the data with a full stop if it has none. */
function sentence(s: string) {
    const t = s.trim();
    return /[.!?。！？]$/.test(t) ? t : `${t}${/[\u3000-\u9fff]/.test(t) ? '。' : '.'}`;
}

function cap(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 - 2 weeks", "7 days", "2.5 months" as milliseconds, taking the longer
 *  end of a range: when it should surely be back to normal. */
function resetAfter(s?: string): number | null {
    const m = s?.match(/([\d.]+)(?:\s*[-–]\s*([\d.]+))?\s*(hour|day|week|month)/i);
    if (!m) return null;
    const n = parseFloat(m[2] ?? m[1]);
    const unit = { hour: 3600_000, day: 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000 }[m[3].toLowerCase() as 'hour'];
    return Number.isFinite(n) ? n * unit : null;
}

/** What a substance does to the things it binds to: the plain word, and
 *  the pharmacologist's under it where that says more. Said through tr(). */
const ACTS: Record<ActHow, [string, string]> = {
    agonist: ['Activates', 'agonist'],
    'partial agonist': ['Partly activates', 'partial agonist'],
    activator: ['Activates', 'activator'],
    'positive modulator': ['Strengthens', 'positive modulator'],
    inhibitor: ['Inhibits', 'inhibitor'],
    antagonist: ['Blocks', 'antagonist'],
    'inverse agonist': ['Turns down', 'inverse agonist'],
    'negative modulator': ['Weakens', 'negative modulator'],
    blocker: ['Blocks', 'channel blocker'],
    modulator: ['Modulates', ''],
    ligand: ['Binds to', ''],
};

/** The targets as they read in a line: the receptors together, said once
 *  ("5-HT1A, 5-HT2A, Dopamine D2 receptors"), then the rest. */
function targetNames(on: string[]): string[] {
    const receptors = on.filter(t => / receptor$/.test(t)).map(t => t.replace(/ receptor$/, ''));
    const rest = on.filter(t => !/ receptor$/.test(t));
    if (receptors.length) receptors[receptors.length - 1] += receptors.length > 1 ? ' receptors' : ' receptor';
    return [...receptors, ...rest];
}

/** What the body does with a dose: the plain word, and the pharmacologist's under it. Said through tr(). */
const BODY: Record<BodyStep, [string, string]> = {
    absorbed: ['Gets into the blood', 'bioavailability'],
    onset: ['Starts working', 'onset'],
    lasts: ['Lasts', 'duration of action'],
    halfLife: ['Half-life', 'time for half of it to go'],
    brokenDown: ['Broken down', 'metabolism'],
    turnsInto: ['Turns into', 'metabolites'],
    leaves: ['Leaves the body', 'excretion'],
};

const wikipedia = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/** A chemical formula as it's written: C8H10N4O2 with its figures set low,
 *  and a charge, if it has one, set high. */
function Formula({ of }: { of: string }) {
    const parts = of.match(/[A-Z][a-z]?|\d+|[+-]\d*|./g) ?? [];
    return (
        <span className="whitespace-nowrap">
            {parts.map((p, i) => (/^\d+$/.test(p) ? <sub key={i}>{p}</sub> : /^[+-]/.test(p) ? <sup key={i}>{p}</sup> : p))}
        </span>
    );
}

/** A row of facts: what it's about, a smaller word under it, and what's said. */
function Fact({ about, sub, children }: { about: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="fact-row">
            <dt>
                {about}
                {sub && <span className="fact-sub block">{sub}</span>}
            </dt>
            <dd>{children}</dd>
        </div>
    );
}

/** Where a quote is from, linked to the place in the article; and where the
 *  rows beside it are from (`figures`: a Wikipedia article's infobox), if
 *  that's somewhere else. */
function QuotedFrom({ q, figures, also }: { q: Quoted; figures?: string; also?: React.ReactNode }) {
    const what = q.source === 'PsychonautWiki' ? tr('PsychonautWiki’s page on {0}', { 0: q.page ?? '' }) : tr('Wikipedia’s article on {0}', { 0: q.page ?? '' });
    const same = !!q.text && q.source === 'Wikipedia' && q.page === figures;
    if (!q.text && !figures && !also) return null;
    return (
        <p className="footnote">
            {q.text && (
                <>
                    {tr('From ')}
                    {q.url ? (
                        <a href={q.url} target="_blank" rel="noreferrer">
                            {what}
                        </a>
                    ) : (
                        what
                    )}
                    {tr('. ')}
                </>
            )}
            {figures && !same && (
                <>
                    {q.text ? tr('The rows are from ') : tr('From ')}
                    <a href={wikipedia(figures)} target="_blank" rel="noreferrer">
                        {tr('Wikipedia’s article on {0}', { 0: figures })}
                    </a>
                    {tr('. ')}
                </>
            )}
            {also}
        </p>
    );
}

/** Up to the first full stop that ends a sentence: not the ones in "e.g.",
 *  "vs." or an initial, nor one with no new sentence after it. */
function firstSentence(s: string) {
    const zhStop = s.indexOf('。');
    if (/[\u3400-\u9fff]/.test(s.slice(0, 8)) && zhStop > 0) return s.slice(0, zhStop + 1);
    const stop = /[.!?]["”’)]*(?=\s+["“‘(]?[A-Z0-9]|\s*$)/g;
    for (let m = stop.exec(s); m; m = stop.exec(s)) {
        if (s[m.index] === '.' && /(?:\b(?:e\.g|i\.e|vs|etc|approx|ca|cf|Dr|St|No|al)|\b[A-Z])$/.test(s.slice(0, m.index))) continue;
        return s.slice(0, m.index + m[0].length).trim();
    }
    return s;
}

/** A warning as hrt.mahiro.uk words one (components/DoseAdvisory.tsx there):
 *  a small alert in the warning colour and the sentence beside it, no box. */
function Advisory({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-start gap-2 text-sm">
            <span className="icon-line">
                <Alert size={16} strokeWidth={1.75} className="text-[var(--warning)]" />
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere] text-[var(--warning)]">{children}</span>
        </p>
    );
}

/** A section's small title, with whatever controls it on the right, as hrt
 *  titles its timeline. */
function SectionTitle({ title, aside }: { title: string; aside?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 mb-1">
            <h2 className="text-sm font-medium text-[var(--text)] truncate">{title}</h2>
            {aside}
        </div>
    );
}

export function Substance({ id, index, byId }: { id: string; index: IndexEntry[] | null; byId: Map<string, IndexEntry> }) {
    const { detail, failed, loading } = useDetail(id);
    const saved = useSaved();
    const entry = byId.get(id);

    useEffect(() => {
        if (detail) {
            pushRecent(detail.id);
            document.title = nameOf(detail);
        }
    }, [detail]);

    const routes = useMemo(() => (detail ? routesOf(detail) : []), [detail]);
    const [route, setRoute] = useState<string | null>(null);
    const [infoOpen, setInfoOpen] = useState(false);
    const [picked, setPicked] = useState<number | null>(null);
    const journal = useJournal();
    const structure = useStructure(id);
    const inkRef = useRef<HTMLSpanElement>(null);
    const weight = useWeight();
    /** The amount per kilogram of the reader's weight, or a per-kilogram dose
     *  as an amount; nothing for units that aren't a mass. */
    const weightAside = (unit: string, v: number): React.ReactNode => {
        const mass = unit.split('/')[0].trim();
        const isMass = /^(g|mg|μg|µg)$/.test(mass);
        if (!isMass) return null;
        if (isPerKg(unit)) {
            if (!weight.kg)
                return (
                    <Link to={{ page: 'settings', sub: 'weight' }} className="text-[var(--accent-ink)] no-underline">
                        {tr('Set your body weight to see this as an amount')}
                    </Link>
                );
            return tr('≈ {0} {1} at {2}', { 0: fmtAmount(v * weight.kg), 1: mass, 2: formatWeight(weight.kg, weight.unit) });
        }
        if (!weight.kg) return null;
        return tr('{0} {1}/kg at {2}', { 0: fmtAmount(v / weight.kg), 1: unit, 2: formatWeight(weight.kg, weight.unit) });
    };
    const taps = useRef(0);
    const roa = route && routes.includes(route) ? route : routes[0];


    const combos = useMemo(() => (detail ? dedupe(detail.combinations) : []), [detail]);

    if (loading)
        return (
            <>
                <PageHeader title={entry?.name ?? ''} backTo />
                <div className={`${PAGE_COLUMN} py-8`}>
                    <Waiting wide />
                </div>
            </>
        );
    if (failed || !detail)
        return (
            <>
                <PageHeader title={tr('Not found')} backTo />
                <div className={`${PAGE_COLUMN} py-8`}>
                    <p className="text-sm font-semibold">{tr('We don’t have “{0}”', { 0: id })}</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {tr('It may be spelled differently here. ')}
                        <Link to={{ page: 'home' }} move="none">
                            {tr('Search for it')}
                        </Link>
                    </p>
                </div>
            </>
        );

    const dose = detail.doseRows.find(r => r.roa === roa);
    const time = detail.durationRows.find(r => r.roa === roa);
    const isSaved = saved.ids.includes(detail.id);
    const aliases = detail.aliases
        .split(',')
        .map(a => a.trim())
        .filter(a => a && squash(a) !== squash(detail.name));
    // Under its Chinese name, the name the sources use comes first among the others.
    if (isZh() && detail.zh) aliases.unshift(detail.name);
    const limited = detail.status === 'Limited data';
    // In 正體中文, zh.wikipedia's opening where it has one; else the English sources'.
    const zhSummary = isZh() && detail.summaryZh ? detail.summaryZh : '';
    const summary = zhSummary || detail.summary;
    const whatItIs = describe(
        { category: detail.category, chemicalClass: detail.chemicalClass ?? entry?.chemicalClass ?? '' },
    );

    const safety = [
        detail.toxicity?.length && [tr('Toxicity'), cap(detail.toxicity.map(dataText).join(tr('. ')))],
        detail.addictionPotential && [tr('Addiction'), cap(dataText(detail.addictionPotential))],
        detail.halfLife && [tr('Half-life'), dataText(detail.halfLife)],
        detail.marquis && [tr('Marquis reagent'), dataText(detail.marquis)],
    ].filter(Boolean) as [string, string][];

    const routePicker =
        routes.length > 1 ? (
            <Segmented
                options={routes.map(r => ({ id: r, label: roaName(r) }))}
                value={roa}
                onChange={setRoute}
                aria-label={tr('How it’s taken')}
            />
        ) : null;

    const muted = 'text-[var(--text-muted)]';
    // A reference entry (from Wikidata) has no doses, unless FreeODwiki gave it some
    // (scripts/freeodwiki.mjs): then it's read as any other, with a word on where they're from.
    const dosed = detail.doseRows.length > 0;
    const reference = detail.source === 'Wikidata' && !dosed;
    const unchecked = detail.doseRows.some(r => r.source === 'FreeODwiki');
    const how = detail.pharmacology;
    const uses = detail.uses;
    const side = detail.sideEffects;
    const hrt = isHrt(detail.id);

    // What the journal says: the last time it was logged, and whether that's still working.
    const last = historyOf(journal.data.ingestions, detail.id)[0];
    // By the route it was taken; if that isn't documented, the longest any route lasts.
    const lastC = last ? courseFor(detail.durationRows, last.route) : null;
    const lastCourse = lastC?.course ?? null;
    const sinceLast = last ? Math.max(1, Math.round((Date.now() - last.time) / 60000)) : 0;
    const stillOn = !!(last && lastCourse && sinceLast < lastCourse.over && last.time <= Date.now());
    const lastAmount = last ? (last.dose != null ? `${last.estimate ? '~' : ''}${last.dose} ${last.unit}` : tr('an unknown amount')) : '';
    // Tolerance from that dose: when it should be gone, if that's still ahead.
    const resetMs = resetAfter(detail.tolerance?.reset);
    const baseline = last && resetMs ? last.time + resetMs : null;
    const baselineText =
        baseline && baseline > Date.now() && !stillOn
            ? tr(' Tolerance should be back to normal around {0}.', { 0: new Date(baseline).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) })
            : '';

    return (
        <>
            <PageHeader
                title={nameOf(detail)}
                backTo
                actions={
                    <>
                        <button
                            type="button"
                            className={`${headerActionAccent} tap-target`}
                            onClick={() => {
                                // A dose given per kilogram goes in the journal as the amount.
                                const asMg = dose && picked != null && isPerKg(dose.unit) && weight.kg ? convertAmount(picked, dose.unit, 'mg', weight.kg) : null;
                                logFrom({
                                    id: detail.id,
                                    route: roa,
                                    dose: asMg != null ? Math.round(asMg) : (picked ?? undefined),
                                    unit: asMg != null ? 'mg' : dose?.unit,
                                });
                            }}
                        >
                            <Plus size={16} />
                            {tr('Log')}
                        </button>
                        <button
                            type="button"
                            className={`${isSaved ? headerActionAccent : headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
                            aria-pressed={isSaved}
                            aria-label={isSaved ? tr('Saved', undefined, 'bookmark') : tr('Save', undefined, 'bookmark')}
                            onClick={() => saved.toggle(detail.id)}
                        >
                            <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
                            <span className="max-sm:hidden">{isSaved ? tr('Saved', undefined, 'bookmark') : tr('Save', undefined, 'bookmark')}</span>
                        </button>
                    </>
                }
            />

            {/* The reading block, as hrt's Overview header: what it is, any
                warning, then the dose read off its rail, and the way on. */}
            <header className="pt-2 pb-5 border-b-(length:--hairline) border-[var(--border)]">
                <div className={PAGE_COLUMN}>
                    <div className="flex items-center gap-4">
                        {hrt ? (
                            // A hormone: its structure in the flag's colours, and five taps for a burst.
                            <span
                                ref={inkRef}
                                className="trans-ink"
                                onClick={() => {
                                    taps.current += 1;
                                    if (taps.current % 5 === 0) {
                                        sparkleFrom(inkRef.current);
                                        toast(tr('You found it.'));
                                    }
                                }}
                            >
                                <Molecule id={detail.id} form={detail.form} size="lg" />
                            </span>
                        ) : (
                            <Molecule id={detail.id} form={detail.form} size="lg" />
                        )}
                        <div className="min-w-0">
                            <p className="text-sm text-[var(--text)]">{whatItIs}</p>
                            {hrt && hrtLine(detail.id) && <p className="trans-text mt-1 text-xs font-semibold">{hrtLine(detail.id)}</p>}
                            {aliases.length > 0 && (
                                <p className={`text-xs ${muted} mt-1`}>
                                    {tr('Also called ')}
                                    {aliases.slice(0, 6).join(', ')}
                                </p>
                            )}
                            {detail.formula && (
                                <p className="text-sm text-[var(--text)] mt-1">
                                    <Formula of={detail.formula} />
                                    {detail.molarMass != null && <span className={`text-xs ${muted}`}>{tr(', {0} g/mol', { 0: detail.molarMass })}</span>}
                                </p>
                            )}
                            {structure && (
                                <p className={`text-xs ${muted} mt-1`}>
                                    {structure.role === 'active'
                                        ? tr('Drawn: its main active compound, {0}. ', { 0: structure.name })
                                        : structure.role === 'core'
                                          ? tr('Drawn: the family\'s parent structure, {0}. ', { 0: structure.name })
                                          : structure.role === 'example'
                                            ? tr('Drawn: the family\'s best-known member, {0}. ', { 0: structure.name })
                                            : ''}
                                    <a
                                        href={`https://pubchem.ncbi.nlm.nih.gov/compound/${structure.cid}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[var(--text-muted)]"
                                    >
                                        {detail.formula ? tr('Structure and formula from PubChem') : tr('Structure from PubChem')}
                                    </a>
                                </p>
                            )}
                        </div>
                    </div>

                    {last && (
                        <Link
                            to={{ page: 'journal', session: last.id }}
                            className={`mt-4 flex items-start gap-2 text-sm leading-relaxed no-underline ${stillOn ? 'text-[var(--warning)]' : muted}`}
                        >
                            <span>
                                {stillOn
                                    ? lastC!.exact
                                        ? tr('Still working: you logged {0} {1} ago, and it lasts about {2}.', { 0: lastAmount, 1: formatMinutes(sinceLast), 2: formatMinutes(lastCourse!.over) })
                                        : tr('May still be working: you logged {0} {1} ago. Its timing taken that way isn’t documented; other ways, up to {2}.', { 0: lastAmount, 1: formatMinutes(sinceLast), 2: formatMinutes(lastCourse!.over) })
                                    : tr('You last logged {0} {1}.', { 0: lastAmount, 1: sinceLast < 2880 ? tr('{0} ago', { 0: formatMinutes(sinceLast) }) : tr('on {0}', { 0: new Date(last.time).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) }) })}
                                {baselineText}
                            </span>
                        </Link>
                    )}

                    {(limited || unchecked || detail.advisory || detail.warnings?.length) && (
                        <div className="mt-4 space-y-2">
                            {limited && (
                                <Advisory>
                                    {tr('Little is known about this one. Treat any dose as stronger than you expect.')}
                                </Advisory>
                            )}
                            {detail.advisory && <Advisory><Linked text={dataText(detail.advisory)} /></Advisory>}
                            {unchecked && (
                                <Advisory>
                                    {tr('These doses and timings are from FreeODwiki, a community wiki, and no second source here confirms them. Treat them as rough, and start lower than they say.')}
                                </Advisory>
                            )}
                            {detail.warnings?.map(w => (
                                <div key={w.url + w.text.slice(0, 24)}>
                                    <Advisory><Linked text={dataText(w.text)} /> {dataText(w.source)}</Advisory>
                                    {w.report && (
                                        <Link
                                            to={{ page: 'report', id: w.report }}
                                            className={`mt-1 ml-5 inline-flex items-center gap-1.5 text-sm no-underline text-[var(--text)] hover:underline`}
                                        >
                                            <Doodle name="report" size={1.75} />
                                            {tr('Read the full report')}
                                            <ChevronRight size={16} />
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {reference && (
                        <p className={`mt-5 text-sm leading-relaxed ${muted} max-w-prose`}>
                            {tr('A reference entry: what it is, how it works, what it’s used for and what it’s known to interact with, from Wikidata and Wikipedia. No doses are given for it here; for a prescribed medicine, follow the prescription.')}
                        </p>
                    )}

                    {/* Title row: the title unfolds what the numbers rest on;
                        the route is chosen on the right. */}
                    {!reference && (
                    <>
                    <div className="mt-6 flex items-center justify-between gap-3 mb-4">
                        <button
                            type="button"
                            onClick={() => setInfoOpen(o => !o)}
                            aria-expanded={infoOpen}
                            aria-controls="dose-explainer"
                            className={`tap-target group inline-flex min-w-0 items-center gap-1.5 text-left text-sm ${infoOpen ? 'text-[var(--text)]' : muted} hover:text-[var(--text)]`}
                        >
                            <span className="truncate">{tr('How much')}</span>
                            <Info size={13} className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                        </button>
                        {routePicker}
                    </div>
                    <div
                        id="dose-explainer"
                        className="disclosure"
                        data-open={infoOpen}
                        {...(infoOpen ? {} : { inert: '' })}
                    >
                        <div className="disclosure-inner">
                            <div className="pb-5 space-y-3 text-sm leading-relaxed text-[var(--text-muted)] max-w-prose">
                                {detail.doseBasis && (
                                    <p className="callout text-[var(--text)] font-medium">
                                        <Linked text={sentence(dataText(detail.doseBasis.replace(/^Note:\s*/i, '')))} />
                                    </p>
                                )}
                                <p>
                                    {tr('Weigh with a milligram scale; eyeballing powder is how people get hurt. Start at the light end, and with any new batch.')}
                                </p>
                                <p className="text-xs">
                                    {tr('Doses from ')}
                                    {dose?.source ?? 'PsychonautWiki'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {dose ? (
                        <DoseRuler
                            key={detail.id}
                            row={dose}
                            onPick={setPicked}
                            aside={v => weightAside(dose.unit, v)}
                            label={roa ? tr('{0}, in {1}', { 0: roaName(roa), 1: dose.unit }) : dose.unit}
                            footer={
                                <Link
                                    to={{ page: 'mix', ids: [detail.id] }}
                                    className={`${headerActionAccent} tap-target -ml-2.5 no-underline`}
                                >
                                    {tr('Check what it mixes with')}
                                    <ChevronRight size={15} />
                                </Link>
                            }
                        />
                    ) : (
                        <p className={`text-sm ${muted}`}>
                            {tr('No dosage is documented for this route.')}
                        </p>
                    )}
                    <Absorption rows={detail.doseRows} roa={roa} onPick={setRoute} />
                    </>
                    )}
                </div>
            </header>

            <main className={`${PAGE_COLUMN} pt-5 pb-10 md:pb-32 flex flex-col gap-10`}>
                {time ? (
                    <Timeline key={`${detail.id}-${roa}`} row={time} />
                ) : (
                    <div>
                        <SectionTitle title={tr('How long')} />
                        <p className={`text-sm ${muted}`}>
                            {tr('No timing is documented for this route.')}
                        </p>
                    </div>
                )}

                <section>
                    <SectionTitle title={tr('Mixing')} />
                    {combos.length === 0 ? (
                        <p className={`text-sm ${muted}`}>
                            {tr('No combinations are documented. That doesn’t mean any are safe.')}
                        </p>
                    ) : (
                        <div className="grid gap-5 mt-3">
                            {MIX_GROUPS.map(g => {
                                const items = combos.filter(c => g.statuses.includes(c.status));
                                if (!items.length) return null;
                                return (
                                    <div key={g.title}>
                                        <h3 className={`flex items-center gap-1.5 text-xs font-semibold tone-${g.tone}`}>
                                            {g.tone === 'positive' && <Clover size={18} />}
                                            {tr(g.title)}
                                        </h3>
                                        <p className={`text-xs ${muted}`}>{tr(g.says)}</p>
                                        <ul className="flex flex-wrap gap-2 mt-2">
                                            {items.map(c => {
                                                const other = index ? resolveName(index, c.substance) : undefined;
                                                return (
                                                    <li key={c.substance}>
                                                        {other && other.id !== detail.id ? (
                                                            <Link
                                                                to={{ page: 'mix', ids: [detail.id, other.id] }}
                                                                className={`chip chip-${g.tone}`}
                                                            >
                                                                <Molecule id={other.id} form={other.form} size="xs" />
                                                                {nameOf(other)}
                                                            </Link>
                                                        ) : (
                                                            <span className={`chip chip-${g.tone} chip-static`}>
                                                                {dataText(c.substance)}
                                                            </span>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section>
                    <SectionTitle title={tr('More about {0}', { 0: nameOf(detail) })} />
                    <div className="settings-section">
                        {(summary) && (
                            <Fold
                                title={tr('What it is')}
                                icon="molecule"
                                hint={(() => {
                                    const first = firstSentence(summary);
                                    return first.length < summary.trim().length - 2 ? first : undefined;
                                })()}
                            >
                                <p className="text-sm max-w-prose" lang={zhSummary ? undefined : 'en'}><Linked text={summary} /></p>
                                {zhSummary ? (
                                    <p className="footnote">{tr('From {0}.', { 0: tr('the Chinese Wikipedia') })}</p>
                                ) : (
                                    detail.summarySources && <p className="footnote">{tr('From {0}.', { 0: detail.summarySources })}</p>
                                )}
                            </Fold>
                        )}
                        {how && (
                            <Fold
                                title={tr('How it works')}
                                icon="question"
                                hint={
                                    how.text
                                        ? firstSentence(how.text)
                                        : how.acts
                                          ? how.acts.map(a => `${tr(ACTS[a.how][0])} ${targetNames(a.on.slice(0, 3)).join(', ')}`).join('; ')
                                          : (how.kind ?? how.body?.map(r => tr('{0}: {1}', { 0: tr(BODY[r.what][0]), 1: r.says })).join('. '))
                                }
                            >
                                {how.text && <p className="text-sm max-w-prose">{how.text}</p>}
                                {(how.kind || how.acts) && (
                                    <dl className={how.text ? 'mt-2' : undefined}>
                                        {how.kind && <Fact about={tr('Kind of drug')}>{how.kind}</Fact>}
                                        {how.acts?.map(a => (
                                            <Fact key={a.how} about={tr(ACTS[a.how][0])} sub={ACTS[a.how][1] && tr(ACTS[a.how][1])}>
                                                {/* One name never breaks across lines ("5-" / "HT2A"). */}
                                                <span>
                                                    {targetNames(a.on).map((t, k, all) => (
                                                        <React.Fragment key={t}>
                                                            <span className="whitespace-nowrap">{t}</span>
                                                            {k < all.length - 1 ? ', ' : ''}
                                                        </React.Fragment>
                                                    ))}
                                                </span>
                                            </Fact>
                                        ))}
                                    </dl>
                                )}
                                {how.body && (
                                    <>
                                        <h3 className={`group-heading mb-1 ${how.text || how.kind || how.acts ? 'mt-5' : ''}`}>{tr('In the body')}</h3>
                                        <dl>
                                            {how.body.map(r => (
                                                <Fact key={r.what} about={tr(BODY[r.what][0])} sub={tr(BODY[r.what][1])}>
                                                    {r.says}
                                                </Fact>
                                            ))}
                                        </dl>
                                    </>
                                )}
                                <QuotedFrom
                                    q={how}
                                    figures={how.figures}
                                    also={
                                        how.acts && (
                                            <>
                                                {tr('What it binds to is from ')}
                                                <a
                                                    href={`https://www.guidetopharmacology.org/GRAC/LigandDisplayForward?ligandId=${how.guide}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {tr('the Guide to Pharmacology')}
                                                </a>
                                                {tr('. ')}
                                            </>
                                        )
                                    }
                                />
                            </Fold>
                        )}
                        {uses && (
                            <Fold
                                title={tr('What it’s used for')}
                                icon={Route.oral}
                                hint={
                                    uses.text
                                        ? firstSentence(uses.text)
                                        : uses.treats
                                          ? cap(uses.treats.slice(0, 4).join(', '))
                                          : uses.brands
                                            ? tr('Sold as {0}', { 0: uses.brands })
                                            : uses.routes
                                }
                            >
                                {uses.text && <p className="text-sm max-w-prose">{uses.text}</p>}
                                {uses.recreational && <p className="text-sm max-w-prose mt-3">{uses.recreational}</p>}
                                {(uses.treats || uses.brands || uses.routes) && (
                                    <dl className={uses.text ? 'mt-2' : undefined}>
                                        {uses.treats && <Fact about={tr('Listed as a treatment for')}>{cap(uses.treats.join(', '))}</Fact>}
                                        {uses.brands && <Fact about={tr('Sold as')}>{uses.brands}</Fact>}
                                        {uses.routes && <Fact about={tr('Taken')}>{uses.routes}</Fact>}
                                    </dl>
                                )}
                                <QuotedFrom q={uses} figures={uses.figures} also={uses.treats ? tr('What it treats is from Wikidata.') : undefined} />
                            </Fold>
                        )}
                        {side && (
                            <Fold
                                title={tr('Side effects')}
                                icon="caution"
                                hint={
                                    side.text
                                        ? firstSentence(side.text)
                                        : [side.addiction && tr('Addiction: {0}', { 0: side.addiction }), side.dependence && tr('Dependence: {0}', { 0: side.dependence })].filter(Boolean).join(tr('. '))
                                }
                            >
                                {side.text && <p className="text-sm max-w-prose">{side.text}</p>}
                                {(side.addiction || side.dependence) && (
                                    <dl className={side.text ? 'mt-2' : undefined}>
                                        {side.addiction && (
                                            <Fact about={tr('Addiction')} sub={tr('how likely')}>
                                                {side.addiction}
                                            </Fact>
                                        )}
                                        {side.dependence && (
                                            <Fact about={tr('Dependence')} sub={tr('how likely')}>
                                                {side.dependence}
                                            </Fact>
                                        )}
                                    </dl>
                                )}
                                <QuotedFrom q={side} figures={side.figures} />
                            </Fold>
                        )}
                        {safety.length > 0 && (
                            <Fold title={tr('Safety')} icon="shield" hint={safety.map(([k]) => k).join(tr(', '))}>
                                <dl>
                                    {safety.map(([k, v]) => (
                                        <div className="fact-row" key={k}>
                                            <dt>{k}</dt>
                                            <dd>{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </Fold>
                        )}
                        {detail.availability && detail.availability.length > 0 && (
                            <Fold title={tr('Where it’s sold')} hint={detail.availability.map(a => dataText(a.where)).join(tr(', '))}>
                                <div className="grid gap-5">
                                    {detail.availability.map(a => (
                                        <div key={a.where}>
                                            <h3 className="text-sm font-medium">{dataText(a.where)}</h3>
                                            <p className="text-sm max-w-prose mt-1"><Linked text={dataText(a.rule)} /></p>
                                            <p className="footnote !mt-1">
                                                {tr('From ')}
                                                <a href={a.url} target="_blank" rel="noreferrer" className="underline underline-offset-[3px]">
                                                    {dataText(a.source)}
                                                </a>
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </Fold>
                        )}
                        {detail.tolerance && (detail.tolerance.buildUp || detail.tolerance.reset) && (
                            <Fold
                                title={tr('Tolerance')}
                                icon="chart"
                                hint={
                                    detail.tolerance.reset
                                        ? tr('Back to normal after about {0}', { 0: spanText(detail.tolerance.reset) })
                                        : undefined
                                }
                            >
                                <dl>
                                    {detail.tolerance.buildUp && (
                                        <div className="fact-row">
                                            <dt>{tr('Builds up')}</dt>
                                            <dd>{cap(dataText(detail.tolerance.buildUp))}</dd>
                                        </div>
                                    )}
                                    {detail.tolerance.reset && (
                                        <div className="fact-row">
                                            <dt>{tr('Back to normal')}</dt>
                                            <dd>{tr('After about {0}', { 0: spanText(detail.tolerance.reset) })}</dd>
                                        </div>
                                    )}
                                    {detail.tolerance.crossTolerances?.map(c => (
                                        <div className="fact-row" key={c.group}>
                                            <dt>{tr('Also lowers the effect of')}</dt>
                                            <dd>{c.items.map(dataText).join(tr(', '))}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </Fold>
                        )}
                        {detail.subjectiveEffects.length > 0 && (
                            <Fold
                                title={tr('Effects people report')}
                                icon="person"
                                hint={tr('{0} documented effects', { 0: detail.subjectiveEffects.length })}
                            >
                                <ul className="effect-list">
                                    {detail.subjectiveEffects.map(e => (
                                        <li key={e.name}>
                                            {e.url ? (
                                                <a href={e.url} target="_blank" rel="noreferrer">
                                                    {dataText(e.name)}
                                                </a>
                                            ) : (
                                                dataText(e.name)
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </Fold>
                        )}
                        {(detail.helpfulLinks.length > 0 || detail.citations.length > 0) && (
                            <Fold title={tr('Sources and further reading')} icon="report">
                                {detail.helpfulLinks.length > 0 && (
                                    <div className="settings-section">
                                        {/* The zh.wikipedia article, for a reader in Chinese only, and first. */}
                                        {[...detail.helpfulLinks]
                                            .filter(l => isZh() || !l.description.startsWith('zh:'))
                                            .sort((a, b) => Number(b.description.startsWith('zh:')) - Number(a.description.startsWith('zh:')))
                                            .map(l => (
                                            <a
                                                key={l.url}
                                                href={l.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`w-full min-h-14 flex items-center gap-3 py-3 text-[var(--text)] no-underline ${rowBleed}`}
                                            >
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-sm font-medium">{l.title}</span>
                                                    <span className={`block text-xs ${muted} mt-0.5`}>{linkSays(l.description)}</span>
                                                </span>
                                                <External size={18} className={muted} />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {detail.citations.length > 0 && (
                                    <>
                                        <h3 className="group-heading mt-5 mb-2">{tr('Research')}</h3>
                                        <ol className="cites">
                                            {detail.citations.map((c, k) => (
                                                <li key={`${k}-${c.title}`}>
                                                    {c.url ? (
                                                        <a href={c.url} target="_blank" rel="noreferrer">
                                                            {c.title}
                                                        </a>
                                                    ) : (
                                                        c.title
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </>
                                )}
                            </Fold>
                        )}
                    </div>
                </section>
            </main>
        </>
    );
}
