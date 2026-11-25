import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, Search, X } from 'lucide-react';
import { CombinedTimelineSvg, type CombinedTimelineItem } from './CombinedTimelineSvg';
import { formatRoaDisplay } from './DurationCurveSvg';
import { DOSAGE_FORM_LABELS, FormDoodle } from './FormDoodle';
import { Tabs } from './Tabs';
import {
  fetchCombosMatrix,
  fetchSubstanceDetail,
  type SubstanceDetailData,
  type SubstanceIndexEntry,
  type TripSitComboMatrix,
} from '../data/substanceCatalog';

export interface InteractionCheckerViewProps {
  catalog: readonly SubstanceIndexEntry[];
  initialPair?: string[];
  onOpenSubstance: (entry: SubstanceIndexEntry) => void;
}

interface PairEvaluation {
  a: SubstanceIndexEntry;
  b: SubstanceIndexEntry;
  status: 'Dangerous' | 'Unsafe' | 'Caution' | 'Synergy' | 'Low risk';
  tone: 'danger' | 'warning' | 'info' | 'positive';
  note: string;
  mechanism: string;
}

const PRESETS: readonly { label: string; ids: [string, string] }[] = [
  { label: 'LSD + MDMA', ids: ['lsd', 'mdma'] },
  { label: '25I-NBOH + Cannabis', ids: ['25i-nboh', 'cannabis'] },
  { label: 'Alprazolam + Oxycodone', ids: ['alprazolam', 'oxycodone'] },
  { label: 'DXM + MDMA', ids: ['dxm', 'mdma'] },
  { label: 'Ketamine + Alcohol', ids: ['ketamine', 'alcohol'] },
  { label: 'Estradiol enanthate + Gel', ids: ['estradiol-enanthate', 'estradiol-gel'] },
];

function mapComboKey(entry: SubstanceIndexEntry): string[] {
  const id = entry.id.toLowerCase();
  const name = entry.name.toLowerCase();
  const chem = entry.chemicalClass.toLowerCase();
  const cat = entry.category.toLowerCase();
  const keys = [id, name];

  if (id === 'dxm' || name.includes('dextromethorphan')) keys.push('dextromethorphan');
  if (id === '2c-b' || id.startsWith('2c-')) keys.push('2c-x');
  if (id.startsWith('2c-t-')) keys.push('2c-t-x');
  if (id.includes('nbome') || id.includes('nboh')) keys.push('nbomes');
  if (id.includes('5-meo-')) keys.push('5-meo-xxt');
  if (chem.includes('benzodiazepine') || id === 'alprazolam' || id === 'diazepam' || id === 'clonazepam' || id === 'lorazepam' || id === 'etizolam') {
    keys.push('benzodiazepines');
  }
  if (cat === 'opioid') keys.push('opioids');
  if (id === 'ghb' || id === 'gbl') keys.push('ghb/gbl');
  if (id.includes('amphetamine') || id === 'adderall') keys.push('amphetamines');
  if (id === 'psilocybin' || id === 'mushrooms') keys.push('mushrooms');
  if (id === 'nitrous' || id === 'nitrous-oxide') keys.push('nitrous');
  if (chem.includes('lysergamide') || id.includes('lsd')) keys.push('lsd');

  return keys;
}

function parseTripSitStatus(raw: string): {
  status: PairEvaluation['status'];
  tone: PairEvaluation['tone'];
} {
  const s = raw.toLowerCase();
  if (s.includes('dangerous')) return { status: 'Dangerous', tone: 'danger' };
  if (s.includes('unsafe')) return { status: 'Unsafe', tone: 'danger' };
  if (s.includes('caution')) return { status: 'Caution', tone: 'warning' };
  if (s.includes('synergy') && !s.includes('no synergy')) {
    return { status: 'Synergy', tone: 'info' };
  }
  return { status: 'Low risk', tone: 'positive' };
}

