import React from 'react';

export interface GelDoodleProps {
  /** Width and height in rem (defaults to 2.25rem) */
  size?: number;
  /** Muted resting state using --opacity-asleep */
  asleep?: boolean;
  className?: string;
}

/**
 * Hand-drawn transdermal / topical gel droplet & swirl doodle
 * Plump organic gel drop with --illustration-wash fill, curved highlight arc,
 * soft base ripple, and a tiny satellite micro-bead.
 */
export const GelDoodle: React.FC<GelDoodleProps> = ({
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
      {/* Translucent gel wash shifted slightly inside the drop */}
      <path
        d="M20.2 8.4 C 23.6 13.4, 28.8 18.2, 28.6 23.8 C 28.4 28.8, 24.6 32.2, 19.8 32.1 C 14.8 32, 11.4 28.4, 11.6 23.6 C 11.8 18.1, 16.8 13.4, 20.2 8.4 Z"
        fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
        stroke="none"
      />
      {/* Main hand-drawn gel drop contour */}
      <path d="M19.8 7.2 C 23.5 12.6, 29.4 17.8, 29.2 23.8 C 29 29.3, 24.8 32.8, 19.8 32.6 C 14.5 32.5, 10.6 28.8, 10.8 23.5 C 11 17.7, 16.3 12.7, 19.8 7.2 Z" />
      {/* Inner curved specular gel highlight */}
      <path
        d="M15.2 21.2 C 14.8 24.2, 16.2 27.2, 19.1 28.1"
        strokeWidth={1.55}
      />
      {/* Small satellite gel bead */}
      <path
        d="M31.2 12.2 C 32.3 12.1, 33.1 12.9, 33 14 C 32.9 15.1, 32 15.7, 31 15.5 C 30.1 15.4, 29.5 14.5, 29.7 13.4 C 29.8 12.6, 30.4 12.2, 31.2 12.2 Z"
        fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
        strokeWidth={1.55}
      />
    </svg>
  );
};
