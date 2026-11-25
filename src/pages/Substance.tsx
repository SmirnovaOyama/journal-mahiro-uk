import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    describe,
    resolveName,
    squash,
    type Combination,
    type ComboStatus,
    type Detail,
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
import { Fold } from '../components/Fold';
import { Link } from '../components/Link';
import { Molecule, useStructure } from '../components/Molecule';
import PageHeader, { PAGE_COLUMN, headerAction, headerActionAccent } from '../components/PageHeader';
import Segmented from '../components/Segmented';
import { rowBleed } from '../components/SettingsListItem';
import { Timeline } from '../components/Timeline';
import { Alert, Bookmark, ChevronRight, Clover, External, Info, Plus } from '../components/icons';

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
    return /[.!?]$/.test(t) ? t : `${t}.`;
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

function firstSentence(s: string) {
    const parts = s.match(/[^.!?]+[.!?]+(\s|$)/g);
    return parts ? parts[0].trim() : s;
}

/** A warning as hrt.mahiro.uk words one (components/DoseAdvisory.tsx there):
 *  a small alert in the warning colour and the sentence beside it, no box. */
function Advisory({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-start gap-2 text-sm">
            <span className="icon-line">
                <Alert size={16} strokeWidth={1.75} className="text-[var(--warning)]" />
            </span>
            <span className="min-w-0 text-[var(--warning)]">{children}</span>
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
            document.title = detail.name;
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
                        {'Set your body weight to see this as an amount'}
                    </Link>
                );
            return `≈ ${fmtAmount(v * weight.kg)} ${mass} at ${formatWeight(weight.kg, weight.unit)}`;
        }
        if (!weight.kg) return null;
        return `${fmtAmount(v / weight.kg)} ${unit}/kg at ${formatWeight(weight.kg, weight.unit)}`;
    };
    const taps = useRef(0);
    const roa = route && routes.includes(route) ? route : routes[0];
    const roaName = (r: string) => (r);

    const combos = useMemo(() => (detail ? dedupe(detail.combinations) : []), [detail]);

    if (loading)
        return (
            <>
                <PageHeader title={entry?.name ?? ''} backTo />
                <div className={`${PAGE_COLUMN} py-8 text-sm text-[var(--text-muted)]`}>{'Loading…'}</div>
            </>
        );
    if (failed || !detail)
        return (
            <>
                <PageHeader title={'Not found'} backTo />
                <div className={`${PAGE_COLUMN} py-8`}>
                    <p className="text-sm font-semibold">{`We don’t have “${id}”`}</p>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        {'It may be spelled differently here. '}
                        <Link to={{ page: 'home' }} move="none">
                            {'Search for it'}
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
    const limited = detail.status === 'Limited data';
    const whatItIs = describe(
        { category: detail.category, chemicalClass: detail.chemicalClass ?? entry?.chemicalClass ?? '' },
    );

    const safety = [
        detail.toxicity?.length && ['Toxicity', cap(detail.toxicity.join('. '))],
        detail.addictionPotential && ['Addiction', cap(detail.addictionPotential)],
        detail.halfLife && ['Half-life', detail.halfLife],
        detail.marquis && ['Marquis reagent', detail.marquis],
    ].filter(Boolean) as [string, string][];

    const routePicker =
        routes.length > 1 ? (
            <Segmented
                options={routes.map(r => ({ id: r, label: roaName(r) }))}
                value={roa}
                onChange={setRoute}
                aria-label={'How it’s taken'}
            />
        ) : null;

    const muted = 'text-[var(--text-muted)]';
    const reference = detail.source === 'Wikidata';
    const hrt = isHrt(detail.id);

    // What the journal says: the last time it was logged, and whether that's still working.
    const last = historyOf(journal.data.ingestions, detail.id)[0];
    // By the route it was taken; if that isn't documented, the longest any route lasts.
    const lastC = last ? courseFor(detail.durationRows, last.route) : null;
    const lastCourse = lastC?.course ?? null;
    const sinceLast = last ? Math.max(1, Math.round((Date.now() - last.time) / 60000)) : 0;
    const stillOn = !!(last && lastCourse && sinceLast < lastCourse.over && last.time <= Date.now());
    const lastAmount = last ? (last.dose != null ? `${last.estimate ? '~' : ''}${last.dose} ${last.unit}` : 'an unknown amount') : '';
    // Tolerance from that dose: when it should be gone, if that's still ahead.
    const resetMs = resetAfter(detail.tolerance?.reset);
    const baseline = last && resetMs ? last.time + resetMs : null;
    const baselineText =
        baseline && baseline > Date.now() && !stillOn
            ? ` Tolerance should be back to normal around ${new Date(baseline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`
            : '';

    return (
        <>
            <PageHeader
                title={detail.name}
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
                            {'Log'}
                        </button>
                        <button
                            type="button"
                            className={`${isSaved ? headerActionAccent : headerAction} tap-target max-sm:w-9 max-sm:justify-center max-sm:px-0`}
                            aria-pressed={isSaved}
                            aria-label={isSaved ? 'Saved' : 'Save'}
                            onClick={() => saved.toggle(detail.id)}
                        >
                            <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
                            <span className="max-sm:hidden">{isSaved ? 'Saved' : 'Save'}</span>
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
                                        toast('You’re doing amazing, sweetie.');
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
                                    {'Also called '}
                                    {aliases.slice(0, 6).join(', ')}
                                </p>
                            )}
                            {structure && (
                                <p className={`text-xs ${muted} mt-1`}>
                                    {structure.role === 'active'
                                        ? `Drawn: its main active compound, ${structure.name}. `
                                        : structure.role === 'core'
                                          ? `Drawn: the family's parent structure, ${structure.name}. `
                                          : structure.role === 'example'
                                            ? `Drawn: the family's best-known member, ${structure.name}. `
                                            : ''}
                                    <a
                                        href={`https://pubchem.ncbi.nlm.nih.gov/compound/${structure.cid}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[var(--text-muted)]"
                                    >
                                        {'Structure from PubChem'}
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
                            <span className="mt-[7px] size-2 shrink-0 rounded-full" style={{ background: journal.data.colors[detail.id] }} />
                            <span>
                                {stillOn
                                    ? lastC!.exact
                                        ? `Still working: you logged ${lastAmount} ${formatMinutes(sinceLast)} ago, and it lasts about ${formatMinutes(lastCourse!.over)}.`
                                        : `May still be working: you logged ${lastAmount} ${formatMinutes(sinceLast)} ago. Its timing taken that way isn’t documented; other ways, up to ${formatMinutes(lastCourse!.over)}.`
                                    : `You last logged ${lastAmount} ${sinceLast < 2880 ? `${formatMinutes(sinceLast)} ago` : `on ${new Date(last.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}.`}
                                {baselineText}
                            </span>
                        </Link>
                    )}

                    {(limited || detail.advisory) && (
                        <div className="mt-4 space-y-2">
                            {limited && (
                                <Advisory>
                                    {'Little is known about this one. Treat any dose as stronger than you expect.'}
                                </Advisory>
                            )}
                            {detail.advisory && <Advisory>{detail.advisory}</Advisory>}
                        </div>
                    )}

                    {reference && (
                        <p className={`mt-5 text-sm leading-relaxed ${muted} max-w-prose`}>
                            {'A reference entry: what it is, its names and what it’s known to interact with, from Wikidata and Wikipedia. No doses are given for it here; for a prescribed medicine, follow the prescription.'}
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
                            <span className="truncate">{'How much'}</span>
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
                                        {sentence(detail.doseBasis.replace(/^Note:\s*/i, ''))}
                                    </p>
                                )}
                                <p>
                                    {'Weigh with a milligram scale; eyeballing powder is how people get hurt. Start at the light end, and with any new batch.'}
                                </p>
                                <p className="text-xs">
                                    {'Doses from '}
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
                            label={roa ? `${roaName(roa)}, in ${dose.unit}` : dose.unit}
                            footer={
                                <Link
                                    to={{ page: 'mix', ids: [detail.id] }}
                                    className={`${headerActionAccent} tap-target -ml-2.5 no-underline`}
                                >
                                    {'Check what it mixes with'}
                                    <ChevronRight size={15} />
                                </Link>
                            }
                        />
                    ) : (
                        <p className={`text-sm ${muted}`}>
                            {'No dosage is documented for this route.'}
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
                        <SectionTitle title={'How long'} />
                        <p className={`text-sm ${muted}`}>
                            {'No timing is documented for this route.'}
                        </p>
                    </div>
                )}

                <section>
                    <SectionTitle title={'Mixing'} />
                    {combos.length === 0 ? (
                        <p className={`text-sm ${muted}`}>
                            {'No combinations are documented. That doesn’t mean any are safe.'}
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
                                            {g.title}
                                        </h3>
                                        <p className={`text-xs ${muted}`}>{g.says}</p>
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
                                                                {other.name}
                                                            </Link>
                                                        ) : (
                                                            <span className={`chip chip-${g.tone} chip-static`}>
                                                                {c.substance}
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
                    <SectionTitle title={`More about ${detail.name}`} />
                    <div className="settings-section">
                        {(detail.summary) && (
                            <Fold
                                title={'What it is'}
                                hint={(() => {
                                    const text = detail.summary;
                                    const first = firstSentence(text);
                                    return first.length < text.trim().length - 2 ? first : undefined;
                                })()}
                            >
                                <p className="text-sm max-w-prose">{detail.summary}</p>
                                {(
                                    detail.summarySources && <p className="footnote">{`From ${detail.summarySources}.`}</p>
                                )}
                            </Fold>
                        )}
                        {safety.length > 0 && (
                            <Fold title={'Safety'} hint={safety.map(([k]) => k).join(', ')}>
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
                        {detail.tolerance && (detail.tolerance.buildUp || detail.tolerance.reset) && (
                            <Fold
                                title={'Tolerance'}
                                hint={
                                    detail.tolerance.reset
                                        ? `Back to normal after about ${detail.tolerance.reset}`
                                        : undefined
                                }
                            >
                                <dl>
                                    {detail.tolerance.buildUp && (
                                        <div className="fact-row">
                                            <dt>{'Builds up'}</dt>
                                            <dd>{cap(detail.tolerance.buildUp)}</dd>
                                        </div>
                                    )}
                                    {detail.tolerance.reset && (
                                        <div className="fact-row">
                                            <dt>{'Back to normal'}</dt>
                                            <dd>{`After about ${detail.tolerance.reset}`}</dd>
                                        </div>
                                    )}
                                    {detail.tolerance.crossTolerances?.map(c => (
                                        <div className="fact-row" key={c.group}>
                                            <dt>{'Also lowers the effect of'}</dt>
                                            <dd>{c.items.join(', ')}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </Fold>
                        )}
                        {detail.subjectiveEffects.length > 0 && (
                            <Fold
                                title={'Effects people report'}
                                hint={`${detail.subjectiveEffects.length} documented effects`}
                            >
                                <ul className="effect-list">
                                    {detail.subjectiveEffects.map(e => (
                                        <li key={e.name}>
                                            {e.url ? (
                                                <a href={e.url} target="_blank" rel="noreferrer">
                                                    {e.name}
                                                </a>
                                            ) : (
                                                e.name
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </Fold>
                        )}
                        {(detail.helpfulLinks.length > 0 || detail.citations.length > 0) && (
                            <Fold title={'Sources and further reading'}>
                                {detail.helpfulLinks.length > 0 && (
                                    <div className="settings-section">
                                        {detail.helpfulLinks.map(l => (
                                            <a
                                                key={l.url}
                                                href={l.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`w-full min-h-14 flex items-center gap-3 py-3 text-[var(--text)] no-underline ${rowBleed}`}
                                            >
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-sm font-medium">{l.title}</span>
                                                    <span className={`block text-xs ${muted} mt-0.5`}>{l.description}</span>
                                                </span>
                                                <External size={18} className={muted} />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {detail.citations.length > 0 && (
                                    <>
                                        <h3 className="group-heading mt-5 mb-2">{'Research'}</h3>
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
