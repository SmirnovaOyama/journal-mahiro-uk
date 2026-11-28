/* A session's mark: what was taken, as a hollow ring in each substance's
   colour, overlapping, the first taken on the left and behind:
   the rings the chart draws where each dose was taken, so the mark is the
   chart's key. It used to be a disc in those colours, and a full disc of
   blue was the loudest thing on the page; then a stack of short strokes. */

const MAX = 4;
const STROKE = 2.25;

/** A session's mark: a ring in each colour, side by side (four in a square). */
export function SessionMark({ colors, size = 28 }: { colors: string[]; size?: number }) {
    const shown = colors.length ? colors.slice(0, MAX) : ['var(--border-strong)'];
    const n = shown.length;
    const r = n === 1 ? size * 0.22 : size * 0.18;
    // Up to three in a row, as far apart as the box allows; four in a
    // square, as a row of four overlapped so far that each was a sliver.
    const step = n === 1 ? 0 : Math.min(r * 1.25, (size - 2 * r - STROKE - 2) / (n - 1));
    const d = r * 1.3;
    const at = (k: number): [number, number] =>
        n === 4 ? [size / 2 + (k % 2 ? d : -d) / 2, size / 2 + (k < 2 ? -d : d) / 2] : [size / 2 - ((n - 1) * step) / 2 + k * step, size / 2];
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
            {shown.map((c, k) => (
                <circle key={k} cx={at(k)[0]} cy={at(k)[1]} r={r} fill="var(--bg)" stroke={c} strokeWidth={STROKE} />
            ))}
        </svg>
    );
}
