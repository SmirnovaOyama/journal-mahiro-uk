import type { DurationRow } from './data';
import { tr } from './i18n';

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

/** Lays the phases end to end. Needs at least a peak, and an offset or a
 *  total; a missing onset counts as no time at all. With no
 *  offset, wearing off fills what's left of the total after the peak (the
 *  sources often give a total but no offset, as for gabapentin). */
export function courseOf(row: DurationRow | undefined): Course | null {
  if (!row) return null;
  const onset = parseSpan(row.onset);
  const comeup = parseSpan(row.comeup);
  const peak = parseSpan(row.peak);
  const offset = parseSpan(row.offset);
  const after = parseSpan(row.afterEffects);
  const total = parseSpan(row.total);
  if (!peak || (!onset && !comeup)) return null;
  // With no come-up given, it comes up across the onset range instead of
  // jumping straight to the peak: felt from its early end, full by its late end.
  const firstEffects = onset ? (comeup ? mid(onset) : onset.min) : 0;
  const peakStart = comeup ? firstEffects + mid(comeup) : onset!.max;
  const peakEnd = peakStart + mid(peak);
  const wearOff = offset ? mid(offset) : total ? mid(total) - peakEnd : 0;
  if (wearOff <= 0) return null;
  const over = peakEnd + wearOff;
  return {
    firstEffects,
    peakStart,
    peakEnd,
    over,
    afterEnd: after ? over + mid(after) : null,
    total,
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
    return tr('{0} seconds', { 0: sec });
  }
  if (m < 60) return tr('{0} min', { 0: Math.round(m) });
  if (m >= 2880) return tr('{0} days', { 0: Math.round(m / 1440) });
  const h = Math.floor(m / 60);
  const r = Math.round((m - h * 60) / 5) * 5;
  if (r === 0 || r === 60) {
    const hh = r === 60 ? h + 1 : h;
    return tr('{0} h', { 0: hh });
  }
  return tr('{0} h {1} min', { 0: h, 1: r });
}

export function formatSpan(s: Span): string {
  if (s.max < 1) return tr('{0}–{1} seconds', { 0: Math.round(s.min * 60), 1: Math.round(s.max * 60) });
  if (s.min < 1) return tr('{0} seconds to {1}', { 0: Math.round(s.min * 60), 1: formatMinutes(s.max) });
  if (Math.abs(s.max - s.min) < 0.5) return formatMinutes(s.min);
  // Keep one unit across the range when both ends share it.
  if (s.max < 60) return tr('{0}–{1} min', { 0: Math.round(s.min), 1: Math.round(s.max) });
  if (s.min >= 60 && s.max < 2880 && s.min % 60 === 0 && s.max % 60 === 0)
    return tr('{0}–{1} h', { 0: s.min / 60, 1: s.max / 60 });
  return tr('{0} to {1}', { 0: formatMinutes(s.min), 1: formatMinutes(s.max) });
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
  if (offset === 1) return tr('tomorrow');
  return tr('in {0} days', { 0: offset });
}

export function nowRounded(): number {
  const d = new Date();
  return Math.round((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
}

/** How long a dose taken by `route` lasts. By its own route when that's
 *  documented (`exact`). When it isn't, the longest any route lasts: a
 *  warning built on it errs on the side of "still working", never the
 *  other way, and says it isn't this route's own. */
export function courseFor(rows: DurationRow[] | undefined, route: string): { course: Course; exact: boolean } | null {
  const own = courseOf(rows?.find(r => r.roa === route));
  if (own) return { course: own, exact: true };
  const all = (rows ?? []).map(r => courseOf(r)).filter((c): c is Course => !!c);
  if (!all.length) return null;
  return { course: all.reduce((a, b) => (b.over > a.over ? b : a)), exact: false };
}
