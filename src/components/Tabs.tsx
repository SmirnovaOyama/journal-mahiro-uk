import React, { useLayoutEffect, useRef, useState } from 'react';

export interface TabItem<K extends string = string> {
  id: K;
  label: React.ReactNode;
}

export interface TabsProps<K extends string = string> {
  tabs: readonly TabItem<K>[];
  value: K;
  onChange: (id: K) => void;
  className?: string;
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  className = '',
}: TabsProps<K>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [line, setLine] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[value];
      if (!el) return;
      const next = { left: el.offsetLeft, width: el.offsetWidth };
      setLine((prev) =>
        prev && prev.left === next.left && prev.width === next.width ? prev : next
      );
    };
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [value, tabs]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`tabs-strip scrollbar-hide ${className}`.trim()}
    >
      {tabs.map(({ id, label }) => {
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
            className={`tabs-btn ${selected ? 'tabs-btn-active' : ''}`}
          >
            <span className="tabs-label-grid">
              <span aria-hidden="true" className="tabs-ghost">
                {label}
              </span>
              <span className={selected ? 'tabs-label-active' : 'tabs-label'}>{label}</span>
            </span>
          </button>
        );
      })}
      {line && (
        <span
          aria-hidden="true"
          className="chip-slide tabs-indicator"
          style={{ left: line.left, width: line.width }}
        />
      )}
    </div>
  );
}
