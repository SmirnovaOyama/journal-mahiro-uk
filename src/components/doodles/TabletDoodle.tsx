import React from 'react';

export interface TabletDoodleProps {
  /** Width and height in rem (defaults to 2.25rem) */
  size?: number;
  /** Muted resting state using --opacity-asleep */
  asleep?: boolean;
  className?: string;
}

export const TabletDoodle: React.FC<TabletDoodleProps> = ({
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
      <g transform="translate(0 -2.2)">
        <path
          d="M20.2 12.6 C 26 12.4, 30.4 16.6, 30.2 22.2 C 30.4 27.8, 26 32, 20.2 31.8 C 14.4 32, 10 27.8, 10.2 22.2 C 10 16.6, 14.4 12.4, 20.2 12.6 Z"
          fill="var(--illustration-wash, oklch(97.5% 0.012 45))"
          stroke="none"
        />
        <path d="M20.2 12.6 C 26 12.4, 30.4 16.6, 30.2 22.2 C 30.4 27.8, 26 32, 20.2 31.8 C 14.4 32, 10 27.8, 10.2 22.2 C 10 16.6, 14.4 12.4, 20.6 12.7" />
        <path d="M11.4 22.4 C 16 21.8, 25 22.4, 29 21.9" strokeWidth={1.6} />
      </g>
    </svg>
  );
};
