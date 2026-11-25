import React, { useLayoutEffect, useRef, useState } from 'react';

export interface SegmentedOption<K extends string = string> {
  id: K;
  label: React.ReactNode;
}

export interface SegmentedProps<K extends string = string> {
  options: readonly SegmentedOption<K>[];
  value: K;
  onChange: (id: K) => void;
  className?: string;
  'aria-label'?: string;
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: SegmentedProps<K>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[value];
      if (!el) return;
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      setThumb((prev) =>
        prev && prev.left === next.left && prev.width === next.width ? prev : next
      );
    };
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`segmented-track ${className}`.trim()}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className="chip-slide segmented-thumb"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map(({ id, label }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            ref={(el) => {
              itemRefs.current[id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={`tap-target segmented-btn ${selected ? 'segmented-btn-active' : ''}`}
          >
            <span aria-hidden="true" className="segmented-ghost">
              {label}
            </span>
            <span className={selected ? 'segmented-label-active' : 'segmented-label'}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