function evaluatePair(
  a: SubstanceIndexEntry,
  b: SubstanceIndexEntry,
  details: Record<string, SubstanceDetailData>,
  matrix: TripSitComboMatrix | null
): PairEvaluation {
  // 1. Check direct combinations inside A's or B's loaded detail JSON
  const checkInDetail = (
    src: SubstanceIndexEntry,
    tgt: SubstanceIndexEntry
  ): PairEvaluation | null => {
    const d = details[src.id];
    if (!d?.combinations?.length) return null;
    const targetKeys = mapComboKey(tgt);
    for (const c of d.combinations) {
      const cname = c.substance.toLowerCase();
      if (targetKeys.some((k) => cname === k || cname.includes(k) || k.includes(cname))) {
        const tone = c.tone === 'neutral' ? 'positive' : c.tone;
        const status =
          c.status === 'No synergy' || c.status === 'Decrease' ? 'Low risk' : c.status;
        return {
          a,
          b,
          status,
          tone,
          note: c.note || `Documented interaction between ${a.name} and ${b.name}.`,
          mechanism: `${a.category} and ${b.category}`,
        };
      }
    }
    return null;
  };

  const direct = checkInDetail(a, b) || checkInDetail(b, a);
  if (direct) return direct;

  // 2. Check TripSit combos.json matrix
  if (matrix) {
    const keysA = mapComboKey(a);
    const keysB = mapComboKey(b);
    for (const ka of keysA) {
      const row = matrix[ka];
      if (!row) continue;
      for (const kb of keysB) {
        const hit = row[kb];
        if (hit) {
          const parsed = parseTripSitStatus(hit.status);
          return {
            a,
            b,
            status: parsed.status,
            tone: parsed.tone,
            note: hit.note || `TripSit combination matrix classification: ${hit.status}.`,
            mechanism: 'TripSit matrix',
          };
        }
      }
    }
  }

  // 3. Pharmacological class fallback
  const cats = new Set([a.category, b.category]);

  if (
    (cats.has('Depressant') && cats.has('Opioid')) ||
    (a.category === 'Opioid' && b.category === 'Opioid')
  ) {
    return {
      a,
      b,
      status: 'Dangerous',
      tone: 'danger',
      note: 'Synergistic central nervous system and respiratory depression; primary driver of fatal overdose.',
      mechanism: 'CNS + μ-opioid respiratory depression',
    };
  }
  if (a.category === 'Depressant' && b.category === 'Depressant') {
    return {
      a,
      b,
      status: 'Dangerous',
      tone: 'danger',
      note: 'Additive GABAergic sedation, motor impairment, amnesia, and loss of airway reflexes.',
      mechanism: 'Cumulative CNS depression',
    };
  }
  if (cats.has('Dissociative') && (cats.has('Depressant') || cats.has('Opioid'))) {
    return {
      a,
      b,
      status: 'Dangerous',
      tone: 'danger',
      note: 'High risk of sudden unconsciousness, vomiting, and airway compromise.',
      mechanism: 'NMDA antagonism + CNS depression',
    };
  }
  if (cats.has('Stimulant') && cats.has('Empathogen')) {
    return {
      a,
      b,
      status: 'Caution',
      tone: 'warning',
      note: 'Compounds monoamine release, tachycardia, hyperthermia, and neurotoxic strain.',
      mechanism: 'Additive catecholamine & serotonergic load',
    };
  }
  if (a.category === 'Stimulant' && b.category === 'Stimulant') {
    return {
      a,
      b,
      status: 'Caution',
      tone: 'warning',
      note: 'Additive cardiovascular strain, tachycardia, elevated blood pressure, and vasoconstriction.',
      mechanism: 'Sympathomimetic summation',
    };
  }
  if (cats.has('Psychedelic') && cats.has('Dissociative')) {
    return {
      a,
      b,
      status: 'Synergy',
      tone: 'info',
      note: 'Strong mutual potentiation of visual immersion and dissociation; reduce individual doses.',
      mechanism: '5-HT2A agonism + NMDA antagonism',
    };
  }
  if (a.category === 'Endocrine' && b.category === 'Endocrine') {
    return {
      a,
      b,
      status: 'Low risk',
      tone: 'positive',
      note: 'Account for combined systemic hormone exposure and confirm trough levels with blood work.',
      mechanism: 'Additive endocrine therapy',
    };
  }
  if (cats.has('Endocrine')) {
    return {
      a,
      b,
      status: 'Low risk',
      tone: 'positive',
      note: 'No acute pharmacodynamic conflict documented at physiological hormone replacement levels.',
      mechanism: 'Independent primary pathways',
    };
  }

  return {
    a,
    b,
    status: 'Caution',
    tone: 'warning',
    note: 'No explicit pair rule documented; combining active agents can mask subjective sedation or intensify side effects.',
    mechanism: `${a.category} and ${b.category}`,
  };
}

