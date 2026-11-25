import React, { useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { DurationTableRow } from '../data/lsdDetail';
import {
  CURVE_PLOT_W,
  CURVE_VIEW_H,
  CURVE_VIEW_W,
  CURVE_X_LEFT,
  CURVE_X_RIGHT,
  CURVE_Y_BASE,
  CURVE_Y_MID,
  CURVE_Y_PEAK,
  buildDurationCurveModel,
  computeTimeAxis,
  evaluateCurveAt,
  formatDurationShort,
  formatRoaDisplay,
  type DurationCurveModel,
} from './DurationCurveSvg';

export interface CombinedTimelineItem {
  id: string;
  name: string;
  row: DurationTableRow;
}

export interface CombinedTimelineSvgProps {
  items: CombinedTimelineItem[];
}

const SERIES_CLASSES = [
  'combined-series-0',
  'combined-series-1',
  'combined-series-2',
  'combined-series-3',
] as const;

function buildSampledPath(
  model: DurationCurveModel,
  offsetMin: number,
  axisMax: number
): { stroke: string; fill: string } {
  const xOf = (t: number) =>
    CURVE_X_LEFT + (Math.min(Math.max(t, 0), axisMax) / axisMax) * CURVE_PLOT_W;
  const startT = Math.max(0, offsetMin);
  const endT = Math.min(axisMax, offsetMin + model.axis.maxMinutes);
  if (endT <= startT) {
    return { stroke: '', fill: '' };
  }

  const samples = 72;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = startT + (i / samples) * (endT - startT);
    const localT = t - offsetMin;
    const { y } = evaluateCurveAt(model, localT);
    pts.push(`${i === 0 ? 'M' : 'L'} ${xOf(t).toFixed(1)} ${y.toFixed(1)}`);
  }
  const stroke = pts.join(' ');
  const fill = `${stroke} L ${xOf(endT).toFixed(1)} ${CURVE_Y_BASE} L ${xOf(startT).toFixed(1)} ${CURVE_Y_BASE} Z`;
  return { stroke, fill };
}

function getActivePeakWindow(model: DurationCurveModel): [number, number] {
  if (model.mode === 'phases') {
    return model.spans.peak;
  }
  const crest = model.spans.comeup[1];
  const end = model.spans.offset[1];
  const half = Math.max(5, (end - crest) * 0.25);
  return [Math.max(0, crest - half * 0.4), Math.min(end, crest + half)];
}

