import type { DoseRow } from '../lib/data';
import { dataText, roaName, spaced, tr } from '../lib/i18n';

/* How much of a dose gets into the blood, by route: why the same amount
   isn't the same dose another way (oral estradiol, a few percent; a depot
   injection, all of it). One route known: a line. Several: a bar each, from
   the low figure to the high, the chosen route's inked; tap one to show its
   doses. */

const fmt = (n: number) => (n % 1 ? n.toFixed(1) : String(n));

/** "about 76%", "43–80%", "up to 17%". */
export function absorbedText(a: NonNullable<DoseRow['absorbed']>): string {
    if (a.min === 0) return tr('up to {0}%', { 0: fmt(a.max) });
    if (a.min === a.max) return tr('about {0}%', { 0: fmt(a.min) });
    return `${fmt(a.min)}–${fmt(a.max)}%`;
}

const sourceOf = (a: NonNullable<DoseRow['absorbed']>) => (a.source === 'Wikipedia' && a.page ? `Wikipedia, ${a.page}` : (a.source ?? 'PsychonautWiki'));

export function Absorption({ rows, roa, onPick }: { rows: DoseRow[]; roa: string; onPick: (roa: string) => void }) {
    const known = rows.filter(r => r.absorbed);
    if (!known.length) return null;
    const cur = rows.find(r => r.roa === roa);
    const sources = [...new Set(known.map(r => sourceOf(r.absorbed!)))];
    const muted = 'text-[var(--text-muted)]';

    return (
        <section className="mt-7" aria-labelledby="absorption-title">
            <h3 id="absorption-title" className="group-heading mb-2">
                {tr('How much gets in')}
            </h3>
            <p className="text-sm leading-relaxed">
                {cur?.absorbed ? (
                    <>
                        <span className="font-medium">{absorbedText(cur.absorbed).replace(/^./, c => c.toUpperCase())}</span>
                        {spaced(tr(' of a dose taken this way reaches the blood{0}.', { 0: cur.absorbed.note ? ` (${dataText(cur.absorbed.note)})` : '' }))}
                    </>
                ) : (
                    tr('Not known for this route.')
                )}
                {cur?.note && (
                    <span className={muted}>{` ${dataText(cur.note).replace(/^[a-z]/, c => c.toUpperCase()).replace(/([^.。])$/, '$1.')}`}</span>
                )}
            </p>

            {known.length > 1 && (
                <div className="mt-4 space-y-2.5" role="radiogroup" aria-label={tr('Routes, by how much gets in')}>
                    {known.map(r => {
                        const a = r.absorbed!;
                        const chosen = r.roa === roa;
                        return (
                            <button
                                key={r.roa}
                                type="button"
                                role="radio"
                                aria-checked={chosen}
                                onClick={() => onPick(r.roa)}
                                className="group grid w-full grid-cols-[6rem_1fr_auto] items-center gap-3 text-start"
                            >
                                <span className={`truncate text-xs ${chosen ? 'font-semibold text-[var(--text)]' : muted}`}>{roaName(r.roa)}</span>
                                <span className="relative h-2 rounded-full bg-[var(--surface-muted)]">
                                    <span
                                        className={`absolute inset-y-0 rounded-full transition-[background-color,opacity] duration-200 ${
                                            chosen ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)] opacity-40 group-hover:opacity-70'
                                        }`}
                                        // At least a sliver, so "up to 2%" still shows.
                                        style={{ left: `${a.min}%`, width: `max(6px, ${a.max - a.min}%)` }}
                                    />
                                </span>
                                <span className={`w-[5.25rem] whitespace-nowrap text-end text-xs tabular-nums ${chosen ? 'text-[var(--text)]' : muted}`}>{absorbedText(a)}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <p className={`mt-3 text-xs leading-relaxed ${muted}`}>
                {known.length > 1 || rows.length > 1
                    ? tr('So the same amount isn’t the same dose by another route: go by each route’s own doses. ')
                    : ''}
                {tr('From {0}.', { 0: sources.join('; ') })}
            </p>
        </section>
    );
}
