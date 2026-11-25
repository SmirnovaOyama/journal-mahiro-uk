import React from 'react';

export interface BlotterDoodleProps {
  /** Width and height in rem (defaults to 2.25rem) */
  size?: number;
  /** Muted resting state using --opacity-asleep */
  asleep?: boolean;
  className?: string;
}

/**
 * Hand-drawn perforated sublingual blotter tab doodle (纸片 / 舌下贴片)
 * Serrated stamp-like square tilted at -10deg with --illustration-wash inner tint,
 * quadrant perforation guide ticks, and a delicate botanical sun/arc motif.
 */
export const BlotterDoodle: React.FC<BlotterDoodleProps> = ({
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
      <g transform="rotate(-10 20 20)">
        {/* Soft inner wash */}
        <path
          d="M11.6 11.4 C 17.2 11.1, 22.8 11.2, 28.4 11.5 C 28.8 17.1, 28.7 22.8, 28.3 28.5 C 22.7 28.8, 17.1 28.8, 11.5 28.4 C 11.2 22.8, 11.2 17, 11.6 11.4 Z"
          fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
          stroke="none"
        />
        {/* Perforated stamp-like outer contour */}
        <path d="M10.4 10.4 L 13.4 11.3 L 16.6 10.2 L 19.9 11.3 L 23.2 10.2 L 26.5 11.3 L 29.6 10.4 L 28.7 13.5 L 29.8 16.7 L 28.7 20 L 29.8 23.3 L 28.7 26.5 L 29.6 29.6 L 26.5 28.7 L 23.2 29.8 L 19.9 28.7 L 16.6 29.8 L 13.4 28.7 L 10.4 29.6 L 11.3 26.5 L 10.2 23.3 L 11.3 20 L 10.2 16.7 L 11.3 13.5 Z" />
        {/* Inner botanical / sun ring motif */}
        <path
          d="M20 15.8 C 22.3 15.7, 24.2 17.6, 24.1 20 C 24.2 22.3, 22.3 24.2, 20 24.1 C 17.6 24.2, 15.8 22.3, 15.9 20 C 15.8 17.6, 17.6 15.7, 20 15.8 Z"
          strokeWidth={1.5}
        />
        {/* Subtle quadrant perforation dashes */}
        <path d="M20 11.8 L 20 13.4" strokeWidth={1.35} />
        <path d="M20 26.6 L 20 28.2" strokeWidth={1.35} />
        <path d="M11.8 20 L 13.4 20" strokeWidth={1.35} />
        <path d="M26.6 20 L 28.2 20" strokeWidth={1.35} />
      </g>
    </svg>
  );
};
