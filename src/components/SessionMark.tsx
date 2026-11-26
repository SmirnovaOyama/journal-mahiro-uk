/* A session's mark: what was taken, as a short stroke of each substance's
   colour, stacked: the same line and colour as its curve on the chart, so
   the mark is the chart's key. It used to be a disc in those colours, and a
   full disc of blue was the loudest thing on the page, louder than the curve
   it stood for. */

const MAX = 4;

/** A session's mark: a short line in each colour, one under another. */
export function SessionMark({ colors, size = 28 }: { colors: string[]; size?: number }) {
    const shown = colors.slice(0, MAX);
    const n = Math.max(1, shown.length);
    const len = Math.round(size * 0.64);
    const gap = 4.5;
    const top = size / 2 - ((n - 1) * gap) / 2;
    const x0 = (size - len) / 2;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
            {(shown.length ? shown : ['var(--border-strong)']).map((c, k) => (
                <line
                    key={k}
                    x1={x0}
                    x2={x0 + len}
                    y1={top + k * gap}
                    y2={top + k * gap}
                    stroke={c}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                />
            ))}
        </svg>
    );
}
