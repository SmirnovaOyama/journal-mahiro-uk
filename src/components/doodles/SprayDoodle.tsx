import React from 'react';

export interface SprayDoodleProps {
  /** Width and height in rem (defaults to 2.25rem) */
  size?: number;
  /** Muted resting state using --opacity-asleep */
  asleep?: boolean;
  className?: string;
}

/**
 * Hand-drawn nasal / sublingual metered spray bottle doodle
 * Compact bottle with --illustration-wash liquid reservoir, dip tube,
 * winged actuator nozzle, and three hand-drawn mist puffs.
 */
export const SprayDoodle: React.FC<SprayDoodleProps> = ({
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
      {/* Reservoir wash inside bottle */}
      <path
        d="M12.8 23.2 C 16.4 22.8, 20.4 22.9, 23.8 23.2 C 24.1 26.6, 24 30.2, 23.6 33.4 C 20.2 33.8, 16.4 33.8, 13.1 33.4 C 12.7 30.2, 12.6 26.6, 12.8 23.2 Z"
        fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
        stroke="none"
      />
      {/* Bottle body */}
      <path d="M14.2 19.2 C 17 18.9, 19.8 18.9, 22.4 19.2 C 23.8 19.5, 24.4 20.8, 24.5 22.6 C 24.7 26.3, 24.6 30.1, 24.2 33.5 C 24 34.6, 23.1 35.1, 21.8 35.2 C 18.8 35.4, 16.9 35.4, 14.8 35.2 C 13.5 35, 12.6 34.4, 12.4 33.3 C 12.1 29.9, 12 26.2, 12.2 22.5 C 12.3 20.7, 13 19.5, 14.2 19.2 Z" />
      {/* Actuator wing collar */}
      <path d="M13.6 15.8 C 16.8 15.5, 20 15.5, 23.2 15.8" />
      {/* Tapered nasal/oral nozzle tip */}
      <path d="M16.4 19 C 16.6 15.8, 17 12.4, 17.5 9.8 C 17.7 9, 18.9 9, 19.2 9.8 C 19.7 12.4, 20.1 15.8, 20.3 19" />
      {/* Internal dip tube & liquid line */}
      <path d="M12.6 23.4 C 16.4 23, 20.2 23.1, 24.1 23.4" strokeWidth={1.45} />
      <path d="M18.4 19.2 C 18.3 24.2, 17.8 29.4, 16.6 33.4" strokeWidth={1.35} />
      {/* Hand-drawn atomized mist arcs */}
      <path d="M22.2 8.2 C 24.1 7.1, 25.8 6.4, 27.6 6" strokeWidth={1.6} />
      <path d="M23.2 10.8 C 25.4 10.3, 27.4 10.1, 29.4 10.2" strokeWidth={1.6} />
      <path d="M19.8 6.4 C 20.6 4.9, 21.6 3.7, 22.8 2.8" strokeWidth={1.5} />
    </svg>
  );
};
