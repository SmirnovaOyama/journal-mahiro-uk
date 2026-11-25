import type { DurationRow } from './data';

/** A span from the data, in minutes: "15–30 min", "3–5 h", "4–24+ h". */
export interface Span {
  min: number;
  max: number;
}

const UNIT_MINUTES: Record<string, number> = { s: 1 / 60, min: 1, h: 60, d: 1440 };

export function parseSpan(raw?: string): Span | null {
  if (!raw) return null;
  const clean = raw.replace(/\(.*?\)/g, ' ').replace(/\+/g, '').trim();
  const m = clean.match(/^([\d.]+)\s*(?:[–-]\s*([\d.]+))?\s*(s|min|h|d)$/);
  if (!m) return null;
  const k = UNIT_MINUTES[m[3]];
  const lo = parseFloat(m[1]) * k;
  const hi = (m[2] ? parseFloat(m[2]) : parseFloat(m[1])) * k;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return { min: lo, max: hi };
}

const mid = (s: Span) => (s.min + s.max) / 2;

export interface Course {
  /** Minutes after taking it, typical (midpoint) values. */
  firstEffects: number;
  peakStart: number;
  peakEnd: number;
  over: number;
  /** End of after-effects, when the data has them. */
  afterEnd: number | null;
  total: Span | null;
  /** Spans as the data gives them, for the words beside the drawing. */
  spans: Partial<Record<'onset' | 'comeup' | 'peak' | 'offset' | 'afterEffects', Span>>;
}

/** Lays the phases end to end. Needs at least a peak and an offset; a
 *  missing onset or come-up counts as no time at all. */
export function courseOf(row: DurationRow | undefined): Course | null {
  if (!row) return null;
  const onset = parseSpan(row.onset);
  const comeup = parseSpan(row.comeup);
  const peak = parseSpan(row.peak);
  const offset = parseSpan(row.offset);
  const after = parseSpan(row.afterEffects);
  if (!peak || !offset || (!onset && !comeup)) return null;
  const firstEffects = onset ? mid(onset) : 0;
  const peakStart = firstEffects + (comeup ? mid(comeup) : 0);
  const peakEnd = peakStart + mid(peak);
  const over = peakEnd + mid(offset);
  return {
    firstEffects,
    peakStart,
    peakEnd,
    over,
    afterEnd: after ? over + mid(after) : null,
    total: parseSpan(row.total),
    spans: {
      ...(onset && { onset }),
      ...(comeup && { comeup }),
      ...(peak && { peak }),
      ...(offset && { offset }),
      ...(after && { afterEffects: after }),
    },
  };
}

/** 90 → "1 h 30 min", 20 → "20 min", 2880 → "2 days". */
export function formatMinutes(m: number): string {
  if (m < 1) {
    const sec = Math.max(5, Math.round((m * 60) / 5) * 5);
    return `${sec} seconds`;
  }
  if (m < 60) return `${Math.round(m)} min`;
  if (m >= 2880) return `${Math.round(m / 1440)} days`;
  const h = Math.floor(m / 60);
  const r = Math.round((m - h * 60) / 5) * 5;
  if (r === 0 || r === 60) {
    const hh = r === 60 ? h + 1 : h;
    return `${hh} h`;
  }
  return `${h} h ${r} min`;
}

export function formatSpan(s: Span): string {
  if (s.max < 1) return `${Math.round(s.min * 60)}–${Math.round(s.max * 60)} seconds`;
  if (s.min < 1) return `${Math.round(s.min * 60)} seconds to ${formatMinutes(s.max)}`;
  if (Math.abs(s.max - s.min) < 0.5) return formatMinutes(s.min);
  // Keep one unit across the range when both ends share it.
  if (s.max < 60) return `${Math.round(s.min)}–${Math.round(s.max)} min`;
  if (s.min >= 60 && s.max < 2880 && s.min % 60 === 0 && s.max % 60 === 0)
    return `${s.min / 60}–${s.max / 60} h`;
  return `${formatMinutes(s.min)} to ${formatMinutes(s.max)}`;
}

/** Minutes since midnight plus an offset, as a clock time with the day it lands on. */
export function clockAt(startMinutes: number, add: number): { time: string; dayOffset: number } {
  const total = Math.round((startMinutes + add) / 5) * 5;
  const dayOffset = Math.floor(total / 1440);
  const inDay = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(inDay / 60)).padStart(2, '0');
  const mm = String(inDay % 60).padStart(2, '0');
  return { time: `${hh}:${mm}`, dayOffset };
}

export function dayWord(offset: number): string {
  if (offset <= 0) return '';
  if (offset === 1) return 'tomorrow';
  return `in ${offset} days`;
}

export function nowRounded(): number {
  const d = new Date();
  return Math.round((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
}
