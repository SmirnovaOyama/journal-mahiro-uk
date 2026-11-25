import React from 'react';

export interface DropperDoodleProps {
  /** Width and height in rem (defaults to 2.25rem) */
  size?: number;
  /** Muted resting state using --opacity-asleep */
  asleep?: boolean;
  className?: string;
}

/**
 * Hand-drawn volumetric liquid dropper / pipette doodle
 * Tilted glass pipette with --illustration-wash squeeze bulb, collar ring,
 * tapered glass stem, and a suspended micro-drop at the tip.
 */
export const DropperDoodle: React.FC<DropperDoodleProps> = ({
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
      <g transform="rotate(28 20 19)">
        {/* Squeeze bulb wash */}
        <path
          d="M16.8 6.8 C 16.7 4.4, 18.2 3.2, 20 3.2 C 21.8 3.2, 23.3 4.4, 23.2 6.8 C 23.1 8.8, 22.8 10.6, 22.6 12.2 C 20.8 12.4, 19.2 12.4, 17.4 12.2 C 17.2 10.6, 16.9 8.8, 16.8 6.8 Z"
          fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
          stroke="none"
        />
        {/* Liquid inside lower pipette stem */}
        <path
          d="M18 19.5 C 19.3 19.3, 20.7 19.3, 22 19.5 C 21.8 23.2, 21.3 26.8, 20.7 29.2 C 20.2 29.4, 19.8 29.4, 19.3 29.2 C 18.7 26.8, 18.2 23.2, 18 19.5 Z"
          fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
          stroke="none"
        />
        {/* Rubber squeeze bulb */}
        <path d="M16.8 12.1 C 16.5 9.8, 16.4 7.5, 16.7 5.8 C 17.1 3.9, 18.4 3.1, 20 3.1 C 21.6 3.1, 22.9 3.9, 23.3 5.8 C 23.6 7.5, 23.5 9.8, 23.2 12.1" />
        {/* Cap collar */}
        <path d="M15.2 12.2 C 18.4 11.9, 21.6 11.9, 24.8 12.2 C 25 13.3, 24.9 14.3, 24.6 15 C 21.5 15.2, 18.5 15.2, 15.4 15 C 15.1 14.3, 15 13.3, 15.2 12.2 Z" />
        {/* Tapered glass pipette tube */}
        <path d="M17.4 15.2 C 17.6 20.1, 18.2 25.4, 19.2 29.4 C 19.5 30.2, 20.5 30.2, 20.8 29.4 C 21.8 25.4, 22.4 20.1, 22.6 15.2" />
        {/* Meniscus line inside tube */}
        <path d="M17.9 19.6 C 19.3 19.4, 20.7 19.4, 22.1 19.6" strokeWidth={1.45} />
      </g>
      {/* Suspended falling droplet below angled tip */}
      <path
        d="M12.4 31.8 C 13.4 33.1, 14.2 34.3, 14.1 35.4 C 14 36.4, 13.2 37.1, 12.3 37 C 11.3 37, 10.6 36.3, 10.7 35.3 C 10.8 34.2, 11.6 33, 12.4 31.8 Z"
        fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
        strokeWidth={1.6}
      />
    </svg>
  );
};
