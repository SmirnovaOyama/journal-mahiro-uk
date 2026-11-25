import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DurationTableRow } from '../data/lsdDetail';

export function parseDurationMinutes(str: string): [number, number] | null {
  if (!str || str === '—') return null;
  const cleaned = str
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .trim();
  const isWeeks = /\bw\b|wk|week/.test(cleaned);
  const isDays = /\bd\b|day/.test(cleaned);
  const isHours = /\bh\b|hr|hour/.test(cleaned);
  const isSeconds = /\bs\b|sec/.test(cleaned);
  const mult = isWeeks
    ? 10080
    : isDays
      ? 1440
      : isHours
        ? 60
        : isSeconds
          ? 1 / 60
          : 1;
  const nums = cleaned.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const a = parseFloat(nums[0]) * mult;
  const b = nums.length > 1 ? parseFloat(nums[1]) * mult : a;
  if (!Number.isFinite(a) || !Number.isFinite(b) || (a === 0 && b === 0)) return null;
  return [Math.min(a, b), Math.max(a, b)];
}

export function formatDurationShort(minutes: number): string {
  if (minutes <= 0.001) return '0';
  if (minutes < 1.5) {
    return `${Math.max(1, Math.round(minutes * 60))} s`;
  }
  if (minutes < 90) {
    return `${Math.round(minutes)} min`;
  }
  if (minutes < 2880) {
    const h = minutes / 60;
    return `${Number(h.toFixed(h < 10 ? 1 : 0))} h`;
  }
  const d = minutes / 1440;
  return `${Number(d.toFixed(d < 10 ? 1 : 0))} d`;
}

export function formatClockAtOffset(baseMinutes: number, addMinutes: number): string {
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

export function formatRoaDisplay(roa: string): string {
  return roa.replace(/_/g, ' ');
}

export interface AxisTick {
  minutes: number;
  label: string;
}

export interface TimeAxis {
  maxMinutes: number;
  ticks: AxisTick[];
}

export function computeTimeAxis(rawMaxMinutes: number): TimeAxis {
  const safeRaw = Math.max(rawMaxMinutes, 0.25);

  let rawUnits: number;
  let unitToMin: number;
  let steps: number[];
  let formatUnit: (v: number) => string;

  if (safeRaw <= 2) {
    rawUnits = safeRaw * 60;
    unitToMin = 1 / 60;
    steps = [5, 10, 15, 20, 30];
    formatUnit = (v) => (v === 0 ? '0' : v % 60 === 0 ? `${v / 60} m` : `${v} s`);
  } else if (safeRaw <= 90) {
    rawUnits = safeRaw;
    unitToMin = 1;
    steps = [1, 2, 3, 4, 5, 10, 15, 20, 30];
    formatUnit = (v) => (v === 0 ? '0' : `${v} m`);
  } else if (safeRaw <= 2880) {
    rawUnits = safeRaw / 60;
    unitToMin = 60;
    steps = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12];
    formatUnit = (v) => {
      if (v === 0) return '0';
      if (v < 1) return `${Math.round(v * 60)} m`;
      return `${Number(v.toFixed(1))} h`;
    };
  } else {
    rawUnits = safeRaw / 1440;
    unitToMin = 1440;
    steps = [1, 2, 3, 4, 5, 7, 10, 14, 15, 20, 30];
    formatUnit = (v) => (v === 0 ? '0' : `${v} d`);
  }

  let best = { n: 4, step: steps[steps.length - 1], score: Number.POSITIVE_INFINITY };
  for (const step of steps) {
    for (const n of [4, 3, 5]) {
      const cap = n * step;
      if (cap < rawUnits * 0.999) continue;
      const waste = (cap - rawUnits) / rawUnits;
      const isInt = Math.abs(step - Math.round(step)) < 1e-6;
      const score = waste - (isInt ? 0.08 : 0) - (n === 4 ? 0.04 : 0);
      if (score < best.score) {
        best = { n, step, score };
      }
    }
  }

  if (!Number.isFinite(best.score)) {
    const step = Math.ceil(rawUnits / 4);
    best = { n: 4, step, score: 0 };
  }

  const maxMinutes = best.n * best.step * unitToMin;
  const ticks: AxisTick[] = [];
  for (let i = 0; i <= best.n; i++) {
    const val = i * best.step;
    ticks.push({
      minutes: val * unitToMin,
      label: formatUnit(val),
    });
  }

  return { maxMinutes, ticks };
}

export interface PhaseDot {
  x: number;
  y: number;
  minutes: number;
  title: string;
}

interface TopLabel {
  x: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  muted?: boolean;
}

export interface PhaseSpans {
  onset: [number, number];
  comeup: [number, number];
  peak: [number, number];
  offset: [number, number];
  tail: [number, number];
  hasTail: boolean;
}

