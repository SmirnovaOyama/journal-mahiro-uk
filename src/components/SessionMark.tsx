/* A session's mark, as PsychonautWiki Journal marks one, in Oyama's hand. */

const TAU = Math.PI * 2;

/** Five points round (cx, cy): out to R, in to r. */
export function starPath(cx: number, cy: number, R: number, r: number) {
    let d = '';
    for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rad = k % 2 ? r : R;
        d += `${k ? 'L' : 'M'}${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    }
    return `${d}Z`;
}

/** A session's mark: a disc in the colours of what was taken, a wedge each,
 *  and a star on it when it's a favourite. */
export function SessionMark({ colors, size = 28, star = false }: { colors: string[]; size?: number; star?: boolean }) {
    const r = size / 2;
    const n = colors.length;
    const at = (a: number) => `${(r + r * Math.cos(a)).toFixed(2)} ${(r + r * Math.sin(a)).toFixed(2)}`;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden="true">
            {n <= 1 ? (
                <circle cx={r} cy={r} r={r} fill={colors[0] ?? 'var(--border)'} />
            ) : (
                colors.map((c, k) => {
                    const a0 = (k / n) * TAU - Math.PI / 2;
                    const a1 = ((k + 1) / n) * TAU - Math.PI / 2;
                    return <path key={k} d={`M${r} ${r}L${at(a0)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${at(a1)}Z`} fill={c} />;
                })
            )}
            {star && <path d={starPath(r, r * 1.04, r * 0.56, r * 0.24)} fill="var(--bg)" stroke="none" />}
        </svg>
    );
}

