import React from 'react';
import { FormDoodle, type DosageForm } from './FormDoodle';

interface BgItem {
  kind: DosageForm;
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: 'ghost' | 'asleep';
}

const ITEMS: readonly BgItem[] = [
  { kind: 'capsule', top: '8%', left: '10%', size: 4.25, rotate: -18, opacity: 'ghost' },
  { kind: 'gel', top: '14%', left: '28%', size: 2.85, rotate: 16, opacity: 'ghost' },
  { kind: 'injection', top: '10%', left: '68%', size: 3.75, rotate: 24, opacity: 'ghost' },
  { kind: 'tablet', top: '18%', left: '86%', size: 4.0, rotate: -14, opacity: 'ghost' },
  { kind: 'patch', top: '42%', left: '7%', size: 3.25, rotate: -22, opacity: 'ghost' },
  { kind: 'capsule', top: '36%', left: '21%', size: 4.75, rotate: 16, opacity: 'asleep' },
  { kind: 'blotter', top: '35%', left: '77%', size: 4.5, rotate: 28, opacity: 'asleep' },
  { kind: 'dropper', top: '48%', left: '91%', size: 3.5, rotate: -32, opacity: 'ghost' },
  { kind: 'injection', top: '70%', left: '14%', size: 4.25, rotate: 18, opacity: 'ghost' },
  { kind: 'gel', top: '64%', left: '32%', size: 3.1, rotate: -14, opacity: 'ghost' },
  { kind: 'spray', top: '66%', left: '64%', size: 3.6, rotate: -12, opacity: 'ghost' },
  { kind: 'tablet', top: '76%', left: '83%', size: 4.25, rotate: 24, opacity: 'ghost' },
  { kind: 'patch', top: '86%', left: '46%', size: 3.25, rotate: 12, opacity: 'ghost' },
];

export const DoodleBackground: React.FC = () => {
  return (
    <div className="doodle-bg" aria-hidden="true">
      {ITEMS.map((item, idx) => (
        <div
          key={idx}
          className={`doodle-bg-item ${
            item.opacity === 'asleep' ? 'doodle-bg-asleep' : 'doodle-bg-ghost'
          }`}
          style={{
            top: item.top,
            insetInlineStart: item.left,
            transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
          }}
        >
          <FormDoodle form={item.kind} size={item.size} />
        </div>
      ))}
    </div>
  );
};
