import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeTimeAxis } from './DurationCurveSvg';

export interface ToleranceMilestoneItem {
  label: string;
  value: string;
  tone: 'danger' | 'warning' | 'positive' | 'neutral';
}

export interface ToleranceCurveInput {
  buildUp: string;
  reset: string;
  milestones: readonly ToleranceMilestoneItem[];
}

export function parseToleranceMinutes(str: string): [number, number] | null {
  if (!str || str === '—') return null;
  const s = str.toLowerCase().trim();
  const isMonths = /\bmo\b|month/.test(s);
  const isWeeks = /\bw\b|wk|week/.test(s);
  const isDays = /\bd\b|day/.test(s);
  const isHours = /\bh\b|hr|hour/.test(s);
  const isMins = /\bm\b|min/.test(s);
  if (!isMonths && !isWeeks && !isDays && !isHours && !isMins) return null;

  const mult = isMonths
    ? 43200
    : isWeeks
      ? 10080
      : isDays
        ? 1440
        : isHours
          ? 60
          : 1;
  const nums = s.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const a = parseFloat(nums[0]) * mult;
  const b = nums.length > 1 ? parseFloat(nums[1]) * mult : a;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return [Math.min(a, b), Math.max(a, b)];
}

function formatElapsedTolerance(minutes: number): string {
  if (minutes <= 0.5) return '0 (Just dosed)';
  if (minutes < 90) return `${Math.round(minutes)} min`;
  if (minutes < 2880) {
    const h = minutes / 60;
    return `${Number(h.toFixed(h < 10 ? 1 : 0))} h`;
  }
  const d = minutes / 1440;
  if (d < 45) {
    return `${Number(d.toFixed(d < 10 ? 1 : 0))} d`;
  }
  const wk = d / 7;
  return `${Number(wk.toFixed(1))} wk`;
}

export interface ToleranceCurveModel {
  baselineMin: number;
  halfMin: number;
  exponent: number;
  axisMaxMin: number;
  ticks: { minutes: number; label: string }[];
  strokePath: string;
  fillPath: string;
  halfX: number;
  halfY: number;
  baseX: number;
}

const W = 560;
const H = 134;
const X_LEFT = 24;
const X_RIGHT = 536;
const PLOT_W = X_RIGHT - X_LEFT;
const Y_TOP = 26;
const Y_MID = 61;
const Y_BASE = 96;

export function buildToleranceModel(tol: ToleranceCurveInput): ToleranceCurveModel | null {
  const baseMilestone = tol.milestones.find((m) => m.label.toLowerCase().includes('baseline'));
  const halfMilestone = tol.milestones.find((m) => m.label.toLowerCase().includes('half'));

  const baseRange =
    parseToleranceMinutes(baseMilestone?.value ?? '') ?? parseToleranceMinutes(tol.reset);
  if (!baseRange) return null;

  const baselineMin = (baseRange[0] + baseRange[1]) / 2;
  const halfRange = parseToleranceMinutes(halfMilestone?.value ?? '');
  const rawHalf = halfRange ? (halfRange[0] + halfRange[1]) / 2 : baselineMin * 0.45;
  const halfMin = Math.min(baselineMin * 0.82, Math.max(baselineMin * 0.18, rawHalf));

  const uHalf = halfMin / baselineMin;
  const rawP = Math.log(0.5) / Math.log(1 - uHalf);
  const exponent = Math.min(3.2, Math.max(0.75, rawP));

  const axis = computeTimeAxis(Math.max(baselineMin * 1.05, baseRange[1]));
  const xOf = (m: number) =>
    X_LEFT + (Math.min(Math.max(m, 0), axis.maxMinutes) / axis.maxMinutes) * PLOT_W;
  const residualAt = (m: number) => {
    if (m <= 0) return 1;
    if (m >= baselineMin) return 0;
    return Math.pow(1 - m / baselineMin, exponent);
  };
  const yOf = (r: number) => Y_BASE - r * (Y_BASE - Y_TOP);

  const samples = 40;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const m = (i / samples) * baselineMin;
    const x = xOf(m);
    const y = yOf(residualAt(m));
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const baseX = xOf(baselineMin);
  if (axis.maxMinutes > baselineMin * 1.01) {
    pts.push(`L ${X_RIGHT.toFixed(1)} ${Y_BASE}`);
  }
  const strokePath = pts.join(' ');
  const fillPath = `${strokePath} L ${X_RIGHT.toFixed(1)} ${Y_BASE} L ${X_LEFT.toFixed(1)} ${Y_BASE} Z`;

  return {
    baselineMin,
    halfMin,
    exponent,
    axisMaxMin: axis.maxMinutes,
    ticks: axis.ticks,
    strokePath,
    fillPath,
    halfX: xOf(halfMin),
    halfY: yOf(0.5),
    baseX,
  };
}