export interface DurationCurveModel {
  mode: 'phases' | 'simple';
  axis: TimeAxis;
  primaryStroke: string;
  primaryFill: string;
  upperStroke: string | null;
  dots: PhaseDot[];
  guideXs: number[];
  topLabels: TopLabel[];
  afterEffectsLabel: string | null;
  noteLabel: string | null;
  spans: PhaseSpans;
}

export const CURVE_VIEW_W = 560;
export const CURVE_VIEW_H = 152;
export const CURVE_X_LEFT = 24;
export const CURVE_X_RIGHT = 536;
export const CURVE_PLOT_W = CURVE_X_RIGHT - CURVE_X_LEFT;
export const CURVE_Y_PEAK = 34;
export const CURVE_Y_MID = 73;
export const CURVE_Y_BASE = 112;
export const CURVE_Y_ONSET = CURVE_Y_BASE - 9;

const midOf = (r: [number, number]) => (r[0] + r[1]) / 2;
const pickBound = (r: [number, number], bound: 'mid' | 'high') =>
  bound === 'mid' ? midOf(r) : r[1];

/** Smooth S-curve easing matching our SVG cubic Bézier segments */
function smoothEase(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

/**
 * Evaluate normalized intensity [0, 1] and phase name at elapsed `minutes`
 * for a given DurationCurveModel. Shared by DurationCurveSvg and CombinedTimelineSvg.
 */
export function evaluateCurveAt(
  model: DurationCurveModel,
  minutes: number
): { intensity: number; y: number; phase: string } {
  const { spans, mode } = model;
  const onsetNorm = (CURVE_Y_BASE - CURVE_Y_ONSET) / (CURVE_Y_BASE - CURVE_Y_PEAK); // ~0.115
  const t = Math.max(0, minutes);

  let intensity = 0;
  let phase = 'Baseline';

  if (mode === 'phases') {
    const [, tOnset] = spans.onset;
    const [, tPeakStart] = spans.comeup;
    const [, tPeakEnd] = spans.peak;
    const [, tOffsetEnd] = spans.offset;
    const [, tTailEnd] = spans.tail;
    const endNorm = spans.hasTail && tTailEnd > tOffsetEnd + 0.01 ? onsetNorm : 0;

    if (t <= 0) {
      intensity = 0;
      phase = 'Intake';
    } else if (t < tOnset) {
      const u = tOnset > 0 ? t / tOnset : 1;
      intensity = onsetNorm * Math.pow(u, 1.8);
      phase = 'Onset';
    } else if (t < tPeakStart) {
      const span = tPeakStart - tOnset;
      const u = span > 0 ? (t - tOnset) / span : 1;
      intensity = onsetNorm + (1 - onsetNorm) * smoothEase(u);
      phase = 'Comeup';
    } else if (t <= tPeakEnd) {
      intensity = 1;
      phase = 'Peak';
    } else if (t < tOffsetEnd) {
      const span = tOffsetEnd - tPeakEnd;
      const u = span > 0 ? (t - tPeakEnd) / span : 1;
      // Exponential-like descent matching our SVG curve
      const decay = 1 - smoothEase(Math.pow(u, 0.88));
      intensity = endNorm + (1 - endNorm) * decay;
      phase = 'Offset';
    } else if (spans.hasTail && t < tTailEnd) {
      const span = tTailEnd - tOffsetEnd;
      const u = span > 0 ? (t - tOffsetEnd) / span : 1;
      intensity = endNorm * (1 - smoothEase(u));
      phase = model.afterEffectsLabel ? 'After-effects' : 'Residual';
    } else {
      intensity = 0;
      phase = model.afterEffectsLabel ? 'After-effects' : 'Baseline';
    }
  } else {
    const [, tOnset] = spans.onset;
    const [, tCrest] = spans.comeup;
    const [, tEnd] = spans.offset;
    const [, tTailEnd] = spans.tail;
    const crestNorm = (CURVE_Y_BASE - (CURVE_Y_PEAK + 4)) / (CURVE_Y_BASE - CURVE_Y_PEAK);
    const endNorm = spans.hasTail && tTailEnd > tEnd + 0.01 ? onsetNorm : 0;

    if (t <= 0) {
      intensity = 0;
      phase = 'Intake';
    } else if (tOnset > 0 && t < tOnset) {
      intensity = onsetNorm * Math.pow(t / tOnset, 1.8);
      phase = 'Onset';
    } else if (t < tCrest) {
      const startNorm = tOnset > 0 ? onsetNorm : 0;
      const span = tCrest - tOnset;
      const u = span > 0 ? (t - tOnset) / span : 1;
      intensity = startNorm + (crestNorm - startNorm) * smoothEase(u);
      phase = 'Rising';
    } else if (t < tEnd) {
      const span = tEnd - tCrest;
      const u = span > 0 ? (t - tCrest) / span : 1;
      const decay = 1 - smoothEase(Math.pow(u, 0.88));
      intensity = endNorm + (crestNorm - endNorm) * decay;
      phase = u < 0.25 ? 'Active peak' : 'Declining';
    } else if (spans.hasTail && t < tTailEnd) {
      const span = tTailEnd - tEnd;
      const u = span > 0 ? (t - tEnd) / span : 1;
      intensity = endNorm * (1 - smoothEase(u));
      phase = 'After-effects';
    } else {
      intensity = 0;
      phase = model.afterEffectsLabel ? 'After-effects' : 'Baseline';
    }
  }

  const y = CURVE_Y_BASE - intensity * (CURVE_Y_BASE - CURVE_Y_PEAK);
  return { intensity, y, phase };
}

export function buildMultiPhasePaths(
  pts: {
    tOnset: number;
    tPeakStart: number;
    tPeakEnd: number;
    tOffsetEnd: number;
    tTailEnd: number;
  },
  xOf: (t: number) => number,
  hasResidualTail: boolean,
  yPeak = CURVE_Y_PEAK,
  yBase = CURVE_Y_BASE
): { stroke: string; fill: string; x1: number; x2: number; x3: number; x4: number; y4: number } {
  const yOnset = yBase - Math.round((yBase - yPeak) * 0.115);
  const x0 = xOf(0);
  const x1 = xOf(pts.tOnset);
  const x2 = xOf(pts.tPeakStart);
  const x3 = xOf(pts.tPeakEnd);
  const x4 = xOf(pts.tOffsetEnd);
  const x5 = xOf(pts.tTailEnd);
  const drawTail = hasResidualTail && x5 > x4 + 2;
  const y4 = drawTail ? yOnset : yBase;

  const segs: string[] = [`M ${x0.toFixed(1)} ${yBase}`];

  if (x1 > x0 + 0.5) {
    const c1x = x0 + (x1 - x0) * 0.55;
    const c2x = x0 + (x1 - x0) * 0.82;
    segs.push(
      `C ${c1x.toFixed(1)} ${yBase}, ${c2x.toFixed(1)} ${(yOnset + 2).toFixed(1)}, ${x1.toFixed(1)} ${yOnset}`
    );
  } else {
    segs.push(`L ${x1.toFixed(1)} ${yOnset}`);
  }

  const dxUp = x2 - x1;
  if (dxUp > 0.5) {
    const c1x = x1 + dxUp * 0.42;
    const c1y = yOnset - (yOnset - yPeak) * 0.14;
    const c2x = x1 + dxUp * 0.56;
    segs.push(
      `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${yPeak}, ${x2.toFixed(1)} ${yPeak}`
    );
  } else {
    segs.push(`L ${x2.toFixed(1)} ${yPeak}`);
  }

  if (x3 > x2 + 0.5) {
    segs.push(`L ${x3.toFixed(1)} ${yPeak}`);
  }

  const dxDown = x4 - x3;
  if (dxDown > 0.5) {
    const c1x = x3 + dxDown * 0.3;
    const c2x = x3 + dxDown * 0.62;
    const c2y = y4 - (y4 - yPeak) * 0.1;
    segs.push(
      `C ${c1x.toFixed(1)} ${yPeak}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x4.toFixed(1)} ${y4}`
    );
  } else {
    segs.push(`L ${x4.toFixed(1)} ${y4}`);
  }

  let xEnd = x4;
  if (drawTail) {
    const dxTail = x5 - x4;
    const c1x = x4 + dxTail * 0.35;
    const c2x = x4 + dxTail * 0.72;
    segs.push(
      `C ${c1x.toFixed(1)} ${y4}, ${c2x.toFixed(1)} ${yBase}, ${x5.toFixed(1)} ${yBase}`
    );
    xEnd = x5;
  }

  const stroke = segs.join(' ');
  const fill = `${stroke} L ${xEnd.toFixed(1)} ${yBase} L ${x0.toFixed(1)} ${yBase} Z`;
  return { stroke, fill, x1, x2, x3, x4, y4 };
}

export function buildSimplePaths(
  pts: { tOnset: number; tCrest: number; tEnd: number; tTailEnd: number },
  xOf: (t: number) => number,
  hasTail: boolean,
  yPeak = CURVE_Y_PEAK,
  yBase = CURVE_Y_BASE
): { stroke: string; fill: string; x1: number; xCrest: number; xEnd: number } {
  const yOnset = yBase - Math.round((yBase - yPeak) * 0.115);
  const x0 = xOf(0);
  const x1 = xOf(pts.tOnset);
  const xCrest = xOf(pts.tCrest);
  const xEnd = xOf(pts.tEnd);
  const xTail = xOf(pts.tTailEnd);
  const yCrest = yPeak + 4;
  const drawTail = hasTail && xTail > xEnd + 2;
  const yEnd = drawTail ? yOnset : yBase;

  const segs: string[] = [`M ${x0.toFixed(1)} ${yBase}`];

  if (x1 > x0 + 1) {
    const c1x = x0 + (x1 - x0) * 0.55;
    const c2x = x0 + (x1 - x0) * 0.85;
    segs.push(
      `C ${c1x.toFixed(1)} ${yBase}, ${c2x.toFixed(1)} ${(yOnset + 2).toFixed(1)}, ${x1.toFixed(1)} ${yOnset}`
    );
    const dxUp = xCrest - x1;
    segs.push(
      `C ${(x1 + dxUp * 0.36).toFixed(1)} ${(yOnset - (yOnset - yCrest) * 0.2).toFixed(1)}, ${(x1 + dxUp * 0.55).toFixed(1)} ${yCrest}, ${xCrest.toFixed(1)} ${yCrest}`
    );
  } else {
    const dxUp = xCrest - x0;
    segs.push(
      `C ${(x0 + dxUp * 0.32).toFixed(1)} ${yBase}, ${(x0 + dxUp * 0.52).toFixed(1)} ${yCrest}, ${xCrest.toFixed(1)} ${yCrest}`
    );
  }

  const dxDown = xEnd - xCrest;
  segs.push(
    `C ${(xCrest + dxDown * 0.32).toFixed(1)} ${yCrest}, ${(xCrest + dxDown * 0.62).toFixed(1)} ${(yEnd - (yEnd - yCrest) * 0.1).toFixed(1)}, ${xEnd.toFixed(1)} ${yEnd}`
  );

  let xLast = xEnd;
  if (drawTail) {
    const dxTail = xTail - xEnd;
    segs.push(
      `C ${(xEnd + dxTail * 0.35).toFixed(1)} ${yEnd}, ${(xEnd + dxTail * 0.72).toFixed(1)} ${yBase}, ${xTail.toFixed(1)} ${yBase}`
    );
    xLast = xTail;
  }

  const stroke = segs.join(' ');
  const fill = `${stroke} L ${xLast.toFixed(1)} ${yBase} L ${x0.toFixed(1)} ${yBase} Z`;
  return { stroke, fill, x1, xCrest, xEnd };
}

function estimateLabelWidth(text: string): number {
  return text.length * 6.4 + 10;
}

function clampLabelPlacement(
  centerX: number,
  text: string
): { x: number; anchor: 'start' | 'middle' | 'end'; left: number; right: number } {
  const w = estimateLabelWidth(text);
  const half = w / 2;
  if (centerX - half < CURVE_X_LEFT) {
    return { x: CURVE_X_LEFT, anchor: 'start', left: CURVE_X_LEFT, right: CURVE_X_LEFT + w };
  }
  if (centerX + half > CURVE_X_RIGHT) {
    return { x: CURVE_X_RIGHT, anchor: 'end', left: CURVE_X_RIGHT - w, right: CURVE_X_RIGHT };
  }
  return { x: centerX, anchor: 'middle', left: centerX - half, right: centerX + half };
}

export function buildDurationCurveModel(row: DurationTableRow): DurationCurveModel | null {
  const onset = parseDurationMinutes(row.onset);
  const comeup = parseDurationMinutes(row.comeup);
  const peak = parseDurationMinutes(row.peak);
  const offset = parseDurationMinutes(row.offset);
  const total = parseDurationMinutes(row.total);
  const hasAfterEffects = Boolean(row.afterEffects && row.afterEffects !== '—');
  const afterEffectsLabel = hasAfterEffects ? row.afterEffects : null;

  if (!peak && !total) {
    return null;
  }

  if (peak) {
    const computePhaseTimes = (bound: 'mid' | 'high') => {
      const dPeak = pickBound(peak, bound);
      const dTotal = total ? pickBound(total, bound) : 0;
      const dOnset = onset
        ? pickBound(onset, bound)
        : comeup
          ? 0
          : dTotal > 0
            ? Math.min(dTotal * 0.06, dPeak * 0.25)
            : dPeak * 0.1;

      const dComeup = comeup
        ? pickBound(comeup, bound)
        : Math.min(dPeak * 0.25, Math.max(dOnset * 0.6, dPeak * 0.12));

      const tOnset = dOnset;
      const tPeakStart = tOnset + dComeup;
      const tPeakEnd = tPeakStart + dPeak;

      const dOffset = offset
        ? pickBound(offset, bound)
        : dTotal > tPeakEnd
          ? dTotal - tPeakEnd
          : Math.max(dPeak * 0.45, 0.5);

      const tOffsetEnd = tPeakEnd + dOffset;
      const tTailEnd = Math.max(tOffsetEnd, dTotal);
      return { tOnset, tPeakStart, tPeakEnd, tOffsetEnd, tTailEnd };
    };

    const midPts = computePhaseTimes('mid');
    const highPts = computePhaseTimes('high');

    const rawMax = Math.max(highPts.tTailEnd, midPts.tTailEnd, total ? total[1] : 0);
    const axis = computeTimeAxis(rawMax);
    const xOf = (t: number) =>
      CURVE_X_LEFT + (Math.min(Math.max(t, 0), axis.maxMinutes) / axis.maxMinutes) * CURVE_PLOT_W;

    const midVisualTail =
      midPts.tTailEnd > midPts.tOffsetEnd * 1.04
        ? midPts.tTailEnd
        : hasAfterEffects
          ? Math.min(
              axis.maxMinutes,
              midPts.tOffsetEnd + (axis.maxMinutes - midPts.tOffsetEnd) * 0.55
            )
          : midPts.tOffsetEnd;

    const hasTail = hasAfterEffects || midPts.tTailEnd > midPts.tOffsetEnd * 1.04;

    const primary = buildMultiPhasePaths(
      { ...midPts, tTailEnd: midVisualTail },
      xOf,
      hasTail
    );

    const highVisualTail =
      highPts.tTailEnd > highPts.tOffsetEnd * 1.04
        ? highPts.tTailEnd
        : hasAfterEffects
          ? Math.min(
              axis.maxMinutes,
              highPts.tOffsetEnd + (axis.maxMinutes - highPts.tOffsetEnd) * 0.5
            )
          : highPts.tOffsetEnd;

    const upperDiffPx =
      Math.abs(xOf(highPts.tOffsetEnd) - primary.x4) +
      Math.abs(xOf(highPts.tPeakEnd) - primary.x3);

    const upperStroke =
      upperDiffPx >= 12
        ? buildMultiPhasePaths(
            { ...highPts, tTailEnd: highVisualTail },
            xOf,
            hasAfterEffects || highPts.tTailEnd > highPts.tOffsetEnd * 1.04
          ).stroke
        : null;

    const dots: PhaseDot[] = [];
    if (onset && primary.x1 > CURVE_X_LEFT + 1) {
      dots.push({
        x: primary.x1,
        y: CURVE_Y_ONSET,
        minutes: midPts.tOnset,
        title: `Onset: ${row.onset} (~${formatDurationShort(midPts.tOnset)})`,
      });
    }
    if (primary.x3 - primary.x2 >= 10) {
      dots.push({
        x: primary.x2,
        y: CURVE_Y_PEAK,
        minutes: midPts.tPeakStart,
        title: `Peak begins ~${formatDurationShort(midPts.tPeakStart)}`,
      });
      dots.push({
        x: primary.x3,
        y: CURVE_Y_PEAK,
        minutes: midPts.tPeakEnd,
        title: `Peak ends ~${formatDurationShort(midPts.tPeakEnd)} (duration ${row.peak})`,
      });
    } else {
      dots.push({
        x: (primary.x2 + primary.x3) / 2,
        y: CURVE_Y_PEAK,
        minutes: (midPts.tPeakStart + midPts.tPeakEnd) / 2,
        title: `Peak: ${row.peak}`,
      });
    }
    dots.push({
      x: primary.x4,
      y: primary.y4,
      minutes: midPts.tOffsetEnd,
      title: offset
        ? `Offset ends ~${formatDurationShort(midPts.tOffsetEnd)} (offset ${row.offset})`
        : `Return to baseline ~${formatDurationShort(midPts.tOffsetEnd)}`,
    });

    const rawGuideXs = [
      onset ? primary.x1 : null,
      primary.x2,
      primary.x3,
      primary.x4,
    ].filter((x): x is number => x !== null && x > CURVE_X_LEFT + 6 && x < CURVE_X_RIGHT - 4);

    const guideXs: number[] = [];
    for (const gx of rawGuideXs) {
      if (guideXs.every((prev) => Math.abs(prev - gx) >= 16)) {
        guideXs.push(gx);
      }
    }

    const topLabels: TopLabel[] = [];
    const occupied: [number, number][] = [];
    const tryPlaceLabel = (centerX: number, text: string, muted = false) => {
      const p = clampLabelPlacement(centerX, text);
      const overlaps = occupied.some(([l, r]) => !(p.right + 8 < l || p.left - 8 > r));
      if (!overlaps) {
        occupied.push([p.left, p.right]);
        topLabels.push({ x: p.x, text, anchor: p.anchor, muted });
      }
    };

    const peakCenter = (primary.x2 + primary.x3) / 2;
    tryPlaceLabel(peakCenter, `Peak ${row.peak}`, false);

    if (primary.x4 - primary.x3 >= 54) {
      const offsetLabel = offset ? `Offset ${row.offset}` : 'Offset';
      const offsetCenter = (primary.x3 + primary.x4) / 2;
      if (estimateLabelWidth(offsetLabel) <= primary.x4 - primary.x3 + 20) {
        tryPlaceLabel(offsetCenter, offsetLabel, true);
      } else {
        tryPlaceLabel(offsetCenter, 'Offset', true);
      }
    }

    if (primary.x2 - CURVE_X_LEFT >= 52) {
      const leftLabel = comeup ? 'Comeup' : onset ? 'Onset' : '';
      if (leftLabel) {
        tryPlaceLabel((CURVE_X_LEFT + primary.x2) / 2, leftLabel, true);
      }
    }

    return {
      mode: 'phases',
      axis,
      primaryStroke: primary.stroke,
      primaryFill: primary.fill,
      upperStroke,
      dots,
      guideXs,
      topLabels,
      afterEffectsLabel,
      noteLabel: null,
      spans: {
        onset: [0, midPts.tOnset],
        comeup: [midPts.tOnset, midPts.tPeakStart],
        peak: [midPts.tPeakStart, midPts.tPeakEnd],
        offset: [midPts.tPeakEnd, midPts.tOffsetEnd],
        tail: [midPts.tOffsetEnd, midVisualTail],
        hasTail,
      },
    };
  }

  // Simplified unimodal profile
  const totalRange = total!;
  const computeSimpleTimes = (bound: 'mid' | 'high') => {
    const dTotal = pickBound(totalRange, bound);
    const dOnset = onset ? Math.min(pickBound(onset, bound), dTotal * 0.45) : 0;
    const dComeup = comeup ? pickBound(comeup, bound) : 0;
    const tCrest =
      dComeup > 0
        ? Math.min(dTotal * 0.65, dOnset + dComeup)
        : dOnset > 0
          ? dOnset + (dTotal - dOnset) * 0.28
          : dTotal * 0.32;
    return { tOnset: dOnset, tCrest, tEnd: dTotal };
  };

  const midSimple = computeSimpleTimes('mid');
  const highSimple = computeSimpleTimes('high');

  const axis = computeTimeAxis(Math.max(highSimple.tEnd, midSimple.tEnd));
  const xOf = (t: number) =>
    CURVE_X_LEFT + (Math.min(Math.max(t, 0), axis.maxMinutes) / axis.maxMinutes) * CURVE_PLOT_W;

  const midTailEnd = hasAfterEffects
    ? Math.min(axis.maxMinutes, midSimple.tEnd + (axis.maxMinutes - midSimple.tEnd) * 0.55)
    : midSimple.tEnd;

  const primary = buildSimplePaths({ ...midSimple, tTailEnd: midTailEnd }, xOf, hasAfterEffects);

  const upperDiffPx = Math.abs(xOf(highSimple.tEnd) - primary.xEnd);
  const upperStroke =
    upperDiffPx >= 12
      ? buildSimplePaths(
          {
            ...highSimple,
            tTailEnd: hasAfterEffects
              ? Math.min(
                  axis.maxMinutes,
                  highSimple.tEnd + (axis.maxMinutes - highSimple.tEnd) * 0.5
                )
              : highSimple.tEnd,
          },
          xOf,
          hasAfterEffects
        ).stroke
      : null;

  const dots: PhaseDot[] = [];
  if (onset && primary.x1 > CURVE_X_LEFT + 1) {
    dots.push({
      x: primary.x1,
      y: CURVE_Y_ONSET,
      minutes: midSimple.tOnset,
      title: `Onset: ${row.onset} (~${formatDurationShort(midSimple.tOnset)})`,
    });
  }
  dots.push({
    x: primary.xEnd,
    y: hasAfterEffects && midTailEnd > midSimple.tEnd + 0.01 ? CURVE_Y_ONSET : CURVE_Y_BASE,
    minutes: midSimple.tEnd,
    title: `Total duration: ${row.total} (~${formatDurationShort(midSimple.tEnd)})`,
  });

  const guideXs = dots
    .map((d) => d.x)
    .filter((x) => x > CURVE_X_LEFT + 6 && x < CURVE_X_RIGHT - 4);

  const topLabels: TopLabel[] = [];
  const totalPlacement = clampLabelPlacement(primary.xCrest, `Total ${row.total}`);
  topLabels.push({
    x: totalPlacement.x,
    text: `Total ${row.total}`,
    anchor: totalPlacement.anchor,
    muted: false,
  });

  const noteParts: string[] = [];
  if (onset) noteParts.push('onset');
  if (comeup) noteParts.push('comeup');
  noteParts.push('total');
  const noteLabel = `Estimated shape from ${noteParts.join(' & ')}`;

  return {
    mode: 'simple',
    axis,
    primaryStroke: primary.stroke,
    primaryFill: primary.fill,
    upperStroke,
    dots,
    guideXs,
    topLabels,
    afterEffectsLabel,
    noteLabel,
    spans: {
      onset: [0, midSimple.tOnset],
      comeup: [midSimple.tOnset, midSimple.tCrest],
      peak: [midSimple.tCrest, midSimple.tCrest],
      offset: [midSimple.tCrest, midSimple.tEnd],
      tail: [midSimple.tEnd, midTailEnd],
      hasTail: hasAfterEffects,
    },
  };
}

export interface DurationCurveSvgProps {
  row: DurationTableRow;
  intakeMinutes?: number | null;
  focusedPhase?: string | null;
  onClearFocusedPhase?: () => void;
}

function getPhaseSpan(model: DurationCurveModel, phaseName: string): [number, number] | null {
  const k = phaseName.toLowerCase();
  if (k === 'onset') return model.spans.onset;
  if (k === 'comeup') return model.spans.comeup;
  if (k === 'peak') return model.spans.peak;
  if (k === 'offset') return model.spans.offset;
  if (k === 'after-effects') return model.spans.tail;
  return null;
}

export const DurationCurveSvg: React.FC<DurationCurveSvgProps> = ({
  row,
  intakeMinutes = null,
  focusedPhase = null,
  onClearFocusedPhase,
}) => {
  const model = useMemo(() => buildDurationCurveModel(row), [row]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);
  const [pinnedMinutes, setPinnedMinutes] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Reset scrub state when ROA / row changes
  useEffect(() => {
    setHoverMinutes(null);
    setPinnedMinutes(null);
    setIsDragging(false);
  }, [row.roa, row.total, row.peak]);

  // Snap pinned cursor when user clicks a phase row in the breakdown table below
  useEffect(() => {
    if (!model || !focusedPhase) return;
    const span = getPhaseSpan(model, focusedPhase);
    if (!span) return;
    const mid = (span[0] + span[1]) / 2;
    setPinnedMinutes(mid);
  }, [focusedPhase, model]);

  if (!model) return null;

  const xOf = (t: number) =>
    CURVE_X_LEFT + (Math.min(Math.max(t, 0), model.axis.maxMinutes) / model.axis.maxMinutes) * CURVE_PLOT_W;

  const clientXToMinutes = (clientX: number): number | null => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const svgX = ((clientX - rect.left) / rect.width) * CURVE_VIEW_W;
    const norm = Math.min(1, Math.max(0, (svgX - CURVE_X_LEFT) / CURVE_PLOT_W));
    return norm * model.axis.maxMinutes;
  };

  const activeMinutes = isDragging
    ? hoverMinutes
    : hoverMinutes !== null
      ? hoverMinutes
      : pinnedMinutes;

  const activeEval =
    activeMinutes !== null ? evaluateCurveAt(model, activeMinutes) : null;
  const activeX = activeMinutes !== null ? xOf(activeMinutes) : null;

  const focusedSpan = focusedPhase ? getPhaseSpan(model, focusedPhase) : null;
  const focusedX0 = focusedSpan ? xOf(focusedSpan[0]) : null;
  const focusedX1 = focusedSpan ? xOf(focusedSpan[1]) : null;

  const roaDisplay = formatRoaDisplay(row.roa);

  return (
    <div className="duration-curve-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CURVE_VIEW_W} ${CURVE_VIEW_H}`}
        className={`duration-curve-svg chart-interactive ${isDragging ? 'chart-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label={`Interactive pharmacokinetic duration curve for ${roaDisplay}. Hover, drag, or use arrow keys to inspect elapsed time.`}
        aria-valuemin={0}
        aria-valuemax={Math.round(model.axis.maxMinutes)}
        aria-valuenow={activeMinutes !== null ? Math.round(activeMinutes) : 0}
        aria-valuetext={
          activeMinutes !== null && activeEval
            ? `+${formatDurationShort(activeMinutes)}, ${activeEval.phase}, ${Math.round(activeEval.intensity * 100)}% intensity`
            : `Total ${row.total}`
        }
        onPointerDown={(e) => {
          const m = clientXToMinutes(e.clientX);
          if (m === null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setIsDragging(true);
          setHoverMinutes(m);
          setPinnedMinutes(m);
          onClearFocusedPhase?.();
        }}
        onPointerMove={(e) => {
          const m = clientXToMinutes(e.clientX);
          if (m === null) return;
          setHoverMinutes(m);
          if (isDragging) {
            setPinnedMinutes(m);
          }
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          setIsDragging(false);
        }}
        onPointerCancel={() => setIsDragging(false)}
        onPointerLeave={() => {
          if (!isDragging) setHoverMinutes(null);
        }}
        onKeyDown={(e) => {
          const step = model.axis.maxMinutes / 24;
          const base = activeMinutes ?? 0;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onClearFocusedPhase?.();
            setPinnedMinutes(Math.min(model.axis.maxMinutes, base + step));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onClearFocusedPhase?.();
            setPinnedMinutes(Math.max(0, base - step));
          } else if (e.key === 'Home') {
            e.preventDefault();
            setPinnedMinutes(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            setPinnedMinutes(model.axis.maxMinutes);
          } else if (e.key === 'Escape') {
            setPinnedMinutes(null);
            setHoverMinutes(null);
            onClearFocusedPhase?.();
          }
        }}
      >
        {/* Horizontal reference hairlines */}
        <line x1={CURVE_X_LEFT} y1={CURVE_Y_PEAK} x2={CURVE_X_RIGHT} y2={CURVE_Y_PEAK} className="chart-grid-line" />
        <line x1={CURVE_X_LEFT} y1={CURVE_Y_MID} x2={CURVE_X_RIGHT} y2={CURVE_Y_MID} className="chart-grid-line" />
        <line x1={CURVE_X_LEFT} y1={CURVE_Y_BASE} x2={CURVE_X_RIGHT} y2={CURVE_Y_BASE} className="chart-grid-line" />

        {/* Focused phase highlight band (when clicking a phase row below) */}
        {focusedX0 !== null && focusedX1 !== null && focusedX1 > focusedX0 + 1 && (
          <rect
            x={focusedX0}
            y={CURVE_Y_PEAK - 6}
            width={focusedX1 - focusedX0}
            height={CURVE_Y_BASE - CURVE_Y_PEAK + 6}
            className="chart-phase-highlight"
          />
        )}

        {/* Vertical phase guides */}
        {model.guideXs.map((gx, idx) => (
          <line
            key={idx}
            x1={gx}
            y1={CURVE_Y_PEAK - 6}
            x2={gx}
            y2={CURVE_Y_BASE}
            className="chart-grid-line"
            strokeDasharray="2 3"
          />
        ))}

        {/* Shaded primary area */}
        <path d={model.primaryFill} className="chart-area-fill" />

        {/* Upper duration range envelope */}
        {model.upperStroke && (
          <path d={model.upperStroke} className="chart-range-stroke" />
        )}

        {/* Primary midpoint curve */}
        <path d={model.primaryStroke} className="chart-curve-stroke" />

        {/* Phase landmark dots (clickable to snap) */}
        {model.dots.map((dot, idx) => (
          <circle
            key={idx}
            cx={dot.x}
            cy={dot.y}
            r={3.5}
            className="chart-phase-dot chart-phase-dot-interactive"
            onPointerDown={(e) => {
              e.stopPropagation();
              onClearFocusedPhase?.();
              setPinnedMinutes((prev) =>
                prev !== null && Math.abs(prev - dot.minutes) < model.axis.maxMinutes * 0.01
                  ? null
                  : dot.minutes
              );
            }}
          >
            <title>{dot.title}</title>
          </circle>
        ))}

        {/* Live interactive scrubber crosshair & cursor dot */}
        {activeX !== null && activeEval && (
          <g className="chart-scrubber" aria-hidden="true">
            <line
              x1={activeX}
              y1={CURVE_Y_PEAK - 8}
              x2={activeX}
              y2={CURVE_Y_BASE}
              className="chart-scrubber-line"
            />
            <circle cx={activeX} cy={activeEval.y} r={5} className="chart-scrubber-dot" />
          </g>
        )}

        {/* Top collision-free phase annotations */}
        {model.topLabels.map((lbl, idx) => (
          <text
            key={idx}
            x={lbl.x}
            y={18}
            textAnchor={lbl.anchor}
            className={lbl.muted ? 'chart-axis-text' : 'chart-phase-label'}
          >
            {lbl.text}
          </text>
        ))}

        {/* Bottom real numeric time axis ticks */}
        {model.axis.ticks.map((tick, idx) => {
          const tx = xOf(tick.minutes);
          const anchor =
            idx === 0
              ? 'start'
              : idx === model.axis.ticks.length - 1
                ? 'end'
                : 'middle';
          return (
            <g key={idx}>
              <line
                x1={tx}
                y1={CURVE_Y_BASE}
                x2={tx}
                y2={CURVE_Y_BASE + 4}
                className="chart-tick-line"
              />
              <text
                x={tx}
                y={136}
                textAnchor={anchor}
                className="chart-axis-text tabular-nums"
              >
                {tick.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Live readout strip when scrubbing/pinned, or quiet legend by default */}
      <div className="duration-curve-meta">
        {activeMinutes !== null && activeEval ? (
          <>
            <div className="duration-scrub-readout tabular-nums">
              <span className="body-strong">
                {activeMinutes <= 0.01 ? '0 (Intake)' : `+${formatDurationShort(activeMinutes)}`}
              </span>
              <span className="accent-text">{activeEval.phase}</span>
              <span>{Math.round(activeEval.intensity * 100)}% relative</span>
              {intakeMinutes !== null && (
                <span>Clock {formatClockAtOffset(intakeMinutes, activeMinutes)}</span>
              )}
            </div>
            {pinnedMinutes !== null && (
              <button
                type="button"
                className="chart-clear-pin"
                onClick={() => {
                  setPinnedMinutes(null);
                  setHoverMinutes(null);
                  onClearFocusedPhase?.();
                }}
              >
                Clear pin
              </button>
            )}
          </>
        ) : (
          <>
            <div className="duration-curve-legend">
              <span className="duration-legend-item">
                <span className="duration-legend-line duration-legend-line-primary" aria-hidden="true" />
                <span>Typical ({roaDisplay})</span>
              </span>
              {model.upperStroke && (
                <span className="duration-legend-item">
                  <span className="duration-legend-line duration-legend-line-range" aria-hidden="true" />
                  <span>Upper range</span>
                </span>
              )}
              <span className="duration-scrub-hint">Drag or hover curve to inspect</span>
            </div>
            <div className="duration-curve-notes tabular-nums">
              {model.noteLabel && <span>{model.noteLabel}</span>}
              {model.afterEffectsLabel && (
                <span>After-effects {model.afterEffectsLabel}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
