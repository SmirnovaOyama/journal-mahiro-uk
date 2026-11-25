import React from 'react';

export interface InjectionDoodleProps {
  /** Width and height in rem (defaults to 2.25rem) */
  size?: number;
  /** Muted resting state using --opacity-asleep */
  asleep?: boolean;
  className?: string;
}

/**
 * Hand-drawn syringe / parenteral injection doodle (针剂)
 * Tilted at -35deg with organic cubic-bezier barrel, --illustration-wash liquid chamber,
 * hand-ticked graduation marks, plunger flange, and needle tip.
 */
export const InjectionDoodle: React.FC<InjectionDoodleProps> = ({
  size = 2.25,
  asleep = false,
  className = '',
}) => {
  const stateClass = asleep ? 'dd-asleep' : '';

  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="var(--illustration-line, oklch(65.8% 0.1131 39.15))"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `${size}rem`, height: `${size}rem` }}
      className={`capsule-doodle ${stateClass} ${className}`.trim()}
    >
      <g transform="rotate(-35 20 20)">
        {/* Liquid wash inside lower half of syringe barrel */}
        <path
          d="M16.2 12.6 C 18.8 12.4, 21.4 12.5, 23.8 12.6 C 24 16.4, 23.8 20.6, 23.7 23.8 C 21.2 24.1, 18.6 24.1, 16.3 23.8 C 16.1 20.4, 16.1 16.4, 16.2 12.6 Z"
          fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
          stroke="none"
        />
        {/* Barrel body */}
        <path d="M16.1 11.4 C 18.6 11.1, 21.5 11.1, 23.9 11.4 C 24.2 16.5, 24.1 22.8, 23.8 27.6 C 21.4 27.9, 18.6 27.9, 16.2 27.6 C 15.9 22.8, 15.8 16.5, 16.1 11.4 Z" />
        {/* Hub / Luer tip */}
        <path d="M18.2 11.2 C 18.3 9.8, 18.4 8.9, 18.6 8.3 C 19.5 8.1, 20.5 8.1, 21.4 8.3 C 21.6 8.9, 21.7 9.8, 21.8 11.2" />
        {/* Needle */}
        <path d="M20 8.1 C 20 6.1, 19.9 4.5, 20 3.2" strokeWidth={1.55} />
        {/* Finger flange wings at bottom of barrel */}
        <path d="M13.4 27.6 C 17.6 27.4, 22.4 27.4, 26.6 27.7" />
        {/* Liquid meniscus / internal plunger stopper line */}
        <path d="M16.3 23.6 C 18.8 23.4, 21.2 23.5, 23.7 23.6" strokeWidth={1.6} />
        {/* Graduation tick marks */}
        <path d="M16.2 15.2 L 18.3 15.1" strokeWidth={1.4} />
        <path d="M16.1 18.2 L 19.1 18.1" strokeWidth={1.4} />
        <path d="M16.1 21.1 L 18.2 21.1" strokeWidth={1.4} />
        {/* Plunger rod & thumb rest */}
        <path d="M20 27.8 C 19.9 30.2, 20.1 32.4, 20 34.4" strokeWidth={1.75} />
        <path d="M16.6 34.5 C 18.8 34.3, 21.2 34.3, 23.4 34.6" />
      </g>
    </svg>
  );
};
