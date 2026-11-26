import { useMemo, type ReactNode } from 'react';
import { sessionsOf, useJournal } from '../lib/journal';
import PixelCat from './PixelCat';
import { Avatar, muted, on } from './AccountParts';
import { dateLocale, tr } from '../lib/i18n';

/* The top of the account page, as hrt.mahiro.uk's (pages/Account.tsx there):
   the name's initial in a circle, the name, since when, and what the journal
   holds, in the figures the journal's own pages use. Flat, like everything
   else: no card, no shading. */

function Figure({ value, label }: { value: ReactNode; label: string }) {
    return (
        <div className="min-w-0">
            <div className={`font-display text-[1.5rem] font-light leading-tight tracking-[-0.02em] tabular-nums ${on}`}>{value}</div>
            <div className={`mt-0.5 truncate text-xs ${muted}`}>{label}</div>
        </div>
    );
}

export function ProfileHeader({ name, since, devices }: { name: string; since: number; devices?: number }) {
    const { data } = useJournal();
    const sessions = useMemo(() => sessionsOf(data.ingestions).length, [data.ingestions]);
    const substances = useMemo(() => new Set(data.ingestions.map(i => i.substance)).size, [data.ingestions]);
    const sinceText = new Date(since).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });
    return (
        <div>
            <div className="flex items-center gap-4">
                <Avatar name={name} size="lg" />
                <div className="min-w-0 flex-1">
                    <p className={`truncate text-base font-semibold ${on}`}>{name}</p>
                    <p className={`mt-0.5 text-xs ${muted}`}>{tr('Journaling since {0}', { 0: sinceText })}</p>
                </div>
                {/* The cats sit by a page's title, as they do on Search. */}
                <span className="shrink-0" aria-hidden="true">
                    <PixelCat pose="loaf" size={36} />
                </span>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
                <Figure value={sessions.toLocaleString(dateLocale())} label={sessions === 1 ? tr('session') : tr('sessions')} />
                <Figure value={substances.toLocaleString(dateLocale())} label={substances === 1 ? tr('substance') : tr('substances')} />
                <Figure value={devices ?? 1} label={devices && devices > 1 ? tr('devices') : tr('device')} />
            </div>
        </div>
    );
}
