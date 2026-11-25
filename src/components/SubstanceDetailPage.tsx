import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bookmark,
  GitCompareArrows,
  Minus,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { DOSAGE_FORM_LABELS, FormDoodle, type DosageForm } from './FormDoodle';
import {
  DurationCurveSvg,
  buildDurationCurveModel,
  formatRoaDisplay,
  parseDurationMinutes,
} from './DurationCurveSvg';
import { LevelRail } from './LevelRail';
import { Segmented } from './Segmented';
import { Tabs } from './Tabs';
import {
  ToleranceCurveSvg,
  buildToleranceModel,
  parseToleranceMinutes,
} from './ToleranceCurveSvg';
import type { StatisticalEffectRow } from '../data/lsdDetail';
import type {
  CatalogCategory,
  SubstanceDetailData,
  SubstanceIndexEntry,
} from '../data/substanceCatalog';

export interface SubstanceDetailPageProps {
  detail: SubstanceDetailData;
  catalog?: readonly SubstanceIndexEntry[];
  isBookmarked?: boolean;
  onToggleBookmark?: (id: string) => void;
  onOpenSubstance?: (entry: Pick<SubstanceIndexEntry, 'id'>) => void;
  onFilterCategory?: (category: CatalogCategory) => void;
  onFilterForm?: (form: DosageForm) => void;
  onOpenInteractionChecker?: (substanceId: string) => void;
  onOpenInteractionPair?: (ids: [string, string]) => void;
}

type EffectsTab = 'positive' | 'adverse' | 'all';
type EffectSortKey = 'share' | 'ci' | 'confidence';
type ComboFilter = 'all' | 'danger' | 'warning' | 'info' | 'positive';
type IntakePreset = 'now' | 'plus1h' | '20:00' | '22:00';
type SentimentVerdict = 'Positive' | 'Neutral' | 'Cautionary';

const RADAR_AXES = ['Visuals', 'Headspace', 'Auditory', 'Body load'] as const;

function getSmartDoseStep(maxDomain: number): number {
  if (maxDomain <= 12) return 0.5;
  if (maxDomain <= 60) return 1;
  if (maxDomain <= 250) return 5;
  return 10;
}

function resolveCatalogMatch(
  label: string,
  catalog: readonly SubstanceIndexEntry[],
  selfId: string
): SubstanceIndexEntry | null {
  if (!catalog.length) return null;
  const norm = label.toLowerCase().trim();
  const aliasMap: Record<string, string> = {
    mushrooms: 'psilocybin-mushrooms',
    psilocybin: 'psilocybin-mushrooms',
    'nitrous oxide': 'nitrous',
    nitrous: 'nitrous',
    'cannabis / thc': 'cannabis',
    weed: 'cannabis',
    dextromethorphan: 'dxm',
    amphetamines: 'amphetamine',
    benzodiazepines: 'alprazolam',
    'ghb/gbl': 'ghb',
  };
  const mappedId = aliasMap[norm];
  if (mappedId && mappedId !== selfId) {
    const direct = catalog.find((c) => c.id === mappedId);
    if (direct) return direct;
  }
  const exact = catalog.find(
    (c) =>
      c.id !== selfId &&
      (c.id.toLowerCase() === norm || c.name.toLowerCase() === norm)
  );
  if (exact) return exact;
  return (
    catalog.find(
      (c) =>
        c.id !== selfId &&
        c.aliases
          .toLowerCase()
          .split(',')
          .some((a) => a.trim() === norm)
    ) ?? null
  );
}

function EffectRadar({
  scores,
  activeIdx,
  onSelectIdx,
}: {
  scores: [number, number, number, number];
  activeIdx: number | null;
  onSelectIdx: (idx: number | null) => void;
}) {
  const size = 216;
  const center = size / 2;
  const maxRadius = 68;
  const rings = [0.25, 0.5, 0.75, 1];
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  const pointAt = (angle: number, norm: number) => {
    const r = norm * maxRadius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)] as const;
  };

  const polygonPoints = scores
    .map((s, idx) => {
      const [x, y] = pointAt(angles[idx], Math.max(0.05, Math.min(10, s)) / 10);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const labelPos = [
    { x: center, y: 18, anchor: 'middle' as const },
    { x: size - 6, y: center + 4, anchor: 'end' as const },
    { x: center, y: size - 10, anchor: 'middle' as const },
    { x: 6, y: center + 4, anchor: 'start' as const },
  ];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="radar-svg"
      role="img"
      aria-label={`Interactive effect profile radar: Visuals ${scores[0]}/10, Headspace ${scores[1]}/10, Auditory ${scores[2]}/10, Body load ${scores[3]}/10`}
    >
      {rings.map((r) => {
        const pts = angles
          .map((a) => {
            const [x, y] = pointAt(a, r);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
        return <polygon key={r} points={pts} className="radar-grid-ring" />;
      })}

      {angles.map((a, idx) => {
        const [x, y] = pointAt(a, 1);
        const isActive = activeIdx === idx;
        return (
          <line
            key={idx}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            className={`radar-axis-line ${isActive ? 'radar-axis-active' : ''}`}
          />
        );
      })}

      <polygon points={polygonPoints} className="radar-area" />

      {scores.map((s, idx) => {
        const [x, y] = pointAt(angles[idx], Math.max(0.05, Math.min(10, s)) / 10);
        const isActive = activeIdx === idx;
        return (
          <g
            key={idx}
            className="radar-hit-group"
            tabIndex={0}
            role="button"
            aria-label={`${RADAR_AXES[idx]} ${s} out of 10`}
            aria-pressed={isActive}
            onMouseEnter={() => onSelectIdx(idx)}
            onMouseLeave={() => onSelectIdx(null)}
            onClick={() => onSelectIdx(isActive ? null : idx)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectIdx(isActive ? null : idx);
              }
            }}
          >
            <circle cx={x} cy={y} r={14} fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={isActive ? 5.5 : 3.5}
              className={`radar-vertex ${isActive ? 'radar-vertex-active' : ''}`}
            />
          </g>
        );
      })}

      {labelPos.map((pos, idx) => {
        const isActive = activeIdx === idx;
        return (
          <text
            key={idx}
            x={pos.x}
            y={pos.y}
            textAnchor={pos.anchor}
            className={`radar-label radar-label-interactive ${
              isActive ? 'radar-label-active' : ''
            }`}
            onMouseEnter={() => onSelectIdx(idx)}
            onMouseLeave={() => onSelectIdx(null)}
            onClick={() => onSelectIdx(isActive ? null : idx)}
          >
            {RADAR_AXES[idx]} ({scores[idx]})
          </text>
        );
      })}
    </svg>
  );
}

