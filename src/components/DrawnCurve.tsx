import { useId, useLayoutEffect, useRef } from 'react';

/* A dose's curve, drawn on as a pen would: left to right along the clock,
   quick through the middle and slowing as it lands, with the wash under it
   uncovered with the line.

   The pen moves along the time axis, not along the line: the line and its
   wash are uncovered up to the same moment, so they can't drift apart. (By
   the line's own length, as dashes, they did: the browser's length for a
   curve isn't quite the length a dash is measured on, and the wash lagged.)

   The pen leaves a streak while it moves: the newest stretch is drawn again
   through a sideways blur, as long and as soft as the pen is fast, its edges
   soft because the blur comes after the cut. At the start the streak is long
   and loose; as the pen slows it shortens and sharpens, and it is gone by the
   time the line stops. Behind it the line is crisp throughout.

   The pen's position runs on an ease (DRAW_EASE): gentle to start, fast
   through the middle, a long settle at the end. Its speed, the slope of that
   ease, sets the streak. With reduced motion the curve is simply there. */

/** How long a curve takes to draw, ms. */
export const DRAW_MS = 560;
/** A soft start, a long settle: the pen's progress over time. */
const DRAW_EASE: [number, number, number, number] = [0.45, 0, 0.12, 1];
/** The longest streak, px, and the softest blur, px. */
const MAX_TAIL = 46;
const MAX_BLUR = 5;

/** A cubic-bezier easing, as CSS has it: time in, progress out. */
function bezier([x1, y1, x2, y2]: [number, number, number, number]) {
    const bx = (t: number) => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
    const by = (t: number) => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
    const dx = (t: number) => 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
    return (x: number) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let t = x;
        for (let k = 0; k < 8; k++) {
            const d = dx(t);
            if (Math.abs(d) < 1e-6) break;
            t = Math.min(1, Math.max(0, t - (bx(t) - x) / d));
        }
        return by(t);
    };
}
const ease = bezier(DRAW_EASE);

const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function DrawnCurve({
    d,
    color,
    fillOpacity,
    delay = 0,
    height,
}: {
    /** The curve as an open path, baseline to baseline. */
    d: string;
    color: string;
    fillOpacity: number;
    /** When to start, ms after it appears: doses in the order taken. */
    delay?: number;
    /** The chart's height, for the cuts. */
    height: number;
}) {
    const uid = useId().replace(/:/g, '');
    const line = useRef<SVGPathElement>(null);
    const sharpCut = useRef<SVGRectElement>(null);
    const streakCut = useRef<SVGRectElement>(null);
    const washCut = useRef<SVGRectElement>(null);
    const blur = useRef<SVGFEGaussianBlurElement>(null);
    const streak = useRef<SVGGElement>(null);

    // Before the first paint: nothing drawn yet, so it never flashes whole.
    useLayoutEffect(() => {
        const L = line.current;
        const S = sharpCut.current;
        const K = streakCut.current;
        const F = washCut.current;
        const B = blur.current;
        const G = streak.current;
        if (!L || !S || !K || !F || !B || !G) return;
        const all = (r: SVGRectElement) => {
            r.setAttribute('x', '-100000');
            r.setAttribute('width', '200000');
        };
        const done = () => {
            all(S);
            all(F);
            G.style.display = 'none';
        };
        if (reduced()) {
            done();
            return;
        }
        const box = L.getBBox();
        // A little past each end, so the round caps are uncovered too.
        const x0 = box.x - 2;
        const span = box.width + 4;
        const show = (p: number, speed: number) => {
            const at = x0 + p * span;
            // Pixels per unit of time, scaled to a streak and a blur.
            const tail = Math.min(MAX_TAIL, speed * span * 0.09, at - x0);
            S.setAttribute('x', `${x0 - 4}`);
            S.setAttribute('width', `${Math.max(0, at - tail - x0 + 4)}`);
            K.setAttribute('x', `${at - tail}`);
            K.setAttribute('width', `${Math.max(0, tail)}`);
            F.setAttribute('x', `${x0 - 4}`);
            F.setAttribute('width', `${Math.max(0, at - tail / 2 - x0 + 4)}`);
            G.style.display = tail > 0.5 ? '' : 'none';
            B.setAttribute('stdDeviation', `${Math.min(MAX_BLUR, speed * 2.6).toFixed(2)} 0`);
        };
        show(0, 0);
        let frame = 0;
        let last = 0;
        const start = performance.now() + delay;
        const step = (now: number) => {
            const t = (now - start) / DRAW_MS;
            if (t >= 1) {
                done();
                return;
            }
            if (t > 0) {
                // The slope of the ease: how fast the pen is going.
                const h = 0.004;
                const speed = (ease(Math.min(1, t + h)) - ease(Math.max(0, t - h))) / (2 * h);
                last = last ? last + (speed - last) * 0.6 : speed;
                show(ease(t), last);
            }
            frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
        // Drawn once, when it appears; a new path afterwards is simply shown whole.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cut = (ref: React.RefObject<SVGRectElement>, id: string) => (
        <clipPath id={`${id}-${uid}`}>
            <rect ref={ref} x={0} y={-50} height={height + 100} width={0} />
        </clipPath>
    );
    const stroke = { d, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

    return (
        <g>
            <defs>
                {cut(sharpCut, 'cs')}
                {cut(streakCut, 'ck')}
                {cut(washCut, 'cw')}
                <filter id={`mb-${uid}`} x="-50%" y="-20%" width="200%" height="140%">
                    <feGaussianBlur ref={blur} stdDeviation="0 0" />
                </filter>
            </defs>
            <path d={`${d} Z`} fill={color} opacity={fillOpacity} stroke="none" clipPath={`url(#cw-${uid})`} />
            <path ref={line} {...stroke} clipPath={`url(#cs-${uid})`} />
            {/* The streak: cut first, then blurred, so it has no hard edge. */}
            <g ref={streak} filter={`url(#mb-${uid})`}>
                <g clipPath={`url(#ck-${uid})`}>
                    <path {...stroke} strokeWidth={2.4} />
                </g>
            </g>
        </g>
    );
}
