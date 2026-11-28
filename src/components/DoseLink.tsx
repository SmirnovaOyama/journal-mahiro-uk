import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { IndexEntry } from '../lib/data';
import { tr } from '../lib/i18n';
import { logFrom, type Ingestion } from '../lib/journal';
import { href, type Route } from '../lib/routes';
import { go } from '../lib/router';
import { featureOn, useFeature } from '../lib/features';

/* A dose as an address: /log/caffeine/100mg/oral opens the dose form with
   that filled in, the time set to now. Put on an NFC sticker on the box,
   in a phone's Shortcuts, or as a bookmark, a dose taken every day is two
   taps. Opening the address logs nothing by itself: the form still has to
   be sent, so a link someone else made can't write into a journal. */

const muted = 'text-[var(--text-muted)]';

/** The address that fills the form in with this dose. */
export function doseRoute(i: Pick<Ingestion, 'substance' | 'dose' | 'unit' | 'route'>): Route {
    return { page: 'log', id: i.substance, ...(i.dose != null ? { dose: i.dose, unit: i.unit, route: i.route } : {}) };
}

/** Under a dose in the journal: its address, to copy or scan. */
export function DoseLink({ i }: { i: Ingestion }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const wanted = useFeature('doseLink');
    const link = `${window.location.origin}${href(doseRoute(i))}`;
    if (!wanted) return null;
    return (
        <div className="mt-4">
            <button type="button" className={`link-button text-sm !text-[var(--text-muted)]`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {tr('A link that logs this dose again')}
            </button>
            {open && (
                <div className="m-appear mt-3">
                    <p className={`text-xs ${muted}`}>
                        {tr('Opening it fills in the dose form with the time set to now. Nothing is logged until you tap Log it. Save it as a bookmark or a Shortcut, or write it to an NFC sticker on the box.')}
                    </p>
                    <div className="mt-3 flex items-center gap-4">
                        <div className="shrink-0 rounded-[var(--radius-md)] bg-white p-2.5">
                            <QRCodeSVG value={link} size={96} level="M" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <a href={link} className="block text-xs underline underline-offset-[3px] [overflow-wrap:anywhere]">
                                {link.replace(/^https?:\/\//, '')}
                            </a>
                            <button
                                type="button"
                                className="btn-secondary btn-sm mt-2"
                                onClick={() => {
                                    void navigator.clipboard
                                        ?.writeText(link)
                                        .then(() => {
                                            setCopied(true);
                                            window.setTimeout(() => setCopied(false), 2000);
                                        })
                                        .catch(() => {});
                                }}
                            >
                                {copied ? tr('Copied') : tr('Copy the link')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** The page behind such an address: it hands what the address says to the
 *  journal's dose form and gets out of the way, so Back doesn't land here. */
export function LogFromAddress({ route, index, byId }: { route: Extract<Route, { page: 'log' }>; index: IndexEntry[] | null; byId: Map<string, IndexEntry> }) {
    useEffect(() => {
        // Turned off in Settings: such an address opens the journal, and fills nothing in.
        if (!featureOn('doseLink')) {
            go({ page: 'journal' }, { replace: true });
            return;
        }
        // The catalogue says whether the name is one of its own.
        if (route.id && !index) return;
        const known = route.id ? byId.get(route.id) : undefined;
        logFrom(
            {
                ...(known ? { id: known.id } : route.id ? { name: route.id } : {}),
                ...(route.dose != null ? { dose: route.dose } : {}),
                ...(route.unit ? { unit: route.unit } : {}),
                ...(route.route ? { route: route.route } : {}),
                time: Date.now(),
            },
            true,
        );
    }, [route, index, byId]);
    return null;
}