function EffectStatRow({
  row,
  kind,
  expanded,
  onToggle,
}: {
  row: StatisticalEffectRow;
  kind: 'positive' | 'adverse';
  expanded: boolean;
  onToggle: () => void;
}) {
  const [ciLow, ciHigh] = row.intervalRange;
  const barToneClass = row.caution
    ? 'effect-bar-fill-danger'
    : kind === 'adverse'
      ? 'effect-bar-fill-warning'
      : 'effect-bar-fill-accent';

  const ciSpan = (ciHigh - ciLow).toFixed(1);

  return (
    <div
      className={`effect-stat-row effect-stat-interactive ${
        expanded ? 'effect-stat-expanded' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="effect-stat-head">
        <span className={`effect-stat-name ${row.caution ? 'status-danger' : ''}`}>
          {row.caution && (
            <AlertTriangle size={13} strokeWidth={1.85} className="inline-caution-icon" />
          )}
          {row.name}
        </span>
        <div className="effect-stat-metrics tabular-nums">
          <span className="effect-stat-share">{row.share.toFixed(1)}%</span>
          <span className="effect-stat-ci">{row.interval}</span>
          <span className="effect-stat-conf" title="Bluelight extractor confidence">
            {row.confidence}
          </span>
        </div>
      </div>
      <div className="effect-bar-track" aria-hidden="true">
        <div
          className="effect-bar-ci"
          style={{
            left: `${Math.max(0, Math.min(100, ciLow))}%`,
            width: `${Math.max(1, Math.min(100, ciHigh) - Math.max(0, ciLow))}%`,
          }}
        />
        <div
          className={`effect-bar-fill ${barToneClass}`}
          style={{ width: `${Math.max(1, Math.min(100, row.share))}%` }}
        />
      </div>
      {expanded && (
        <div className="effect-stat-detail footnote tabular-nums">
          <span>Point estimate {row.share.toFixed(1)}%</span>
          <span>95% CI {row.interval} (width {ciSpan} pp)</span>
          <span>Extractor confidence {row.confidence}</span>
        </div>
      )}
    </div>
  );
}

function formatOffsetClock(baseMinutes: number, addMinutes: number): string {
  const total = Math.round(baseMinutes + addMinutes);
  const dayDiff = Math.floor(total / 1440);
  const mod = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(mod / 60)).padStart(2, '0');
  const mm = String(mod % 60).padStart(2, '0');
  if (dayDiff > 0) {
    return `${hh}:${mm} (+${dayDiff}d)`;
  }
  return `${hh}:${mm}`;
}

function formatClockWindow(
  baseMinutes: number,
  startMin: number,
  endMin: number,
  fallbackRange?: string
): string {
  const c0 = formatOffsetClock(baseMinutes, startMin);
  const c1 = formatOffsetClock(baseMinutes, endMin);
  if (c0 === c1 && fallbackRange) {
    return `${c0} (${fallbackRange})`;
  }
  return `${c0} – ${c1}`;
}

export const SubstanceDetailPage: React.FC<SubstanceDetailPageProps> = ({
  detail,
  catalog = [],
  isBookmarked = false,
  onToggleBookmark,
  onOpenSubstance,
  onFilterCategory,
  onFilterForm,
  onOpenInteractionChecker,
  onOpenInteractionPair,
}) => {
  const [selectedRoaKey, setSelectedRoaKey] = useState<string>(
    detail.doseRows[0] ? `${detail.doseRows[0].roa}|${detail.doseRows[0].source}` : ''
  );
  const [selectedDurationRoa, setSelectedDurationRoa] = useState<string>(() => {
    const primaryDoseRoa = detail.doseRows[0]?.roa?.toLowerCase();
    const matched = primaryDoseRoa
      ? detail.durationRows.find((r) => r.roa.toLowerCase() === primaryDoseRoa)
      : undefined;
    if (matched && buildDurationCurveModel(matched)) return matched.roa;
    const firstPlottable = detail.durationRows.find((r) => buildDurationCurveModel(r));
    return firstPlottable?.roa ?? matched?.roa ?? detail.durationRows[0]?.roa ?? '';
  });
  const [simulatedDose, setSimulatedDose] = useState<number>(
    detail.doseRows[0]?.commonEstimate ?? 100
  );
  const [intakePreset, setIntakePreset] = useState<IntakePreset>('now');
  const [focusedPhase, setFocusedPhase] = useState<string | null>(null);
  const [activeRadarIdx, setActiveRadarIdx] = useState<number | null>(null);
  const [toleranceSnapMin, setToleranceSnapMin] = useState<number | null>(null);
  const [effectsTab, setEffectsTab] = useState<EffectsTab>('positive');
  const [effectSort, setEffectSort] = useState<{ key: EffectSortKey; dir: 'desc' | 'asc' }>({
    key: 'share',
    dir: 'desc',
  });
  const [effectSearch, setEffectSearch] = useState('');
  const [expandedStatName, setExpandedStatName] = useState<string | null>(null);
  const [subjectiveSearch, setSubjectiveSearch] = useState('');
  const [showMethodology, setShowMethodology] = useState(false);
  const [showAllEffects, setShowAllEffects] = useState(false);
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [comboFilter, setComboFilter] = useState<ComboFilter>('all');
  const [communityFilter, setCommunityFilter] = useState<Record<string, SentimentVerdict | null>>(
    {}
  );
  const [doodleSpin, setDoodleSpin] = useState(0);
  const [activeSectionId, setActiveSectionId] = useState<string>('');

  const roaOptions = useMemo(() => {
    const seen = new Map<string, number>();
    return detail.doseRows.map((r) => {
      const count = (seen.get(r.roa) ?? 0) + 1;
      seen.set(r.roa, count);
      const id = `${r.roa}|${r.source}`;
      const hasDup = detail.doseRows.filter((x) => x.roa === r.roa).length > 1;
      return {
        id,
        label: hasDup ? `${r.roa} (${r.source})` : r.roa,
        row: r,
      };
    });
  }, [detail.doseRows]);

  const activeDoseRow = useMemo(() => {
    return (
      roaOptions.find((o) => o.id === selectedRoaKey)?.row ??
      detail.doseRows[0] ??
      null
    );
  }, [roaOptions, detail.doseRows, selectedRoaKey]);

  const handleRoaChange = (roaId: string) => {
    setSelectedRoaKey(roaId);
    const match = roaOptions.find((o) => o.id === roaId)?.row;
    if (match) {
      setSimulatedDose(match.commonEstimate);
      const matchingDuration = detail.durationRows.find(
        (d) => d.roa.toLowerCase() === match.roa.toLowerCase()
      );
      if (matchingDuration) {
        setSelectedDurationRoa(matchingDuration.roa);
      }
    }
  };

  const simulatedTier = useMemo(() => {
    if (!activeDoseRow) {
      return { key: 'common', label: 'Common range', tone: 'accent' as const };
    }
    const v = simulatedDose;
    const { light, common, heavy } = activeDoseRow.segments;
    if (v < light[0]) {
      return {
        key: 'threshold',
        label: `Sub-light (< ${light[0]} ${activeDoseRow.unit})`,
        tone: 'positive' as const,
      };
    }
    if (v < common[0]) {
      return { key: 'light', label: `Light (${activeDoseRow.light})`, tone: 'positive' as const };
    }
    if (v <= common[1]) {
      return { key: 'common', label: `Common (${activeDoseRow.common})`, tone: 'accent' as const };
    }
    if (v < heavy[0]) {
      return { key: 'strong', label: `Strong (${activeDoseRow.strong})`, tone: 'warning' as const };
    }
    return { key: 'heavy', label: `Heavy (${activeDoseRow.heavy})`, tone: 'danger' as const };
  }, [activeDoseRow, simulatedDose]);

  const selectDoseTier = (roaKey: string, targetDose: number) => {
    const row = roaOptions.find((o) => o.id === roaKey)?.row;
    if (!row) return;
    if (roaKey !== selectedRoaKey) {
      setSelectedRoaKey(roaKey);
      const matchingDuration = detail.durationRows.find(
        (d) => d.roa.toLowerCase() === row.roa.toLowerCase()
      );
      if (matchingDuration) {
        setSelectedDurationRoa(matchingDuration.roa);
      }
    }
    const clamped = Math.min(row.domain[1], Math.max(row.domain[0], targetDose));
    const rounded =
      row.domain[1] <= 12
        ? Math.round(clamped * 4) / 4
        : row.domain[1] <= 60
          ? Math.round(clamped)
          : Math.round(clamped / 5) * 5;
    setSimulatedDose(Math.min(row.domain[1], Math.max(row.domain[0], rounded)));
  };

  const stepSimulatedDose = (dir: -1 | 1) => {
    if (!activeDoseRow) return;
    const step = getSmartDoseStep(activeDoseRow.domain[1]);
    setSimulatedDose((prev) => {
      const next = Number((prev + dir * step).toFixed(2));
      return Math.min(activeDoseRow.domain[1], Math.max(activeDoseRow.domain[0], next));
    });
  };

  const activeDurationRow = useMemo(() => {
    return (
      detail.durationRows.find((r) => r.roa === selectedDurationRoa) ??
      detail.durationRows.find(
        (r) => r.roa.toLowerCase() === (activeDoseRow?.roa ?? '').toLowerCase()
      ) ??
      detail.durationRows[0] ??
      null
    );
  }, [detail.durationRows, selectedDurationRoa, activeDoseRow]);

  const intakeBaseMinutes = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return intakePreset === 'now'
      ? nowMinutes
      : intakePreset === 'plus1h'
        ? nowMinutes + 60
        : intakePreset === '20:00'
          ? 20 * 60
          : 22 * 60;
  }, [intakePreset]);

  const clockProjection = useMemo(() => {
    if (!activeDurationRow) return null;
    const baseMin = intakeBaseMinutes;

    const onset = parseDurationMinutes(activeDurationRow.onset);
    const comeup = parseDurationMinutes(activeDurationRow.comeup);
    const peak = parseDurationMinutes(activeDurationRow.peak);
    const total = parseDurationMinutes(activeDurationRow.total);

    if (!onset && !peak && !total) return null;

    const onsetMid = onset ? (onset[0] + onset[1]) / 2 : 0;
    const comeupMid = comeup ? (comeup[0] + comeup[1]) / 2 : 0;
    const peakMid = peak ? (peak[0] + peak[1]) / 2 : 0;

    return {
      intakeClock: formatOffsetClock(baseMin, 0),
      onsetWindow: onset
        ? formatClockWindow(baseMin, onset[0], onset[1], activeDurationRow.onset)
        : null,
      peakWindow: peak
        ? formatClockWindow(
            baseMin,
            onsetMid + comeupMid,
            onsetMid + comeupMid + peakMid,
            activeDurationRow.peak
          )
        : null,
      baselineWindow: total
        ? formatClockWindow(baseMin, total[0], total[1], activeDurationRow.total)
        : null,
    };
  }, [activeDurationRow, intakeBaseMinutes]);

  const pharmacologyRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (detail.chemicalClass) rows.push({ label: 'Chemical class', value: detail.chemicalClass });
    if (detail.psychoactiveClass) {
      rows.push({ label: 'Psychoactive class', value: detail.psychoactiveClass });
    }
    if (detail.halfLife) rows.push({ label: 'Elimination half-life', value: detail.halfLife });
    if (detail.addictionPotential) {
      const cap =
        detail.addictionPotential.charAt(0).toUpperCase() +
        detail.addictionPotential.slice(1);
      rows.push({ label: 'Addiction potential', value: cap });
    }
    if (detail.toxicity && detail.toxicity.length > 0) {
      const joined = detail.toxicity
        .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
        .join('; ');
      rows.push({ label: 'Toxicity profile', value: joined });
    }
    if (detail.marquis) rows.push({ label: 'Marquis reagent', value: detail.marquis });
    return rows;
  }, [detail]);

  const comboTabs = useMemo(() => {
    const all = detail.combinations.length;
    const danger = detail.combinations.filter((c) => c.tone === 'danger').length;
    const warning = detail.combinations.filter((c) => c.tone === 'warning').length;
    const info = detail.combinations.filter((c) => c.tone === 'info').length;
    const positive = detail.combinations.filter(
      (c) => c.tone === 'positive' || c.tone === 'neutral'
    ).length;

    const rawCategoryTabs: { id: ComboFilter; label: string; count: number }[] = [
      { id: 'danger', label: `Dangerous & Unsafe (${danger})`, count: danger },
      { id: 'warning', label: `Caution (${warning})`, count: warning },
      { id: 'info', label: `Synergy (${info})`, count: info },
      { id: 'positive', label: `Low risk (${positive})`, count: positive },
    ];
    const categoryTabs = rawCategoryTabs.filter((t) => t.count > 0);

    if (categoryTabs.length <= 1 || all <= 3) {
      return [];
    }

    return [
      { id: 'all' as ComboFilter, label: `All (${all})` },
      ...categoryTabs.map(({ id, label }) => ({ id, label })),
    ];
  }, [detail.combinations]);

  const filteredCombinations = useMemo(() => {
    if (comboFilter === 'all' || comboTabs.length === 0) return detail.combinations;
    if (comboFilter === 'positive') {
      return detail.combinations.filter(
        (c) => c.tone === 'positive' || c.tone === 'neutral'
      );
    }
    return detail.combinations.filter((c) => c.tone === comboFilter);
  }, [detail.combinations, comboFilter, comboTabs.length]);

  const subjectiveEffects = detail.subjectiveEffects ?? [];
  const filteredSubjectiveEffects = useMemo(() => {
    const q = subjectiveSearch.trim().toLowerCase();
    if (!q) return subjectiveEffects;
    return subjectiveEffects.filter((e) => e.name.toLowerCase().includes(q));
  }, [subjectiveEffects, subjectiveSearch]);

  const visibleEffects =
    showAllEffects || subjectiveSearch.trim().length > 0
      ? filteredSubjectiveEffects
      : filteredSubjectiveEffects.slice(0, 18);

  const toggleEffectSort = (key: EffectSortKey) => {
    setEffectSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );
  };

  const sortStatRows = (rows: readonly StatisticalEffectRow[]) => {
    const q = effectSearch.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q))
      : rows;
    const mul = effectSort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (effectSort.key === 'share') return (a.share - b.share) * mul;
      if (effectSort.key === 'ci') {
        const wA = a.intervalRange[1] - a.intervalRange[0];
        const wB = b.intervalRange[1] - b.intervalRange[0];
        return (wA - wB) * mul;
      }
      const cA = parseFloat(a.confidence) || 0;
      const cB = parseFloat(b.confidence) || 0;
      return (cA - cB) * mul;
    });
  };

  const sortedPositiveStats = useMemo(
    () => (detail.effectsAnalysis ? sortStatRows(detail.effectsAnalysis.positive) : []),
    [detail.effectsAnalysis, effectSort, effectSearch]
  );

  const sortedAdverseStats = useMemo(
    () => (detail.effectsAnalysis ? sortStatRows(detail.effectsAnalysis.adverse) : []),
    [detail.effectsAnalysis, effectSort, effectSearch]
  );

  const citations = detail.citations ?? [];
  const visibleCitations = showAllCitations ? citations : citations.slice(0, 5);

  const hasReferencesBlock =
    Boolean(detail.referenceGuide) ||
    citations.length > 0 ||
    detail.helpfulLinks.length > 0;

  const sectionTabs = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    if (detail.doseRows.length > 0) list.push({ id: 'section-dosage', label: 'Dosage' });
    if (detail.durationRows.length > 0) list.push({ id: 'section-duration', label: 'Duration' });
    if (pharmacologyRows.length > 0) {
      list.push({ id: 'section-pharmacology', label: 'Pharmacology' });
    }
    if (detail.effectProfile) list.push({ id: 'section-profile', label: 'Profile' });
    if (detail.tolerance) list.push({ id: 'section-tolerance', label: 'Tolerance' });
    if (detail.effectsAnalysis) {
      list.push({ id: 'section-effects-analysis', label: 'Analysis' });
    } else if (subjectiveEffects.length > 0) {
      list.push({ id: 'section-subjective-effects', label: 'Effects' });
    }
    if (detail.combinations.length > 0) {
      list.push({ id: 'section-combinations', label: 'Combinations' });
    }
    if (hasReferencesBlock) list.push({ id: 'section-references', label: 'References' });
    return list;
  }, [
    detail.doseRows.length,
    detail.durationRows.length,
    pharmacologyRows.length,
    detail.effectProfile,
    detail.tolerance,
    detail.effectsAnalysis,
    subjectiveEffects.length,
    detail.combinations.length,
    hasReferencesBlock,
  ]);

  useEffect(() => {
    if (sectionTabs.length < 4 || typeof IntersectionObserver === 'undefined') return;
    setActiveSectionId((prev) => prev || sectionTabs[0].id);
    const elements = sectionTabs
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveSectionId(visible[0].target.id);
        }
      },
      { rootMargin: '-84px 0px -55% 0px', threshold: 0.05 }
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sectionTabs]);

  const jumpToSection = (id: string) => {
    setActiveSectionId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hasToleranceCurve = useMemo(
    () => Boolean(detail.tolerance && buildToleranceModel(detail.tolerance)),
    [detail.tolerance]
  );

  return (
    <article className="detail-page">
      {/* 1. HERO & SUMMARY */}
      <section className="detail-hero">
        <div className="detail-hero-head">
          <div className="detail-hero-title-row">
            <button
              type="button"
              className="doodle-interactive"
              onClick={() => setDoodleSpin((n) => n + 1)}
              title={`${DOSAGE_FORM_LABELS[detail.form]?.en ?? detail.form} — tap to bounce`}
              aria-label={`${DOSAGE_FORM_LABELS[detail.form]?.en ?? detail.form} illustration`}
              style={{
                transform: doodleSpin % 2 === 1 ? 'rotate(-10deg) scale(1.06)' : undefined,
              }}
            >
              <FormDoodle form={detail.form} size={2.75} />
            </button>
            <div>
              <div className="detail-meta-strip">
                {onFilterCategory ? (
                  <button
                    type="button"
                    onClick={() => onFilterCategory(detail.category as CatalogCategory)}
                    className="detail-meta-link"
                    title={`Browse all ${detail.category} substances`}
                  >
                    {detail.category}
                  </button>
                ) : (
                  <span className="detail-category-label">{detail.category}</span>
                )}
                {onFilterForm ? (
                  <button
                    type="button"
                    onClick={() => onFilterForm(detail.form)}
                    className="detail-meta-link"
                    title={`Browse all ${DOSAGE_FORM_LABELS[detail.form]?.en ?? detail.form} substances`}
                  >
                    {DOSAGE_FORM_LABELS[detail.form]?.en ?? detail.form}
                  </button>
                ) : (
                  <span className="detail-category-label">
                    {DOSAGE_FORM_LABELS[detail.form]?.en ?? detail.form}
                  </span>
                )}
                <span className="status-positive detail-status-label">{detail.status}</span>
              </div>
              <h1 className="title-lg detail-page-title">{detail.name}</h1>
              {detail.aliases && (
                <p className="detail-aliases">Also known as {detail.aliases}</p>
              )}
            </div>
          </div>

          <div className="detail-hero-actions">
            {onToggleBookmark && (
              <button
                type="button"
                onClick={() => onToggleBookmark(detail.id)}
                className={isBookmarked ? 'btn-tonal' : 'btn-secondary'}
                aria-pressed={isBookmarked}
              >
                <Bookmark
                  size={17}
                  strokeWidth={1.9}
                  fill={isBookmarked ? 'currentColor' : 'none'}
                />
                <span>{isBookmarked ? 'Saved' : 'Save'}</span>
              </button>
            )}
            {onOpenInteractionChecker && (
              <button
                type="button"
                onClick={() => onOpenInteractionChecker(detail.id)}
                className="btn-secondary"
              >
                <GitCompareArrows size={17} strokeWidth={1.9} />
                <span>Compare</span>
              </button>
            )}
          </div>
        </div>

        <p className="body-lg detail-lead-summary">{detail.summary}</p>
        <p className="footnote detail-sources-note">Sources: {detail.summarySources}</p>

        {/* Hard Rule #5: Unboxed single-line warning */}
        {detail.advisory && (
          <p className="advisory-line">
            <span className="advisory-icon" aria-hidden="true">
              <AlertTriangle size={16} strokeWidth={1.75} />
            </span>
            <span>{detail.advisory}</span>
          </p>
        )}

        {sectionTabs.length >= 4 && (
          <nav className="detail-jump-nav" aria-label="Jump to section">
            <Tabs
              tabs={sectionTabs}
              value={activeSectionId || sectionTabs[0].id}
              onChange={jumpToSection}
            />
          </nav>
        )}
      </section>

      {/* 2. PERSPECTIVES (if present) */}
      {detail.perspectives && detail.perspectives.length > 0 && (
        <section className="detail-section" id="section-perspectives">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Perspectives</h2>
              <p className="caption">First-hand &amp; monograph accounts</p>
            </div>
          </div>
          <div className="settings-section">
            {detail.perspectives.map((p, idx) => (
              <blockquote key={idx} className="perspective-row">
                <p className="perspective-quote">“{p.quote}”</p>
                <footer className="perspective-meta">
                  <span className="perspective-author">{p.author}</span>
                  <span>{p.source}</span>
                  {p.doseNote && <span className="tabular-nums">({p.doseNote})</span>}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* 3. DOSAGE & INTERACTIVE LEVEL RAIL (if dose rows exist) */}
      {detail.doseRows.length > 0 && (
        <section className="detail-section" id="section-dosage">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Dosage</h2>
              <p className="caption">
                Drag or click along the tick rail below to simulate a dose
              </p>
            </div>
            {roaOptions.length > 1 && (
              <Segmented
                options={roaOptions.map((o) => ({ id: o.id, label: o.label }))}
                value={
                  roaOptions.some((o) => o.id === selectedRoaKey)
                    ? selectedRoaKey
                    : roaOptions[0].id
                }
                onChange={handleRoaChange}
                aria-label="Route of administration"
              />
            )}
          </div>

          {activeDoseRow && (
            <div className="reading-block">
              <div className="reading-line">
                <span className="reading-md tabular-nums">{simulatedDose}</span>
                <span className="reading-unit">{activeDoseRow.unit}</span>

                <div className="dose-stepper-group">
                  <button
                    type="button"
                    onClick={() => stepSimulatedDose(-1)}
                    disabled={simulatedDose <= activeDoseRow.domain[0]}
                    className="btn-ghost btn-icon-circle tap-target dose-step-btn"
                    aria-label={`Decrease dose by ${getSmartDoseStep(activeDoseRow.domain[1])} ${activeDoseRow.unit}`}
                  >
                    <Minus size={15} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepSimulatedDose(1)}
                    disabled={simulatedDose >= activeDoseRow.domain[1]}
                    className="btn-ghost btn-icon-circle tap-target dose-step-btn"
                    aria-label={`Increase dose by ${getSmartDoseStep(activeDoseRow.domain[1])} ${activeDoseRow.unit}`}
                  >
                    <Plus size={15} strokeWidth={2} />
                  </button>
                </div>

                {simulatedDose !== activeDoseRow.commonEstimate && (
                  <button
                    type="button"
                    onClick={() => setSimulatedDose(activeDoseRow.commonEstimate)}
                    className="btn-ghost tap-target"
                  >
                    <RotateCcw size={14} strokeWidth={1.85} />
                    <span>
                      Common ({activeDoseRow.commonEstimate} {activeDoseRow.unit})
                    </span>
                  </button>
                )}

                <span className="reading-caption">
                  {activeDoseRow.roa} ({activeDoseRow.source}, {activeDoseRow.bioavailability})
                </span>
              </div>

              <LevelRail
                value={simulatedDose}
                band={activeDoseRow.band}
                domain={activeDoseRow.domain}
                label={simulatedTier.label}
                tone={simulatedTier.tone}
                unit={activeDoseRow.unit}
                onChange={setSimulatedDose}
              />
            </div>
          )}

          {/* Comparative Dose Ladders & Flat Hairline Tier Rows */}
          <div className="dose-ladder-list settings-section">
            {detail.doseRows.map((row) => {
              const rowKey = `${row.roa}|${row.source}`;
              const isActiveRow =
                activeDoseRow?.roa === row.roa && activeDoseRow?.source === row.source;
              const rowMax =
                row.unit === detail.doseUnit
                  ? detail.doseMaxTick || row.domain[1]
                  : row.domain[1];
              const tickMarks = [0, 0.25, 0.5, 0.75, 1].map((f) =>
                Number((f * rowMax).toFixed(rowMax <= 12 ? 1 : 0))
              );
              const pct = (v: number) => Math.max(0, Math.min(100, (v / rowMax) * 100));

              const segs: {
                key: string;
                label: string;
                rangeText: string;
                bounds: [number, number];
                cls: string;
              }[] = [
                {
                  key: 'light',
                  label: 'Light',
                  rangeText: row.light,
                  bounds: row.segments.light,
                  cls: 'ladder-seg-light',
                },
                {
                  key: 'common',
                  label: 'Common',
                  rangeText: row.common,
                  bounds: row.segments.common,
                  cls: 'ladder-seg-common',
                },
                {
                  key: 'strong',
                  label: 'Strong',
                  rangeText: row.strong,
                  bounds: row.segments.strong,
                  cls: 'ladder-seg-strong',
                },
                {
                  key: 'heavy',
                  label: 'Heavy',
                  rangeText: row.heavy,
                  bounds: row.segments.heavy,
                  cls: 'ladder-seg-heavy',
                },
              ];

              return (
                <div key={`${row.roa}-${row.source}`} className="dose-ladder-group">
                  <div className="dose-ladder-head">
                    <div className="flex-center-gap">
                      {roaOptions.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleRoaChange(rowKey)}
                          className={`route-select-link body-strong ${
                            isActiveRow ? 'accent-text' : ''
                          }`}
                        >
                          {row.roa}
                        </button>
                      ) : (
                        <span className="body-strong">{row.roa}</span>
                      )}
                      <span className="caption">{row.bioavailability}</span>
                    </div>
                    <span className="caption">Source: {row.source}</span>
                  </div>

                  <div className="ladder-track-shell">
                    <div className="ladder-track">
                      {segs.map((s) => {
                        const left = pct(s.bounds[0]);
                        const width = Math.max(1.5, pct(s.bounds[1]) - left);
                        const segMid = (s.bounds[0] + s.bounds[1]) / 2;
                        const isTierActive = isActiveRow && simulatedTier.key === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => selectDoseTier(rowKey, segMid)}
                            className={`ladder-seg ladder-seg-interactive ${s.cls} ${
                              isTierActive ? 'ladder-seg-active' : ''
                            }`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`Simulate ${s.label}: ${s.rangeText}`}
                            aria-label={`Simulate ${row.roa} ${s.label} dose (${s.rangeText})`}
                          />
                        );
                      })}
                      {isActiveRow && (
                        <span
                          className="ladder-needle"
                          style={{ left: `${pct(simulatedDose)}%` }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="ladder-axis tabular-nums">
                      {tickMarks.map((t, idx) => (
                        <span key={idx}>
                          {t}
                          {idx === tickMarks.length - 1 ? ` ${row.unit}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="settings-section">
                    {row.threshold && (
                      <button
                        type="button"
                        onClick={() => selectDoseTier(rowKey, row.domain[0])}
                        className={`flat-row flat-row-interactive ${
                          isActiveRow && simulatedTier.key === 'threshold'
                            ? 'flat-row-active'
                            : ''
                        }`}
                      >
                        <span className="flat-row-label">Threshold</span>
                        <span className="flat-row-value tabular-nums">{row.threshold}</span>
                      </button>
                    )}
                    {segs.map((s) => {
                      const segMid = (s.bounds[0] + s.bounds[1]) / 2;
                      const isTierActive = isActiveRow && simulatedTier.key === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => selectDoseTier(rowKey, segMid)}
                          className={`flat-row flat-row-interactive ${
                            isTierActive ? 'flat-row-active' : ''
                          }`}
                        >
                          <span className="dose-tier-label">
                            <span className={`dose-tier-swatch ${s.cls}`} aria-hidden="true" />
                            <span className="flat-row-label">{s.label}</span>
                          </span>
                          <span className="flat-row-value tabular-nums">{s.rangeText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {detail.doseBasis && (
            <p className="footnote detail-footnote">{detail.doseBasis}</p>
          )}
        </section>
      )}

      {/* 4. DURATION & TIMELINE PROJECTION (if duration rows exist) */}
      {detail.durationRows.length > 0 && (
        <section className="detail-section" id="section-duration">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Duration</h2>
              {detail.durationSources && (
                <p className="caption">Sources: {detail.durationSources}</p>
              )}
            </div>

            {clockProjection && (
              <Segmented
                options={[
                  { id: 'now' as IntakePreset, label: 'Now' },
                  { id: 'plus1h' as IntakePreset, label: '+1 h' },
                  { id: '20:00' as IntakePreset, label: '20:00' },
                  { id: '22:00' as IntakePreset, label: '22:00' },
                ]}
                value={intakePreset}
                onChange={setIntakePreset}
                aria-label="Projected intake time"
              />
            )}
          </div>

          {detail.durationRows.length > 1 && activeDurationRow && (
            <div className="detail-tabs-wrap">
              <Tabs
                tabs={detail.durationRows.map((d) => ({
                  id: d.roa,
                  label: formatRoaDisplay(d.roa),
                }))}
                value={activeDurationRow.roa}
                onChange={(roa) => {
                  setSelectedDurationRoa(roa);
                  setFocusedPhase(null);
                }}
              />
            </div>
          )}

          {activeDurationRow && (
            <DurationCurveSvg
              row={activeDurationRow}
              intakeMinutes={clockProjection ? intakeBaseMinutes : null}
              focusedPhase={focusedPhase}
              onClearFocusedPhase={() => setFocusedPhase(null)}
            />
          )}

          {clockProjection && activeDurationRow && (
            <div className="detail-subblock">
              <h3 className="section-heading">
                Projected timeline ({formatRoaDisplay(activeDurationRow.roa)}, intake{' '}
                {clockProjection.intakeClock})
              </h3>
              <div className="settings-section">
                {clockProjection.onsetWindow && (
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedPhase((p) => (p === 'Onset' ? null : 'Onset'))
                    }
                    className={`flat-row flat-row-interactive ${
                      focusedPhase === 'Onset' ? 'flat-row-active' : ''
                    }`}
                  >
                    <span className="flat-row-label">Onset window</span>
                    <span className="flat-row-value tabular-nums">
                      {clockProjection.onsetWindow}
                    </span>
                  </button>
                )}
                {clockProjection.peakWindow && (
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedPhase((p) => (p === 'Peak' ? null : 'Peak'))
                    }
                    className={`flat-row flat-row-interactive ${
                      focusedPhase === 'Peak' ? 'flat-row-active' : ''
                    }`}
                  >
                    <span className="flat-row-label">Peak plateau</span>
                    <span className="flat-row-value tabular-nums accent-text">
                      {clockProjection.peakWindow}
                    </span>
                  </button>
                )}
                {clockProjection.baselineWindow && (
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedPhase((p) => (p === 'Offset' ? null : 'Offset'))
                    }
                    className={`flat-row flat-row-interactive ${
                      focusedPhase === 'Offset' ? 'flat-row-active' : ''
                    }`}
                  >
                    <span className="flat-row-label">Return to baseline</span>
                    <span className="flat-row-value tabular-nums">
                      {clockProjection.baselineWindow}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {detail.durationRows.map((dRow) => {
            const isSelectedDuration = activeDurationRow?.roa === dRow.roa;
            const phaseRows = [
              { label: 'Onset', value: dRow.onset },
              { label: 'Comeup', value: dRow.comeup },
              { label: 'Peak', value: dRow.peak },
              { label: 'Offset', value: dRow.offset },
              { label: 'After-effects', value: dRow.afterEffects },
            ].filter((p) => p.value && p.value !== '—');

            return (
              <div key={dRow.roa} className="detail-subblock">
                <div className="duration-route-header">
                  {detail.durationRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDurationRoa(dRow.roa);
                        setFocusedPhase(null);
                      }}
                      className={`route-select-link section-heading ${
                        isSelectedDuration ? 'accent-text' : ''
                      }`}
                    >
                      {formatRoaDisplay(dRow.roa)}
                    </button>
                  ) : (
                    <span className="section-heading">{formatRoaDisplay(dRow.roa)}</span>
                  )}
                  {dRow.total && dRow.total !== '—' && (
                    <span className="caption tabular-nums">Total {dRow.total}</span>
                  )}
                </div>
                <div className="settings-section">
                  {phaseRows.length > 0 ? (
                    phaseRows.map((p) => {
                      const isPhaseFocused =
                        isSelectedDuration && focusedPhase === p.label;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            if (!isSelectedDuration) {
                              setSelectedDurationRoa(dRow.roa);
                              setFocusedPhase(p.label);
                            } else {
                              setFocusedPhase((cur) => (cur === p.label ? null : p.label));
                            }
                          }}
                          className={`flat-row flat-row-interactive ${
                            isPhaseFocused ? 'flat-row-active' : ''
                          }`}
                        >
                          <span className="flat-row-label">{p.label}</span>
                          <span className="flat-row-value tabular-nums">{p.value}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="flat-row">
                      <span className="flat-row-label">Total duration</span>
                      <span className="flat-row-value tabular-nums">{dRow.total}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* 5. PHARMACOLOGY & SAFETY (real chemical class, half-life, toxicity, reagent) */}
      {pharmacologyRows.length > 0 && (
        <section className="detail-section" id="section-pharmacology">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Pharmacology &amp; safety</h2>
              <p className="caption">Classification, pharmacokinetics, and harm-reduction properties</p>
            </div>
          </div>
          <div className="settings-section">
            {pharmacologyRows.map((row) => (
              <div key={row.label} className="flat-row">
                <span className="flat-row-label">{row.label}</span>
                <span className="flat-row-value">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. EFFECT PROFILE & RADAR (if present) */}
      {detail.effectProfile && (
        <section className="detail-section" id="section-profile">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Effect profile</h2>
              <p className="caption">
                {detail.effectProfile.classLabel}, {detail.effectProfile.reportCount}
              </p>
            </div>
            <span className="label accent-text tabular-nums">
              {detail.effectProfile.intensityVerdict} ({detail.effectProfile.overallScore}/10)
            </span>
          </div>

          <p className="body detail-summary-paragraph">{detail.effectProfile.summary}</p>

          <div className="profile-grid">
            <div className="profile-radar-col">
              <EffectRadar
                scores={detail.effectProfile.radarScores}
                activeIdx={activeRadarIdx}
                onSelectIdx={setActiveRadarIdx}
              />
            </div>
            <div className="profile-dims-col settings-section">
              {detail.effectProfile.dimensions.map((dim, idx) => {
                const isActive = activeRadarIdx === idx;
                return (
                  <div
                    key={dim.label}
                    className={`dim-row dim-row-interactive ${
                      isActive ? 'dim-row-active' : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onMouseEnter={() => setActiveRadarIdx(idx)}
                    onMouseLeave={() => setActiveRadarIdx(null)}
                    onClick={() => setActiveRadarIdx((cur) => (cur === idx ? null : idx))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveRadarIdx((cur) => (cur === idx ? null : idx));
                      }
                    }}
                  >
                    <div className="dim-row-top">
                      <span className={`body ${dim.caution ? 'status-warning' : ''}`}>
                        {dim.label}{' '}
                        <span className="caption tabular-nums">({dim.weight})</span>
                      </span>
                      <span className="body-strong tabular-nums">
                        {dim.score}/10{' '}
                        <span className="caption">({dim.weightedScore})</span>
                      </span>
                    </div>
                    <div className="dim-bar-track" aria-hidden="true">
                      <div
                        className={`dim-bar-fill ${
                          dim.caution ? 'effect-bar-fill-warning' : 'effect-bar-fill-accent'
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, dim.score * 10))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="detail-subblock settings-section">
            <blockquote className="perspective-row">
              <div className="caption accent-text perspective-kicker">
                {detail.effectProfile.experienceQuote.aspect}
              </div>
              <p className="perspective-quote">
                “{detail.effectProfile.experienceQuote.quote}”
              </p>
              <footer className="perspective-meta">
                <span className="perspective-author">
                  {detail.effectProfile.experienceQuote.author}
                </span>
                <span>{detail.effectProfile.experienceQuote.source}</span>
              </footer>
            </blockquote>

            <div className="interaction-row">
              <span className="interaction-target">Indexed archives</span>
              <p className="interaction-note">
                {detail.effectProfile.reportSources
                  .map((rs) => `${rs.source} (${rs.item})`)
                  .join(', ')}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 7. TOLERANCE & CROSS-TOLERANCE (if present) */}
      {detail.tolerance && (
        <section className="detail-section" id="section-tolerance">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Tolerance</h2>
              <p className="caption">Pharmacodynamic adaptation &amp; recovery</p>
            </div>
          </div>

          {hasToleranceCurve && (
            <ToleranceCurveSvg
              tolerance={detail.tolerance}
              snapMinutes={toleranceSnapMin}
            />
          )}

          <div className="settings-section">
            {detail.tolerance.milestones.map((m) => {
              const lowerLabel = m.label.toLowerCase();
              const parsedRange = parseToleranceMinutes(m.value);
              const snapVal = lowerLabel.includes('full')
                ? 0
                : parsedRange
                  ? (parsedRange[0] + parsedRange[1]) / 2
                  : null;

              if (hasToleranceCurve && snapVal !== null) {
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setToleranceSnapMin(snapVal)}
                    className="flat-row flat-row-interactive"
                    title={`Inspect ${m.label} on recovery curve`}
                  >
                    <span className="flat-row-label">{m.label}</span>
                    <span className={`flat-row-value tabular-nums status-${m.tone}`}>
                      {m.value}
                    </span>
                  </button>
                );
              }

              return (
                <div key={m.label} className="flat-row">
                  <span className="flat-row-label">{m.label}</span>
                  <span className={`flat-row-value tabular-nums status-${m.tone}`}>
                    {m.value}
                  </span>
                </div>
              );
            })}
            {detail.tolerance.crossTolerances.map((ct) => (
              <div key={ct.group} className="flat-row">
                <span className="flat-row-label">{ct.group}</span>
                <span className="flat-row-value cross-tolerance-list">
                  {ct.items.map((item, idx) => {
                    const matchedSub = resolveCatalogMatch(item, catalog, detail.id);
                    const isCat = [
                      'Psychedelic',
                      'Stimulant',
                      'Depressant',
                      'Dissociative',
                      'Opioid',
                      'Empathogen',
                      'Cannabinoid',
                      'Nootropic',
                      'Deliriant',
                      'Endocrine',
                    ].includes(item);

                    let node: React.ReactNode = item;
                    if (matchedSub && onOpenSubstance) {
                      node = (
                        <button
                          type="button"
                          onClick={() => onOpenSubstance(matchedSub)}
                          className="inline-entity-link"
                        >
                          {item}
                        </button>
                      );
                    } else if (isCat && onFilterCategory) {
                      node = (
                        <button
                          type="button"
                          onClick={() => onFilterCategory(item as CatalogCategory)}
                          className="inline-entity-link"
                        >
                          {item}
                        </button>
                      );
                    }
                    return (
                      <React.Fragment key={item}>
                        {idx > 0 ? ', ' : ''}
                        {node}
                      </React.Fragment>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. STATISTICAL EFFECTS ANALYSIS (if present, e.g. LSD) */}
      {detail.effectsAnalysis && (
        <section className="detail-section" id="section-effects-analysis">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Effects analysis</h2>
              <p className="caption">Sources: {detail.effectsAnalysis.sources}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMethodology((v) => !v)}
              className="btn-ghost tap-target"
            >
              {showMethodology ? 'Hide methodology' : 'Methodology'}
            </button>
          </div>

          <p className="caption detail-summary-paragraph">{detail.effectsAnalysis.lead}</p>

          {showMethodology && (
            <p className="footnote detail-summary-paragraph">
              {detail.effectsAnalysis.methodology}
            </p>
          )}

          <div className="effects-controls-bar">
            <Tabs
              tabs={[
                {
                  id: 'positive' as EffectsTab,
                  label: `Positive (${sortedPositiveStats.length} of ${detail.effectsAnalysis.positiveTotal})`,
                },
                {
                  id: 'adverse' as EffectsTab,
                  label: `Adverse (${sortedAdverseStats.length} of ${detail.effectsAnalysis.adverseTotal})`,
                },
                {
                  id: 'all' as EffectsTab,
                  label: 'Side-by-side',
                },
              ]}
              value={effectsTab}
              onChange={setEffectsTab}
            />

            <div className="inline-filter-shell">
              <Search size={14} strokeWidth={1.75} className="inline-filter-icon" aria-hidden="true" />
              <input
                type="search"
                value={effectSearch}
                onChange={(e) => setEffectSearch(e.target.value)}
                placeholder="Filter effects…"
                className="inline-filter-input"
                aria-label="Filter statistical effects"
              />
              {effectSearch && (
                <button
                  type="button"
                  onClick={() => setEffectSearch('')}
                  className="inline-filter-clear"
                  aria-label="Clear effect filter"
                >
                  <X size={13} strokeWidth={1.9} />
                </button>
              )}
            </div>
          </div>

          <div className="effect-stat-legend footnote">
            <span>Effect mention frequency (click row for CI detail)</span>
            <div className="effect-stat-metrics tabular-nums">
              <button
                type="button"
                onClick={() => toggleEffectSort('share')}
                className={`effect-stat-col-share sort-col-btn ${
                  effectSort.key === 'share' ? 'sort-col-active' : ''
                }`}
              >
                <span>Share</span>
                {effectSort.key === 'share' &&
                  (effectSort.dir === 'desc' ? (
                    <ArrowDown size={11} strokeWidth={2.2} />
                  ) : (
                    <ArrowUp size={11} strokeWidth={2.2} />
                  ))}
              </button>
              <button
                type="button"
                onClick={() => toggleEffectSort('ci')}
                className={`effect-stat-col-ci sort-col-btn ${
                  effectSort.key === 'ci' ? 'sort-col-active' : ''
                }`}
                title="Sort by 95% confidence interval width"
              >
                <span>95% CI</span>
                {effectSort.key === 'ci' &&
                  (effectSort.dir === 'desc' ? (
                    <ArrowDown size={11} strokeWidth={2.2} />
                  ) : (
                    <ArrowUp size={11} strokeWidth={2.2} />
                  ))}
              </button>
              <button
                type="button"
                onClick={() => toggleEffectSort('confidence')}
                className={`effect-stat-conf sort-col-btn ${
                  effectSort.key === 'confidence' ? 'sort-col-active' : ''
                }`}
              >
                <span>Conf.</span>
                {effectSort.key === 'confidence' &&
                  (effectSort.dir === 'desc' ? (
                    <ArrowDown size={11} strokeWidth={2.2} />
                  ) : (
                    <ArrowUp size={11} strokeWidth={2.2} />
                  ))}
              </button>
            </div>
          </div>

          {effectsTab === 'all' ? (
            <div className="effects-dual-grid">
              <div>
                <h3 className="section-heading">
                  Positive ({sortedPositiveStats.length} of{' '}
                  {detail.effectsAnalysis.positiveTotal})
                </h3>
                <div className="settings-section">
                  {sortedPositiveStats.map((row) => (
                    <EffectStatRow
                      key={row.name}
                      row={row}
                      kind="positive"
                      expanded={expandedStatName === `pos:${row.name}`}
                      onToggle={() =>
                        setExpandedStatName((cur) =>
                          cur === `pos:${row.name}` ? null : `pos:${row.name}`
                        )
                      }
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="section-heading">
                  Adverse ({sortedAdverseStats.length} of{' '}
                  {detail.effectsAnalysis.adverseTotal})
                </h3>
                <div className="settings-section">
                  {sortedAdverseStats.map((row) => (
                    <EffectStatRow
                      key={row.name}
                      row={row}
                      kind="adverse"
                      expanded={expandedStatName === `adv:${row.name}`}
                      onToggle={() =>
                        setExpandedStatName((cur) =>
                          cur === `adv:${row.name}` ? null : `adv:${row.name}`
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="settings-section">
              {(effectsTab === 'positive'
                ? sortedPositiveStats
                : sortedAdverseStats
              ).map((row) => {
                const statKey = `${effectsTab}:${row.name}`;
                return (
                  <EffectStatRow
                    key={row.name}
                    row={row}
                    kind={effectsTab}
                    expanded={expandedStatName === statKey}
                    onToggle={() =>
                      setExpandedStatName((cur) => (cur === statKey ? null : statKey))
                    }
                  />
                );
              })}
              {(effectsTab === 'positive'
                ? sortedPositiveStats
                : sortedAdverseStats
              ).length === 0 && (
                <div className="empty-row">No effects match “{effectSearch}”.</div>
              )}
            </div>
          )}

          <p className="footnote detail-footnote">
            {detail.effectsAnalysis.combinationsFootnote}
          </p>
        </section>
      )}

      {/* 9. DOCUMENTED SUBJECTIVE EFFECTS (from PsychonautWiki & TripSit) */}
      {subjectiveEffects.length > 0 && (
        <section className="detail-section" id="section-subjective-effects">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Subjective effects</h2>
              <p className="caption">
                {subjectiveEffects.length} documented effects indexed from PsychonautWiki and TripSit
              </p>
            </div>
            <div className="subjective-header-controls">
              {subjectiveEffects.length > 14 && (
                <div className="inline-filter-shell">
                  <Search size={14} strokeWidth={1.75} className="inline-filter-icon" aria-hidden="true" />
                  <input
                    type="search"
                    value={subjectiveSearch}
                    onChange={(e) => setSubjectiveSearch(e.target.value)}
                    placeholder={`Filter ${subjectiveEffects.length} effects…`}
                    className="inline-filter-input"
                    aria-label="Filter subjective effects"
                  />
                  {subjectiveSearch && (
                    <button
                      type="button"
                      onClick={() => setSubjectiveSearch('')}
                      className="inline-filter-clear"
                      aria-label="Clear subjective effects filter"
                    >
                      <X size={13} strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              )}
              {subjectiveEffects.length > 18 && !subjectiveSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setShowAllEffects((v) => !v)}
                  className="btn-ghost tap-target"
                >
                  {showAllEffects
                    ? 'Show fewer'
                    : `Show all ${subjectiveEffects.length}`}
                </button>
              )}
            </div>
          </div>

          {visibleEffects.length === 0 ? (
            <div className="empty-row">No subjective effects match “{subjectiveSearch}”.</div>
          ) : (
            <div className="effects-tag-cloud">
              {visibleEffects.map((eff) =>
                eff.url ? (
                  <a
                    key={eff.name}
                    href={eff.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary effect-tag-link"
                  >
                    <span>{eff.name}</span>
                    <ArrowUpRight size={13} strokeWidth={1.75} />
                  </a>
                ) : (
                  <span key={eff.name} className="btn-secondary effect-tag-static">
                    {eff.name}
                  </span>
                )
              )}
            </div>
          )}
        </section>
      )}

      {/* 10. COMBINATIONS & INTERACTIONS (if present) */}
      {detail.combinations.length > 0 && (
        <section className="detail-section" id="section-combinations">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Combinations</h2>
              <p className="caption">Interaction risks &amp; potentiation profile</p>
            </div>
          </div>

          {comboTabs.length > 0 && (
            <div className="detail-tabs-wrap">
              <Tabs tabs={comboTabs} value={comboFilter} onChange={setComboFilter} />
            </div>
          )}

          <div className="settings-section">
            {filteredCombinations.map((combo) => {
              const partner = resolveCatalogMatch(combo.substance, catalog, detail.id);
              return (
                <div key={combo.substance} className="interaction-row interaction-row-linked">
                  <div className="interaction-top">
                    <div className="interaction-target-group">
                      {partner && onOpenSubstance ? (
                        <button
                          type="button"
                          onClick={() => onOpenSubstance(partner)}
                          className="interaction-target inline-entity-link"
                        >
                          {combo.substance}
                        </button>
                      ) : (
                        <span className="interaction-target">{combo.substance}</span>
                      )}
                      {partner && onOpenInteractionPair && (
                        <button
                          type="button"
                          onClick={() => onOpenInteractionPair([detail.id, partner.id])}
                          className="combo-compare-action footnote"
                          title={`Compare ${detail.name} and ${partner.name}`}
                        >
                          <GitCompareArrows size={13} strokeWidth={1.85} />
                          <span>Compare</span>
                        </button>
                      )}
                    </div>
                    <span className={`interaction-status status-${combo.tone}`}>
                      {combo.status}
                    </span>
                  </div>
                  {combo.note && <p className="interaction-note">{combo.note}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 11. COMMUNITY REPORTS (if present) */}
      {detail.communityReports && detail.communityReports.length > 0 && (
        <section className="detail-section" id="section-community">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">Community reports</h2>
              <p className="caption">
                Click any sentiment segment or count to filter sample reports
              </p>
            </div>
          </div>

          <div className="settings-section">
            {detail.communityReports.map((group) => {
              const total = Math.max(1, group.positive + group.neutral + group.cautionary);
              const posPct = (group.positive / total) * 100;
              const neuPct = (group.neutral / total) * 100;
              const cauPct = (group.cautionary / total) * 100;
              const activeVerdict = communityFilter[group.source] ?? null;

              const toggleVerdict = (v: SentimentVerdict) => {
                setCommunityFilter((prev) => ({
                  ...prev,
                  [group.source]: prev[group.source] === v ? null : v,
                }));
              };

              const visibleSamples = activeVerdict
                ? group.sampleReports.filter((r) => r.verdict === activeVerdict)
                : group.sampleReports;

              return (
                <div key={group.source} className="community-group-row">
                  <div className="community-group-head">
                    <div className="flex-center-gap">
                      <a
                        href={group.url}
                        target="_blank"
                        rel="noreferrer"
                        className="community-source-link body-strong"
                      >
                        {group.source}
                        <ArrowUpRight size={14} strokeWidth={1.75} />
                      </a>
                      <span className="caption tabular-nums">{group.summaryCount}</span>
                    </div>
                    <div className="community-counts tabular-nums caption">
                      <button
                        type="button"
                        onClick={() => toggleVerdict('Positive')}
                        aria-pressed={activeVerdict === 'Positive'}
                        className={`sentiment-filter-btn status-positive ${
                          activeVerdict === 'Positive' ? 'sentiment-filter-active' : ''
                        }`}
                      >
                        {group.positive} Positive ({Math.round(posPct)}%)
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVerdict('Neutral')}
                        aria-pressed={activeVerdict === 'Neutral'}
                        className={`sentiment-filter-btn status-neutral ${
                          activeVerdict === 'Neutral' ? 'sentiment-filter-active' : ''
                        }`}
                      >
                        {group.neutral} Neutral ({Math.round(neuPct)}%)
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVerdict('Cautionary')}
                        aria-pressed={activeVerdict === 'Cautionary'}
                        className={`sentiment-filter-btn status-warning ${
                          activeVerdict === 'Cautionary' ? 'sentiment-filter-active' : ''
                        }`}
                      >
                        {group.cautionary} Cautionary ({Math.round(cauPct)}%)
                      </button>
                    </div>
                  </div>

                  <div className="sentiment-bar sentiment-bar-interactive">
                    {group.positive > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleVerdict('Positive')}
                        className={`sentiment-seg-pos ${
                          activeVerdict && activeVerdict !== 'Positive'
                            ? 'sentiment-seg-dimmed'
                            : ''
                        }`}
                        style={{ width: `${posPct}%` }}
                        aria-label={`Filter Positive reports (${Math.round(posPct)}%)`}
                        title={`Positive: ${group.positive} (${Math.round(posPct)}%)`}
                      />
                    )}
                    {group.neutral > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleVerdict('Neutral')}
                        className={`sentiment-seg-neu ${
                          activeVerdict && activeVerdict !== 'Neutral'
                            ? 'sentiment-seg-dimmed'
                            : ''
                        }`}
                        style={{ width: `${neuPct}%` }}
                        aria-label={`Filter Neutral reports (${Math.round(neuPct)}%)`}
                        title={`Neutral: ${group.neutral} (${Math.round(neuPct)}%)`}
                      />
                    )}
                    {group.cautionary > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleVerdict('Cautionary')}
                        className={`sentiment-seg-cau ${
                          activeVerdict && activeVerdict !== 'Cautionary'
                            ? 'sentiment-seg-dimmed'
                            : ''
                        }`}
                        style={{ width: `${cauPct}%` }}
                        aria-label={`Filter Cautionary reports (${Math.round(cauPct)}%)`}
                        title={`Cautionary: ${group.cautionary} (${Math.round(cauPct)}%)`}
                      />
                    )}
                  </div>

                  {group.sampleReports.length > 0 && (
                    <div className="community-samples">
                      {visibleSamples.length > 0 ? (
                        visibleSamples.map((rep, idx) => {
                          const tone =
                            rep.verdict === 'Positive'
                              ? 'positive'
                              : rep.verdict === 'Cautionary'
                                ? 'warning'
                                : 'neutral';
                          return (
                            <div key={idx} className="community-sample-item">
                              <span className="caption">{rep.title}</span>
                              <span className="community-sample-trail tabular-nums footnote">
                                <span>{rep.dose}</span>
                                <span className={`status-${tone}`}>{rep.verdict}</span>
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="community-sample-item">
                          <span className="caption">
                            No {activeVerdict?.toLowerCase()} sample excerpts indexed.
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCommunityFilter((prev) => ({ ...prev, [group.source]: null }))
                            }
                            className="chart-clear-pin"
                          >
                            Show all
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 12. REFERENCE GUIDE, CITATIONS & HELPFUL LINKS */}
      {hasReferencesBlock && (
        <section className="detail-section" id="section-references">
          <div className="detail-section-header">
            <div>
              <h2 className="title-sm">References &amp; links</h2>
              <p className="caption">Monographs, scientific literature, and harm-reduction archives</p>
            </div>
            {citations.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllCitations((v) => !v)}
                className="btn-ghost tap-target"
              >
                {showAllCitations
                  ? 'Show fewer papers'
                  : `Show all ${citations.length} papers`}
              </button>
            )}
          </div>

          <div className="settings-section">
            {detail.referenceGuide && (
              <>
                <div className="interaction-row">
                  <div className="interaction-top">
                    <span className="interaction-target">{detail.referenceGuide.title}</span>
                    <span className="caption">{detail.referenceGuide.sourceLabel}</span>
                  </div>
                  <p className="interaction-note">{detail.referenceGuide.excerpt}</p>
                </div>

                <div className="interaction-row">
                  <div className="interaction-top">
                    <span className="interaction-target">
                      {detail.referenceGuide.shulginTitle}
                    </span>
                    <span className="caption">Monograph</span>
                  </div>
                  <p className="interaction-note">
                    {detail.referenceGuide.monographSummary}
                  </p>
                </div>
              </>
            )}

            {detail.helpfulLinks.map((link) => (
              <a
                key={link.title}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flat-row link-row"
              >
                <div className="link-row-text">
                  <span className="body-strong">{link.title}</span>
                  <span className="caption">{link.description}</span>
                </div>
                <span className="link-arrow">
                  <ArrowUpRight size={15} strokeWidth={1.75} />
                </span>
              </a>
            ))}

            {visibleCitations.map((cit, idx) =>
              cit.url ? (
                <a
                  key={idx}
                  href={cit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flat-row link-row"
                >
                  <div className="link-row-text">
                    <span className="body">{cit.title}</span>
                    <span className="footnote detail-muted-text">Scientific citation</span>
                  </div>
                  <span className="link-arrow">
                    <ArrowUpRight size={15} strokeWidth={1.75} />
                  </span>
                </a>
              ) : (
                <div key={idx} className="flat-row">
                  <span className="caption">{cit.title}</span>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </article>
  );
};
