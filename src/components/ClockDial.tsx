import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Course } from '../lib/time';
import { tr } from '../lib/i18n';

/* A 24-hour dial to say when you'd take it. Midnight at the top, noon at the
   bottom, the night half of the track a shade darker. Drag the knob round
   (it snaps to five minutes and runs on past midnight) and the effect is
   drawn round the ring from there: the whole of it, the peak heavier, the
   after-effects dotted. Nothing is selected or highlighted while dragging;
   the keyboard ring shows only for the keyboard. */

const SIZE = 248;
const C = SIZE / 2;
const R = 96; // the track's centre line
const TRACK = 16;

const DAY = 1440;
const wrap = (m: number) => ((m % DAY) + DAY) % DAY;

function polar(minutes: number, r = R) {
  const a = (minutes / DAY) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

/** An arc round the dial from one time to another, clockwise; at most just
 *  short of a whole turn so it never closes on itself. */
function arc(from: number, to: number, r = R) {
  const span = Math.min(Math.max(to - from, 0.5), DAY - 8);
  const a = polar(from, r);
  const b = polar(from + span, r);
  const large = span > DAY / 2 ? 1 : 0;
  return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function clock(m: number) {
  const t = wrap(Math.round(m));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function partOfDay(m: number) {
  const h = wrap(m) / 60;
  if (h < 5) return tr('in the night');
  if (h < 12) return tr('in the morning');
  if (h < 17) return tr('in the afternoon');
  if (h < 21) return tr('in the evening');
  return tr('at night');
}

export function ClockDial({
  start,
  onChange,
  onNow,
  isNow,
  course,
}: {
  start: number;
  onChange: (m: number) => void;
  onNow: () => void;
  isNow: boolean;
  course: Course;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const minutesAt = (e: PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * SIZE - C;
    const y = ((e.clientY - box.top) / box.height) * SIZE - C;
    const a = Math.atan2(y, x) + Math.PI / 2; // 0 at the top, clockwise
    return wrap(Math.round(((a / (Math.PI * 2)) * DAY) / 5) * 5);
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    const box = svg.current!.getBoundingClientRect();
    const dx = e.clientX - box.left - box.width / 2;
    const dy = e.clientY - box.top - box.height / 2;
    const dist = (Math.hypot(dx, dy) / box.width) * SIZE;
    if (dist < R - 34) return; // the middle is for the time and the Now button
    e.preventDefault(); // no text selection, no focus flash
    svg.current!.setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(minutesAt(e));
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging) onChange(minutesAt(e));
  };
  const onUp = () => setDragging(false);

  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowUp: 15, ArrowRight: 15, ArrowDown: -15, ArrowLeft: -15, PageUp: 60, PageDown: -60 }[e.key];
    if (step) {
      e.preventDefault();
      onChange(wrap(start + step));
    }
  };

  const k = polar(start);
  // After-effects can outlast a whole day (LSD's run to two); round the
  // ring they'd lap the knob, so show at most six hours of them. The words
  // under the dial give the real time.
  const end = start + Math.min(course.afterEnd ?? course.over, course.over + 360);
  const ticks = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="dial" data-dragging={dragging || undefined}>
      <svg
        ref={svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="dial-svg"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-hidden="false"
      >
        {/* the day and the night */}
        <path d={arc(6 * 60, 18 * 60)} className="dial-day" strokeWidth={TRACK} />
        <path d={arc(18 * 60, 30 * 60)} className="dial-night" strokeWidth={TRACK} />
        {ticks.map((h) => {
          const a = polar(h * 60, R + TRACK / 2 + 4);
          const b = polar(h * 60, R + TRACK / 2 + (h % 6 === 0 ? 10 : 7));
          return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="dial-tick" />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const p = polar(h * 60, R - TRACK / 2 - 13);
          return (
            <text key={h} x={p.x} y={p.y} className="dial-hour" textAnchor="middle" dominantBaseline="central">
              {String(h).padStart(2, '0')}
            </text>
          );
        })}

        {/* the effect, round the ring from the knob */}
        {course.afterEnd != null && (
          <path d={arc(start + course.over, end)} className="dial-after" strokeWidth={4} />
        )}
        <path d={arc(start + course.firstEffects, start + course.over)} className="dial-effect" strokeWidth={TRACK - 6} />
        <path d={arc(start + course.peakStart, start + course.peakEnd)} className="dial-peak" strokeWidth={TRACK - 6} />

        {/* the knob */}
        <g
          className="dial-knob"
          role="slider"
          tabIndex={0}
          aria-label={tr('Time you take it')}
          aria-valuemin={0}
          aria-valuemax={DAY - 5}
          aria-valuenow={start}
          aria-valuetext={clock(start)}
          onKeyDown={onKey}
        >
          <circle cx={k.x} cy={k.y} r={22} className="dial-knob-hit" />
          <circle cx={k.x} cy={k.y} r={13} className="dial-knob-face" />
          <circle cx={k.x} cy={k.y} r={3.5} className="dial-knob-dot" />
        </g>
      </svg>

      <div className="dial-centre">
        <span className="dial-label">{tr('Taken at')}</span>
        <span className="dial-time tabular">{clock(start)}</span>
        {isNow ? (
          <span className="dial-label">{tr('now')}</span>
        ) : (
          <button type="button" className="btn-ghost btn-xs dial-now" onClick={onNow}>
            {tr('{0}, back to now', { 0: partOfDay(start) })}
          </button>
        )}
      </div>
    </div>
  );
}