export const InteractionCheckerView: React.FC<InteractionCheckerViewProps> = ({
  catalog,
  initialPair,
  onOpenSubstance,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialPair && initialPair.length >= 2) return initialPair;
    return ['lsd', 'mdma'];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [selectedRoas, setSelectedRoas] = useState<Record<string, string>>({});
  const [loadedDetails, setLoadedDetails] = useState<Record<string, SubstanceDetailData>>({});
  const [comboMatrix, setComboMatrix] = useState<TripSitComboMatrix | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveMatchIdx(0);
  }, [searchQuery, selectedIds]);

  useEffect(() => {
    fetchCombosMatrix().then(setComboMatrix).catch(() => {});
  }, []);

  useEffect(() => {
    for (const id of selectedIds) {
      if (!loadedDetails[id]) {
        fetchSubstanceDetail(id)
          .then((d) => {
            setLoadedDetails((prev) => ({ ...prev, [id]: d }));
          })
          .catch(() => {});
      }
    }
  }, [selectedIds, loadedDetails]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const addSubstance = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSearchQuery('');
    setDropdownOpen(false);
  };

  const removeSubstance = (id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pool = catalog.filter((s) => !selectedIds.includes(s.id));
    if (!q) return pool.slice(0, 12);
    return pool
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.aliases.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
      .slice(0, 16);
  }, [catalog, searchQuery, selectedIds]);

  const selectedRecords = useMemo(
    () =>
      selectedIds
        .map((id) => catalog.find((s) => s.id === id))
        .filter((s): s is SubstanceIndexEntry => Boolean(s)),
    [catalog, selectedIds]
  );

  const pairResults = useMemo(() => {
    const out: PairEvaluation[] = [];
    for (let i = 0; i < selectedRecords.length; i++) {
      for (let j = i + 1; j < selectedRecords.length; j++) {
        out.push(
          evaluatePair(selectedRecords[i], selectedRecords[j], loadedDetails, comboMatrix)
        );
      }
    }
    return out;
  }, [selectedRecords, loadedDetails, comboMatrix]);

  const highestRisk = useMemo(() => {
    if (pairResults.some((p) => p.tone === 'danger')) {
      return {
        label: 'Dangerous / Unsafe',
        tone: 'danger' as const,
        summary:
          'One or more selected pairs carry a documented risk of severe physiological toxicity, seizures, or respiratory depression.',
      };
    }
    if (pairResults.some((p) => p.tone === 'warning')) {
      return {
        label: 'Caution advised',
        tone: 'warning' as const,
        summary:
          'Selected substances add cardiovascular, cognitive, or sedative load when combined. Keep doses conservative.',
      };
    }
    if (pairResults.some((p) => p.tone === 'info')) {
      return {
        label: 'Synergy & potentiation',
        tone: 'info' as const,
        summary:
          'Selected substances mutually amplify intensity. Space administration windows and lower individual doses.',
      };
    }
    return {
      label: 'Low risk',
      tone: 'positive' as const,
      summary:
        'No severe acute conflict identified between the selected entries.',
    };
  }, [pairResults]);

  return (
    <div className="detail-page">
      {/* 1. HEADER & SEARCH-TO-ADD PICKER */}
      <section className="detail-hero">
        <div className="detail-section-header">
          <div>
            <h1 className="title-lg">Interactions</h1>
            <p className="caption">
              Search and combine any of the {catalog.length} indexed substances to check pairwise
              risks and timelines
            </p>
          </div>
        </div>

        {/* Search to add substance */}
        <div ref={pickerRef} className="directory-search-box">
          <div className="search-field-shell">
            <span className="search-icon" aria-hidden="true">
              <Search size={18} strokeWidth={1.75} />
            </span>
            <input
              type="search"
              value={searchQuery}
              placeholder="Add a substance to compare (e.g. Cannabis, Lithium, Ketamine, 25I-NBOH)…"
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' && searchMatches.length > 0) {
                  e.preventDefault();
                  setDropdownOpen(true);
                  setActiveMatchIdx((i) => (i + 1) % searchMatches.length);
                } else if (e.key === 'ArrowUp' && searchMatches.length > 0) {
                  e.preventDefault();
                  setDropdownOpen(true);
                  setActiveMatchIdx((i) => (i - 1 + searchMatches.length) % searchMatches.length);
                } else if (e.key === 'Enter' && dropdownOpen && searchMatches[activeMatchIdx]) {
                  e.preventDefault();
                  addSubstance(searchMatches[activeMatchIdx].id);
                } else if (e.key === 'Escape') {
                  setDropdownOpen(false);
                }
              }}
              className="input-base search-input"
              aria-label="Add substance to compare"
              autoComplete="off"
            />
          </div>

          {dropdownOpen && (
            <div className="search-dropdown" role="listbox" aria-label="Add substance">
              <div className="search-results-list scrollbar-hide">
                {searchMatches.length === 0 ? (
                  <div className="empty-row">No matching substance found.</div>
                ) : (
                  searchMatches.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={idx === activeMatchIdx}
                      data-active={idx === activeMatchIdx}
                      onMouseEnter={() => setActiveMatchIdx(idx)}
                      onClick={() => addSubstance(item.id)}
                      className="menu-item"
                    >
                      <div className="menu-item-lead">
                        <FormDoodle form={item.form} size={1.75} />
                        <div className="menu-item-text">
                          <div className="menu-item-title">{item.name}</div>
                          <div className="menu-item-sub">
                            {item.category}
                            {item.aliases ? `, ${item.aliases}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="menu-item-trail">
                        <Plus size={16} strokeWidth={1.85} />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected substances */}
        {selectedRecords.length > 0 && (
          <div className="pill-wrap-row">
            {selectedRecords.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => removeSubstance(sub.id)}
                className="btn-tonal"
                title={`Remove ${sub.name}`}
              >
                <FormDoodle form={sub.form} size={1.45} />
                <span>{sub.name}</span>
                <X size={15} strokeWidth={2} />
              </button>
            ))}
          </div>
        )}

        {/* Quick presets */}
        <div className="checker-presets-row">
          <span className="footnote detail-muted-text">Presets</span>
          {PRESETS.map((p) => {
            const isActivePreset =
              selectedIds.length === p.ids.length &&
              p.ids.every((id) => selectedIds.includes(id));
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setSelectedIds([...p.ids])}
                className={isActivePreset ? 'btn-tonal preset-btn' : 'btn-ghost preset-btn'}
                aria-pressed={isActivePreset}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. PAIRWISE EVALUATION MATRIX */}
      <section className="detail-section">
        <div className="detail-section-header">
          <div>
            <h2 className="title-sm">
              Pairwise evaluation ({pairResults.length}{' '}
              {pairResults.length === 1 ? 'pair' : 'pairs'})
            </h2>
            <p className="caption">{highestRisk.summary}</p>
          </div>
          {pairResults.length > 0 && (
            <span className={`label status-${highestRisk.tone}`}>{highestRisk.label}</span>
          )}
        </div>

        {pairResults.length > 0 &&
          (highestRisk.tone === 'danger' || highestRisk.tone === 'warning') && (
            <p className="advisory-line">
              <span className="advisory-icon" aria-hidden="true">
                <AlertTriangle size={16} strokeWidth={1.75} />
              </span>
              <span>
                {highestRisk.tone === 'danger'
                  ? 'High-risk combination selected. Avoid co-administration and review the pairwise notes below.'
                  : 'Caution advised when combining the selected entries; monitor cumulative dose and timing.'}
              </span>
            </p>
          )}

        {pairResults.length === 0 ? (
          <div className="empty-row">Select at least two substances above to compare.</div>
        ) : (
          <div className="settings-section">
            {pairResults.map((pair) => (
              <div key={`${pair.a.id}-${pair.b.id}`} className="interaction-row">
                <div className="interaction-top">
                  <div className="checker-pair-title">
                    <button
                      type="button"
                      onClick={() => onOpenSubstance(pair.a)}
                      className="journal-substance-link body-strong"
                    >
                      {pair.a.name}
                    </button>
                    <span className="caption detail-muted-text" aria-hidden="true">
                      +
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenSubstance(pair.b)}
                      className="journal-substance-link body-strong"
                    >
                      {pair.b.name}
                    </button>
                    <span className="footnote detail-muted-text">{pair.mechanism}</span>
                  </div>
                  <span className={`interaction-status status-${pair.tone}`}>
                    {pair.status}
                  </span>
                </div>
                <p className="interaction-note">{pair.note}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. TIMELINE & ROUTE COMPARISON */}
      {selectedRecords.length >= 2 && (() => {
        const timelineItems: CombinedTimelineItem[] = selectedRecords
          .map((rec) => {
            const detail = loadedDetails[rec.id];
            const chosenRoa = selectedRoas[rec.id];
            const detailRow =
              detail?.durationRows.find((r) => r.roa === chosenRoa) ??
              detail?.durationRows[0];
            if (detailRow) {
              return { id: rec.id, name: rec.name, row: detailRow };
            }
            if (rec.primaryDuration) {
              return {
                id: rec.id,
                name: rec.name,
                row: {
                  roa: rec.primaryBand?.roa ?? 'Primary',
                  onset: rec.primaryDuration.onset,
                  comeup: '—',
                  peak: rec.primaryDuration.peak,
                  offset: rec.primaryDuration.offset,
                  afterEffects: '—',
                  total: rec.primaryDuration.total,
                },
              };
            }
            return null;
          })
          .filter((x): x is CombinedTimelineItem => Boolean(x));

        return (
          <section className="detail-section">
            <div className="detail-section-header">
              <div>
                <h2 className="title-sm">Timeline &amp; route comparison</h2>
                <p className="caption">
                  Stagger intake timing and scrub the shared curve to inspect peak overlap
                </p>
              </div>
            </div>

            {timelineItems.length >= 2 && (
              <CombinedTimelineSvg items={timelineItems} />
            )}

            {selectedRecords.map((rec) => {
              const detail = loadedDetails[rec.id];
              const dRows = detail?.durationRows ?? [];
              const activeRow =
                dRows.find((r) => r.roa === selectedRoas[rec.id]) ?? dRows[0] ?? null;

              const displayPhases = activeRow
                ? [
                    { label: 'Onset', value: activeRow.onset },
                    { label: 'Comeup', value: activeRow.comeup },
                    { label: 'Peak', value: activeRow.peak },
                    { label: 'Offset', value: activeRow.offset },
                    { label: 'Total duration', value: activeRow.total },
                  ].filter((p) => p.value && p.value !== '—')
                : rec.primaryDuration
                  ? [
                      { label: 'Onset', value: rec.primaryDuration.onset },
                      { label: 'Peak', value: rec.primaryDuration.peak },
                      { label: 'Offset', value: rec.primaryDuration.offset },
                      { label: 'Total duration', value: rec.primaryDuration.total },
                    ].filter((p) => p.value && p.value !== '—')
                  : [];

              return (
                <div key={rec.id} className="detail-subblock">
                  <div className="duration-route-header">
                    <div className="flex-center-gap">
                      <FormDoodle form={rec.form} size={1.75} />
                      <button
                        type="button"
                        onClick={() => onOpenSubstance(rec)}
                        className="journal-substance-link body-strong"
                      >
                        {rec.name}
                      </button>
                      <span className="caption">
                        {formatRoaDisplay(
                          activeRow?.roa ?? rec.primaryBand?.roa ?? rec.category
                        )}{' '}
                        ({DOSAGE_FORM_LABELS[rec.form]?.en})
                      </span>
                    </div>
                    {rec.primaryBand && (
                      <span className="caption tabular-nums">
                        Common {rec.primaryBand.low}–{rec.primaryBand.high}{' '}
                        {rec.primaryBand.unit}
                      </span>
                    )}
                  </div>

                  {dRows.length > 1 && activeRow && (
                    <div className="detail-tabs-wrap">
                      <Tabs
                        tabs={dRows.map((d) => ({
                          id: d.roa,
                          label: formatRoaDisplay(d.roa),
                        }))}
                        value={activeRow.roa}
                        onChange={(roa) =>
                          setSelectedRoas((prev) => ({ ...prev, [rec.id]: roa }))
                        }
                      />
                    </div>
                  )}

                  {displayPhases.length > 0 ? (
                    <div className="settings-section">
                      {displayPhases.map((p) => (
                        <div key={p.label} className="flat-row">
                          <span className="flat-row-label">{p.label}</span>
                          <span className="flat-row-value tabular-nums">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="caption detail-muted-text">
                      No structured duration data indexed.
                    </p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })()}
    </div>
  );
};
