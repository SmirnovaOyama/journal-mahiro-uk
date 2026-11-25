import React, { useEffect, useRef, useState } from 'react';

export interface LevelRailProps {
  value: number;
  band: { low: number; high: number };
  domain: [number, number];
  label?: string;
  tone?: 'accent' | 'positive' | 'warning' | 'danger';
  onChange?: (nextValue: number) => void;
  unit?: string;
}

const STEP_PX = 7;
const DELAY_MS = 7;

function roundSmart(v: number, maxDomain: number): number {
  if (maxDomain <= 12) return Math.round(v * 4) / 4;
  if (maxDomain <= 60) return Math.round(v);
  return Math.round(v / 5) * 5;
}

export const LevelRail: React.FC<LevelRailProps> = ({
  value,
  band,
  domain,
  label,
  tone = 'accent',
  onChange,
  unit = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = width ? Math.min(96, Math.max(24, Math.round(width / STEP_PX))) : 48;
  const maxIdx = count - 1;
  const logMin = Math.log10(Math.max(domain[0], 0.0001));
  const logMax = Math.log10(Math.max(domain[1], domain[0] * 1.1));

  const project = (v: number) =>
    Math.min(1, Math.max(0, (Math.log10(Math.max(v, domain[0])) - logMin) / (logMax - logMin)));

  const unproject = (norm: number) => {
    const clamped = Math.min(1, Math.max(0, norm));
    const raw = Math.pow(10, logMin + clamped * (logMax - logMin));
    return Math.min(domain[1], Math.max(domain[0], roundSmart(raw, domain[1])));
  };

  const currentIdx = Math.round(project(value) * maxIdx);
  const lowIdx = Math.ceil(project(band.low) * maxIdx);
  const highIdx = Math.floor(project(band.high) * maxIdx);

  const posLeft = (idx: number) => `calc(1px + ${(idx / maxIdx).toFixed(4)} * (100% - 2px))`;

  const clientXToNorm = (clientX: number): number | null => {
    if (!trackRef.current) return null;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const updateFromClientX = (clientX: number) => {
    if (!onChange) return;
    const norm = clientXToNorm(clientX);
    if (norm === null) return;
    onChange(unproject(norm));
  };

  const showHoverPreview =
    Boolean(onChange) &&
    !isDragging &&
    hoverIdx !== null &&
    Math.abs(hoverIdx - currentIdx) >= 2;
  const hoverValue = showHoverPreview && hoverIdx !== null ? unproject(hoverIdx / maxIdx) : null;

  return (
    <div
      dir="ltr"
      className={`level-rail ${onChange ? 'level-rail-interactive' : ''} ${
        isDragging ? 'level-rail-dragging' : ''
      }`}
      role={onChange ? 'slider' : undefined}
      tabIndex={onChange ? 0 : undefined}
      aria-valuemin={onChange ? domain[0] : undefined}
      aria-valuemax={onChange ? domain[1] : undefined}
      aria-valuenow={onChange ? value : undefined}
      aria-valuetext={onChange ? `${value} ${unit} ${label ?? ''}`.trim() : undefined}
      aria-label={onChange ? 'Interactive dose level rail' : undefined}
      onPointerDown={(e) => {
        if (!onChange) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        setHoverIdx(null);
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!onChange) return;
        if (isDragging) {
          updateFromClientX(e.clientX);
        } else {
          const norm = clientXToNorm(e.clientX);
          if (norm !== null) {
            setHoverIdx(Math.round(norm * maxIdx));
          }
        }
      }}
      onPointerLeave={() => {
        if (!isDragging) setHoverIdx(null);
      }}
      onPointerUp={(e) => {
        if (!onChange) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setIsDragging(false);
      }}
      onPointerCancel={() => setIsDragging(false)}
      onKeyDown={(e) => {
        if (!onChange) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          onChange(unproject((currentIdx + 1) / maxIdx));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          onChange(unproject((currentIdx - 1) / maxIdx));
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          onChange(unproject((currentIdx + 4) / maxIdx));
        } else if (e.key === 'PageDown') {
          e.preventDefault();
          onChange(unproject((currentIdx - 4) / maxIdx));
        } else if (e.key === 'Home') {
          e.preventDefault();
          onChange(domain[0]);
        } else if (e.key === 'End') {
          e.preventDefault();
          onChange(domain[1]);
        }
      }}
    >
      {label && (
        <span
          className={`rail-label rail-top-label rail-tone-${tone}`}
          style={{
            left: posLeft(currentIdx),
            transform: `translateX(-${((currentIdx / maxIdx) * 100).toFixed(2)}%)`,
          }}
        >
          {label}
        </span>
      )}
      {showHoverPreview && hoverIdx !== null && hoverValue !== null && (
        <span
          className="rail-label rail-hover-label tabular-nums"
          style={{
            left: posLeft(hoverIdx),
            transform: `translateX(-${((hoverIdx / maxIdx) * 100).toFixed(2)}%)`,
          }}
        >
          {hoverValue}
          {unit ? ` ${unit}` : ''}
        </span>
      )}
      <div ref={trackRef} className="rail-track">
        {Array.from({ length: count }, (_, idx) => {
          const isReached = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          const isHovered = showHoverPreview && idx === hoverIdx;
          const inBand = idx >= lowIdx && idx <= highIdx;

          let tickClass = 'rail-tick-outside';
          if (isCurrent) {
            tickClass = `rail-tick-current rail-tone-${tone}`;
          } else if (isHovered) {
            tickClass = 'rail-tick-hovered';
          } else if (inBand) {
            tickClass = isReached ? 'rail-tick-band-reached' : 'rail-tick-band';
          } else if (isReached) {
            tickClass = 'rail-tick-reached';
          }

          return (
            <span key={idx} className="rail-slot">
              <span
                className={`rail-tick ${tickClass}`}
                style={{ animationDelay: `${idx * DELAY_MS}ms` }}
              />
            </span>
          );
        })}
      </div>
      {[
        [lowIdx, band.low],
        [highIdx, band.high],
      ].map(([idx, num]) => (
        <span
          key={`${idx}-${num}`}
          className="rail-label rail-bound-label tabular-nums"
          style={{
            left: posLeft(idx),
            animationDelay: `${idx * DELAY_MS + 120}ms`,
          }}
        >
          {num}
        </span>
      ))}
    </div>
  );
};