export interface ToleranceCurveSvgProps {
  tolerance: ToleranceCurveInput;
  snapMinutes?: number | null;
}

export const ToleranceCurveSvg: React.FC<ToleranceCurveSvgProps> = ({
  tolerance,
  snapMinutes = null,
}) => {
  const model = useMemo(() => buildToleranceModel(tolerance), [tolerance]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [elapsedMin, setElapsedMin] = useState<number>(() =>
    model ? model.halfMin : 0
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (model) {
      setElapsedMin(model.halfMin);
    }
  }, [model]);

  useEffect(() => {
    if (snapMinutes !== null && model) {
      setElapsedMin(Math.min(model.axisMaxMin, Math.max(0, snapMinutes)));
    }
  }, [snapMinutes, model]);

  if (!model) return null;

  const xOf = (m: number) =>
    X_LEFT + (Math.min(Math.max(m, 0), model.axisMaxMin) / model.axisMaxMin) * PLOT_W;

  const residual =
    elapsedMin <= 0
      ? 1
      : elapsedMin >= model.baselineMin
        ? 0
        : Math.pow(1 - elapsedMin / model.baselineMin, model.exponent);

  const recoveryPct = Math.round((1 - residual) * 100);
  const residualPct = Math.round(residual * 100);
  const activeX = xOf(elapsedMin);
  const activeY = Y_BASE - residual * (Y_BASE - Y_TOP);

  const statusInfo =
    residualPct >= 65
      ? { label: 'High tolerance', tone: 'danger' as const }
      : residualPct >= 25
        ? { label: 'Partial tolerance', tone: 'warning' as const }
        : residualPct > 0
          ? { label: 'Near baseline', tone: 'positive' as const }
          : { label: 'Baseline restored', tone: 'positive' as const };

  const clientXToMin = (clientX: number): number | null => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const norm = Math.min(1, Math.max(0, (svgX - X_LEFT) / PLOT_W));
    return norm * model.axisMaxMin;
  };

  return (
    <div className="duration-curve-wrap tolerance-curve-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`duration-curve-svg chart-interactive ${isDragging ? 'chart-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Interactive tolerance recovery estimator. Drag or use arrow keys to simulate days since last dose."
        aria-valuemin={0}
        aria-valuemax={Math.round(model.axisMaxMin)}
        aria-valuenow={Math.round(elapsedMin)}
        aria-valuetext={`${formatElapsedTolerance(elapsedMin)} since last dose, ${residualPct}% residual tolerance, ${statusInfo.label}`}
        onPointerDown={(e) => {
          const m = clientXToMin(e.clientX);
          if (m === null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setIsDragging(true);
          setElapsedMin(m);
        }}
        onPointerMove={(e) => {
          if (!isDragging) return;
          const m = clientXToMin(e.clientX);
          if (m !== null) setElapsedMin(m);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          setIsDragging(false);
        }}
        onPointerCancel={() => setIsDragging(false)}
        onKeyDown={(e) => {
          const step = model.axisMaxMin / 20;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            setElapsedMin((v) => Math.min(model.axisMaxMin, v + step));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            setElapsedMin((v) => Math.max(0, v - step));
          } else if (e.key === 'Home') {
            e.preventDefault();
            setElapsedMin(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            setElapsedMin(model.baselineMin);
          }
        }}
      >
        {/* Horizontal grid lines: 100%, 50%, 0% */}
        <line x1={X_LEFT} y1={Y_TOP} x2={X_RIGHT} y2={Y_TOP} className="chart-grid-line" />
        <line x1={X_LEFT} y1={Y_MID} x2={X_RIGHT} y2={Y_MID} className="chart-grid-line" strokeDasharray="2 3" />
        <line x1={X_LEFT} y1={Y_BASE} x2={X_RIGHT} y2={Y_BASE} className="chart-grid-line" />

        {/* Vertical milestone guides */}
        <line
          x1={model.halfX}
          y1={Y_TOP}
          x2={model.halfX}
          y2={Y_BASE}
          className="chart-grid-line"
          strokeDasharray="2 3"
        />
        <line
          x1={model.baseX}
          y1={Y_TOP}
          x2={model.baseX}
          y2={Y_BASE}
          className="chart-grid-line"
          strokeDasharray="2 3"
        />

        {/* Area & decay curve */}
        <path d={model.fillPath} className="chart-area-fill" />
        <path d={model.strokePath} className="chart-curve-stroke" />

        {/* Static landmark dots (Half tolerance & Baseline) */}
        <circle
          cx={model.halfX}
          cy={model.halfY}
          r={3.5}
          className="chart-phase-dot chart-phase-dot-interactive"
          onPointerDown={(e) => {
            e.stopPropagation();
            setElapsedMin(model.halfMin);
          }}
        >
          <title>Half tolerance (~{formatElapsedTolerance(model.halfMin)})</title>
        </circle>
        <circle
          cx={model.baseX}
          cy={Y_BASE}
          r={3.5}
          className="chart-phase-dot chart-phase-dot-interactive"
          onPointerDown={(e) => {
            e.stopPropagation();
            setElapsedMin(model.baselineMin);
          }}
        >
          <title>Baseline (~{formatElapsedTolerance(model.baselineMin)})</title>
        </circle>

        {/* Interactive scrubber line + dot */}
        <g className="chart-scrubber" aria-hidden="true">
          <line
            x1={activeX}
            y1={Y_TOP - 6}
            x2={activeX}
            y2={Y_BASE}
            className="chart-scrubber-line"
          />
          <circle cx={activeX} cy={activeY} r={5} className="chart-scrubber-dot" />
        </g>

        {/* Top labels */}
        <text x={X_LEFT} y={14} textAnchor="start" className="chart-axis-text">
          100% tolerance
        </text>
        <text x={model.halfX} y={14} textAnchor="middle" className="chart-axis-text">
          Half (50%)
        </text>
        <text
          x={Math.min(X_RIGHT, model.baseX)}
          y={14}
          textAnchor={model.baseX > X_RIGHT - 36 ? 'end' : 'middle'}
          className="chart-axis-text"
        >
          Baseline
        </text>

        {/* Bottom time axis ticks */}
        {model.ticks.map((tick, idx) => {
          const tx = xOf(tick.minutes);
          const anchor =
            idx === 0 ? 'start' : idx === model.ticks.length - 1 ? 'end' : 'middle';
          return (
            <g key={idx}>
              <line x1={tx} y1={Y_BASE} x2={tx} y2={Y_BASE + 4} className="chart-tick-line" />
              <text x={tx} y={118} textAnchor={anchor} className="chart-axis-text tabular-nums">
                {tick.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="duration-curve-meta">
        <div className="duration-scrub-readout tabular-nums">
          <span className="body-strong">{formatElapsedTolerance(elapsedMin)}</span>
          <span className={`status-${statusInfo.tone}`}>{statusInfo.label}</span>
          <span>Residual {residualPct}%</span>
          <span>Recovery {recoveryPct}%</span>
        </div>
        <span className="duration-scrub-hint">Drag curve to estimate recovery</span>
      </div>
    </div>
  );
};