export const CombinedTimelineSvg: React.FC<CombinedTimelineSvgProps> = ({ items }) => {
  const [offsetsMin, setOffsetsMin] = useState<Record<string, number>>({});
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  const [pinnedMin, setPinnedMin] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const compiled = useMemo(() => {
    const entries = items
      .map((item) => {
        const model = buildDurationCurveModel(item.row);
        if (!model) return null;
        return {
          ...item,
          model,
          offsetMin: offsetsMin[item.id] ?? 0,
        };
      })
      .filter((x): x is CombinedTimelineItem & { model: DurationCurveModel; offsetMin: number } =>
        Boolean(x)
      );

    if (entries.length < 2) return null;

    // Normalize negative offsets so earliest intake is at t = 0
    const minOffset = Math.min(...entries.map((e) => e.offsetMin), 0);
    const shifted = entries.map((e) => ({
      ...e,
      plotOffset: e.offsetMin - minOffset,
    }));

    const rawMax = Math.max(
      ...shifted.map((e) => e.plotOffset + e.model.axis.maxMinutes)
    );
    const axis = computeTimeAxis(rawMax);

    const series = shifted.map((e, idx) => {
      const { stroke, fill } = buildSampledPath(e.model, e.plotOffset, axis.maxMinutes);
      const [p0, p1] = getActivePeakWindow(e.model);
      return {
        ...e,
        seriesClass: SERIES_CLASSES[idx % SERIES_CLASSES.length],
        stroke,
        fill,
        peakWindow: [p0 + e.plotOffset, p1 + e.plotOffset] as [number, number],
      };
    });

    // Compute peak overlap between first two substances (or any pair)
    let overlapWindow: [number, number] | null = null;
    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        const lo = Math.max(series[i].peakWindow[0], series[j].peakWindow[0]);
        const hi = Math.min(series[i].peakWindow[1], series[j].peakWindow[1]);
        if (hi > lo + 1) {
          if (!overlapWindow) {
            overlapWindow = [lo, hi];
          } else {
            overlapWindow = [Math.min(overlapWindow[0], lo), Math.max(overlapWindow[1], hi)];
          }
        }
      }
    }

    // Smart stagger step size proportional to total scale
    const stepMin =
      axis.maxMinutes <= 60
        ? 5
        : axis.maxMinutes <= 240
          ? 15
          : axis.maxMinutes <= 2880
            ? 30
            : 1440;

    return { axis, series, overlapWindow, stepMin };
  }, [items, offsetsMin]);

  if (!compiled) return null;

  const { axis, series, overlapWindow, stepMin } = compiled;
  const xOf = (t: number) =>
    CURVE_X_LEFT + (Math.min(Math.max(t, 0), axis.maxMinutes) / axis.maxMinutes) * CURVE_PLOT_W;

  const clientXToMin = (clientX: number): number | null => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * CURVE_VIEW_W;
    const norm = Math.min(1, Math.max(0, (svgX - CURVE_X_LEFT) / CURVE_PLOT_W));
    return norm * axis.maxMinutes;
  };

  const activeMin = isDragging
    ? hoverMin
    : hoverMin !== null
      ? hoverMin
      : pinnedMin;

  const activeX = activeMin !== null ? xOf(activeMin) : null;

  const activeSamples =
    activeMin !== null
      ? series.map((s) => {
          const localT = activeMin - s.plotOffset;
          if (localT < 0) {
            return { ...s, intensity: 0, y: CURVE_Y_BASE, phase: 'Not yet taken' };
          }
          const ev = evaluateCurveAt(s.model, localT);
          return { ...s, ...ev };
        })
      : null;

  const adjustOffset = (id: string, delta: number) => {
    setOffsetsMin((prev) => {
      const next = (prev[id] ?? 0) + delta;
      const clamped = Math.max(-axis.maxMinutes * 0.5, Math.min(axis.maxMinutes * 0.75, next));
      return { ...prev, [id]: clamped };
    });
  };

  const hasAnyOffset = Object.values(offsetsMin).some((v) => Math.abs(v) > 0.1);

  return (
    <div className="combined-timeline-block">
      <div className="duration-curve-wrap">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CURVE_VIEW_W} ${CURVE_VIEW_H}`}
          className={`duration-curve-svg chart-interactive ${isDragging ? 'chart-dragging' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label="Interactive combined duration timeline. Hover, drag, or use arrow keys to compare simultaneous phases."
          aria-valuemin={0}
          aria-valuemax={Math.round(axis.maxMinutes)}
          aria-valuenow={activeMin !== null ? Math.round(activeMin) : 0}
          onPointerDown={(e) => {
            const m = clientXToMin(e.clientX);
            if (m === null) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsDragging(true);
            setHoverMin(m);
            setPinnedMin(m);
          }}
          onPointerMove={(e) => {
            const m = clientXToMin(e.clientX);
            if (m === null) return;
            setHoverMin(m);
            if (isDragging) setPinnedMin(m);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            setIsDragging(false);
          }}
          onPointerCancel={() => setIsDragging(false)}
          onPointerLeave={() => {
            if (!isDragging) setHoverMin(null);
          }}
          onKeyDown={(e) => {
            const step = axis.maxMinutes / 24;
            const base = activeMin ?? 0;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              setPinnedMin(Math.min(axis.maxMinutes, base + step));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              setPinnedMin(Math.max(0, base - step));
            } else if (e.key === 'Escape') {
              setPinnedMin(null);
              setHoverMin(null);
            }
          }}
        >
          {/* Reference grid */}
          <line x1={CURVE_X_LEFT} y1={CURVE_Y_PEAK} x2={CURVE_X_RIGHT} y2={CURVE_Y_PEAK} className="chart-grid-line" />
          <line x1={CURVE_X_LEFT} y1={CURVE_Y_MID} x2={CURVE_X_RIGHT} y2={CURVE_Y_MID} className="chart-grid-line" />
          <line x1={CURVE_X_LEFT} y1={CURVE_Y_BASE} x2={CURVE_X_RIGHT} y2={CURVE_Y_BASE} className="chart-grid-line" />

          {/* Highlighted peak overlap band */}
          {overlapWindow && (
            <>
              <rect
                x={xOf(overlapWindow[0])}
                y={CURVE_Y_PEAK - 6}
                width={Math.max(2, xOf(overlapWindow[1]) - xOf(overlapWindow[0]))}
                height={CURVE_Y_BASE - CURVE_Y_PEAK + 6}
                className="chart-overlap-band"
              />
              <text
                x={(xOf(overlapWindow[0]) + xOf(overlapWindow[1])) / 2}
                y={18}
                textAnchor="middle"
                className="chart-phase-label"
              >
                Peak overlap ({formatDurationShort(overlapWindow[0])} –{' '}
                {formatDurationShort(overlapWindow[1])})
              </text>
            </>
          )}

          {!overlapWindow && (
            <text x={CURVE_X_LEFT} y={18} textAnchor="start" className="chart-axis-text">
              Peaks separated on current timing
            </text>
          )}

          {/* Area fills */}
          {series.map((s) =>
            s.fill ? (
              <path key={`${s.id}-fill`} d={s.fill} className={`combined-area ${s.seriesClass}`} />
            ) : null
          )}

          {/* Curves */}
          {series.map((s) =>
            s.stroke ? (
              <path
                key={`${s.id}-stroke`}
                d={s.stroke}
                className={`combined-stroke ${s.seriesClass}`}
              />
            ) : null
          )}

          {/* Active scrubber line + per-series dots */}
          {activeX !== null && activeSamples && (
            <g className="chart-scrubber" aria-hidden="true">
              <line
                x1={activeX}
                y1={CURVE_Y_PEAK - 8}
                x2={activeX}
                y2={CURVE_Y_BASE}
                className="chart-scrubber-line"
              />
              {activeSamples.map((s) => (
                <circle
                  key={s.id}
                  cx={activeX}
                  cy={s.y}
                  r={4.5}
                  className={`combined-dot ${s.seriesClass}`}
                />
              ))}
            </g>
          )}

          {/* Shared numeric time axis ticks */}
          {axis.ticks.map((tick, idx) => {
            const tx = xOf(tick.minutes);
            const anchor =
              idx === 0 ? 'start' : idx === axis.ticks.length - 1 ? 'end' : 'middle';
            return (
              <g key={idx}>
                <line x1={tx} y1={CURVE_Y_BASE} x2={tx} y2={CURVE_Y_BASE + 4} className="chart-tick-line" />
                <text x={tx} y={136} textAnchor={anchor} className="chart-axis-text tabular-nums">
                  {tick.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Live readout or legend */}
        <div className="duration-curve-meta">
          {activeMin !== null && activeSamples ? (
            <>
              <div className="duration-scrub-readout tabular-nums">
                <span className="body-strong">
                  {activeMin <= 0.01 ? '0 (Start)' : `+${formatDurationShort(activeMin)}`}
                </span>
                {activeSamples.map((s) => (
                  <span key={s.id} className="duration-legend-item">
                    <span className={`combined-swatch ${s.seriesClass}`} aria-hidden="true" />
                    <span>
                      {s.name}: {s.phase} ({Math.round(s.intensity * 100)}%)
                    </span>
                  </span>
                ))}
              </div>
              {pinnedMin !== null && (
                <button
                  type="button"
                  className="chart-clear-pin"
                  onClick={() => {
                    setPinnedMin(null);
                    setHoverMin(null);
                  }}
                >
                  Clear pin
                </button>
              )}
            </>
          ) : (
            <>
              <div className="duration-curve-legend">
                {series.map((s) => (
                  <span key={s.id} className="duration-legend-item">
                    <span className={`combined-swatch ${s.seriesClass}`} aria-hidden="true" />
                    <span>
                      {s.name} ({formatRoaDisplay(s.row.roa)})
                    </span>
                  </span>
                ))}
              </div>
              <span className="duration-scrub-hint">Hover or drag to compare overlap</span>
            </>
          )}
        </div>
      </div>

      {/* Interactive timing stagger steppers */}
      <div className="settings-section stagger-controls-list">
        {series.map((s, idx) => {
          const offset = offsetsMin[s.id] ?? 0;
          const offsetLabel =
            Math.abs(offset) < 0.1
              ? idx === 0
                ? 'Reference (0)'
                : 'Same time (0)'
              : `${offset > 0 ? '+' : '−'}${formatDurationShort(Math.abs(offset))}`;
          return (
            <div key={s.id} className="flat-row stagger-row">
              <span className="stagger-row-lead">
                <span className={`combined-swatch ${s.seriesClass}`} aria-hidden="true" />
                <span className="flat-row-label">{s.name} intake</span>
              </span>
              {idx === 0 ? (
                <span className="caption tabular-nums">
                  {offsetLabel}
                  {hasAnyOffset && (
                    <button
                      type="button"
                      className="stagger-reset-btn"
                      onClick={() => setOffsetsMin({})}
                    >
                      <RotateCcw size={13} strokeWidth={1.85} />
                      <span>Reset timing</span>
                    </button>
                  )}
                </span>
              ) : (
                <div className="stagger-stepper tabular-nums">
                  <button
                    type="button"
                    className="btn-ghost btn-icon-circle tap-target stagger-step-btn"
                    onClick={() => adjustOffset(s.id, -stepMin)}
                    aria-label={`Shift ${s.name} earlier by ${formatDurationShort(stepMin)}`}
                  >
                    <Minus size={14} strokeWidth={2} />
                  </button>
                  <span className="stagger-value">{offsetLabel}</span>
                  <button
                    type="button"
                    className="btn-ghost btn-icon-circle tap-target stagger-step-btn"
                    onClick={() => adjustOffset(s.id, stepMin)}
                    aria-label={`Shift ${s.name} later by ${formatDurationShort(stepMin)}`}
                  >
                    <Plus size={14} strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
