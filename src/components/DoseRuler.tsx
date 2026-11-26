import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DoseRow } from '../lib/data';
import LevelRail from './LevelRail';
import { Odometer } from './Odometer';
import Tick from './Tick';
import { fmt } from './SubstanceRow';

type Band = 'below' | 'light' | 'common' | 'strong' | 'heavy';

const BANDS: Record<Band, { label: string; says: string;}> = {
  below: {
    label: 'Below threshold',
    says: 'Most people feel little or nothing at this amount.',
  },
  light: {
    label: 'Light',
    says: 'Noticeable but easy to manage. The sensible place to start, and always with a new batch.',
  },
  common: {
    label: 'Common',
    says: 'The full, typical effect for most people.',
  },
  strong: {
    label: 'Strong',
    says: 'Intense. Side effects become more likely and harder to handle.',
  },
  heavy: {
    label: 'Heavy',
    says: 'Overwhelming for most people, and the risk of serious harm climbs steeply.',
  },
};

const ORDER: Exclude<Band, 'below'>[] = ['light', 'common', 'strong', 'heavy'];

function num(s?: string): number | null {
  const m = s?.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function niceStep(span: number): number {
  // About 80 stops along the ruler: fine enough to land in any band, coarse
  // enough that the number doesn't churn through decimals while dragging.
  const raw = span / 80;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

/** How much, read the way hrt.mahiro.uk reads a level on its Overview: a
 *  label, the amount in large light numerals with its unit, and under it
 *  hrt's own LevelRail, the common band marked in the accent and the amount
 *  its one tall tick, the band's name flown above it. The rail can be
 *  dragged (an invisible slider lies over it); under it, the bands as rows
 *  like the Overview's plan rows, the one the amount is in ticked. */
export function DoseRuler({
  row,
  label,
  footer,
  onPick,
  aside,
}: {
  row: DoseRow;
  /** A line beside the amount, from it: the same dose per kilogram of the
   *  reader's weight, or a per-kilogram dose as an amount. */
  aside?: (value: number) => React.ReactNode;
  /** Told the amount whenever it changes, so the page can log it. */
  onPick?: (v: number) => void;
  /** The small label over the number, as "Estradiol" is on hrt's Overview. */
  label: string;
  /** What closes the block, as "Medication plan >" closes hrt's. */
  footer?: React.ReactNode;
}) {
  const name = (b: Band) => (BANDS[b].label);

  const model = useMemo(() => {
    const seg = row.segments ?? {};
    const threshold = num(row.threshold);
    const lo = row.domain?.[0] ?? Math.max(0, (seg.light?.[0] ?? 0) * 0.8);
    const hi = row.domain?.[1] ?? seg.heavy?.[1] ?? (seg.strong?.[1] ?? 1) * 1.3;
    const start = threshold ?? seg.light?.[0] ?? lo;
    const initial =
      row.commonEstimate ?? (seg.common ? (seg.common[0] + seg.common[1]) / 2 : (lo + hi) / 2);
    const step = niceStep(hi - lo);
    // The reels keep one layout for the whole ruler: as many decimals as the
    // step needs, and room for the largest amount.
    const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    const places = Math.max(decimals + 1, String(Math.round(hi * 10 ** decimals)).length);
    // LevelRail spaces its ticks logarithmically, so both ends stay above zero.
    const domain: [number, number] = [Math.max(lo, hi / 400, 1e-6), hi];
    return { seg, threshold, lo, hi, start, initial, step, decimals, places, domain };
  }, [row]);

  const [value, setValue] = useState(model.initial);
  // While a finger drags along the rail the number is simply the value, every
  // frame; a press, a band picked or an arrow key rolls it (Odometer).
  const [follow, setFollow] = useState(false);
  const press = useRef<number | null>(null);
  // Another route is another ladder: move to its common dose, and let the
  // reels and the tick travel there rather than jump.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setValue(model.initial);
  }, [model]);
  const { seg, lo, hi, start, domain } = model;
  useEffect(() => {
    onPick?.(value);
  }, [value, onPick]);

  const bandOf = (v: number): Band => {
    if (v < start) return 'below';
    for (let i = ORDER.length - 1; i >= 0; i--) {
      const s = seg[ORDER[i]];
      if (s && v >= s[0]) return ORDER[i];
    }
    return 'light';
  };
  const band = bandOf(value);
  const tone = {
    below: 'text-[var(--text-muted)]',
    light: 'text-[var(--status-info)]',
    common: 'text-[var(--accent-ink)]',
    strong: 'text-[var(--warning)]',
    heavy: 'text-[var(--danger)]',
  }[band];

  // The slider runs along the same log scale the rail is drawn on.
  const [llo, lhi] = [Math.log10(domain[0]), Math.log10(domain[1])];
  const at = (v: number) => Math.min(1, Math.max(0, (Math.log10(Math.max(v, domain[0])) - llo) / (lhi - llo)));
  const valueAt = (p: number) => {
    const raw = 10 ** (llo + p * (lhi - llo));
    return Math.min(hi, Math.max(lo, Math.round(raw / model.step) * model.step));
  };

  // The ticks run from 1px in at either end (LevelRail).
  const valueAtX = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    return valueAt(Math.min(1, Math.max(0, (clientX - r.left - 1) / Math.max(1, r.width - 2))));
  };

  const rangeText = (b: Exclude<Band, 'below'>) =>
    ({ light: row.light, common: row.common, strong: row.strong, heavy: row.heavy })[b];
  const common = seg.common ? { low: seg.common[0], high: seg.common[1] } : { low: start, high: start };

  const muted = 'text-[var(--text-muted)]';
  const on = 'text-[var(--text)]';

  return (
    <div>
      <p className={`text-xs font-medium ${muted}`}>{label}</p>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display inline-flex items-baseline gap-x-2 font-light leading-none tracking-[-0.035em] tabular-nums text-[length:var(--text-reading-sm-size)] sm:text-[length:var(--text-reading-md-size)] md:text-[length:var(--text-reading-size)]">
          <span className={on}>
            <Odometer value={value} decimals={model.decimals} places={model.places} instant={follow} />
          </span>
          <span className={`text-sm font-normal tracking-normal ${muted}`}>{row.unit}</span>
          <span className="sr-only">{name(band)}</span>
        </span>
        {aside && <span className={`text-xs tabular-nums ${muted}`}>{aside(value)}</span>}
      </div>

      {/* The rail itself takes the finger, anywhere along it: a press moves
          the amount there, a drag carries it. Sideways only, so the page
          still scrolls under a vertical swipe. The range input is for
          keyboards and screen readers. */}
      <div
        className="relative mt-0.5 cursor-grab rounded-[var(--radius-sm)] active:cursor-grabbing has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-[var(--accent-ink)]"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* a pointer the browser has already let go of */
          }
          press.current = e.pointerId;
          setFollow(false);
          setValue(valueAtX(e.currentTarget, e.clientX));
        }}
        onPointerMove={(e) => {
          if (press.current !== e.pointerId) return;
          setFollow(true);
          setValue(valueAtX(e.currentTarget, e.clientX));
        }}
        onPointerUp={() => {
          press.current = null;
          setFollow(false);
        }}
        onPointerCancel={() => {
          press.current = null;
          setFollow(false);
        }}
      >
        <LevelRail value={value} band={common} domain={domain} label={name(band)} tone={tone} />
        <input
          type="range"
          className="sr-only"
          min={0}
          max={1000}
          step={1}
          value={Math.round(at(value) * 1000)}
          aria-label={`Amount in ${row.unit}`}
          aria-valuetext={`${fmt(value)} ${row.unit}, ${name(band)}`}
          onChange={(e) => setValue(valueAt(parseFloat(e.target.value) / 1000))}
        />
      </div>

      <p className={`mt-3 text-sm ${muted}`}>{BANDS[band].says}</p>

      <div className="mt-2">
        {ORDER.map((b) => {
          const s = seg[b];
          const text = rangeText(b);
          if (!s || !text) return null;
          const target = b === 'heavy' ? s[0] : (s[0] + s[1]) / 2;
          const here = band === b;
          return (
            <button
              type="button"
              key={b}
              onClick={() => setValue(target)}
              className="tap-target flex w-full items-center justify-between gap-3 py-1.5 text-start"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="min-w-0">
                  <span className={`block text-sm ${here ? on : muted}`}>{name(b)}</span>
                  <span className={`block text-xs tabular-nums ${muted}`}>{text}</span>
                </span>
              </span>
              <span className="px-2.5">
                <Tick on={here} size={18} />
              </span>
            </button>
          );
        })}
        {row.threshold && (
          <p className={`py-1.5 text-xs ${muted}`}>
            {`Threshold ${row.threshold}: below it most people feel little.`}
          </p>
        )}
        {footer && <div className="pt-1.5">{footer}</div>}
      </div>
    </div>
  );
}
