import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { IndexEntry } from '../lib/data';
import { tr } from '../lib/i18n';
import { checkIn, dueAt, setCheckInEvery, shareLink, startShare, stopShare, useShare, type Share } from '../lib/watch';
import Segmented from './Segmented';
import { useFeature } from '../lib/features';
import { toast } from '../lib/eggs';

/* On the Now screen: sharing tonight with someone trusted (lib/watch.ts),
   and answering their check-ins.

   Sharing is one tap: the link is made on this device, so the share sheet
   opens with it straight away (on a computer it's copied), and the copy
   follows it to the server. A check-in is asked for every 30 minutes to
   begin with; that, and stopping, are there once it's shared. */

const muted = 'text-[var(--text-muted)]';
const clock = (t: number) => {
    const d = new Date(t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function useTick(ms: number) {
    const [, setN] = useState(0);
    useEffect(() => {
        const t = window.setInterval(() => setN(n => n + 1), ms);
        return () => window.clearInterval(t);
    }, [ms]);
}

/** While a night is shared with check-ins asked for: one large button that
 *  answers them, and when the next is due. Late, it says so. */
export function CheckIn() {
    const share = useShare();
    const wanted = useFeature('watch');
    useTick(20_000);
    const due = share && dueAt(share);
    if (!wanted || !share || due == null) return null;
    const late = Date.now() > due;
    return (
        <div className="mt-5">
            <button
                type="button"
                className={`w-full min-h-14 rounded-[var(--radius-lg)] px-5 text-base font-semibold ${late ? 'bg-[var(--danger)] text-white' : 'border-(length:--hairline) border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--surface-hover)]'}`}
                onClick={checkIn}
            >
                {tr('I’m okay')}
            </button>
            <p className={`mt-2 text-sm ${late ? 'text-[var(--danger)]' : muted}`} role="status">
                {late
                    ? tr('A check-in was due at {0}. The person watching sees it as missed until you tap.', { 0: clock(due) })
                    : tr('Checked in at {0}. The next is due by {1}.', { 0: clock(share.checked), 1: clock(due) })}
            </p>
        </div>
    );
}

const EVERY = [
    { id: '0', label: 'Off' },
    { id: '30', label: '30 min' },
    { id: '60', label: '1 h' },
] as const;

/** Hands the link over, called straight from the tap: the share sheet on a
 *  phone, else the link is copied. */
async function handOver(link: string) {
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        try {
            await navigator.share({ url: link });
            return;
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(link);
        toast(tr('Link copied.'));
    } catch {
        /* the link is on the Now screen, to copy by hand */
    }
}

/** Shares tonight, or hands the link over again if it's shared already. */
export function shareTonight(current: Share | null) {
    if (!current && !navigator.onLine) {
        toast(tr('Sharing needs an internet connection.'));
        return;
    }
    void handOver(shareLink(current ?? startShare({ hours: 12, every: 30 })));
}

export function ShareNight(_: { byId: Map<string, IndexEntry> }) {
    const share = useShare();
    const wanted = useFeature('watch');
    useTick(60_000);

    if (!wanted) return null;
    if (!share)
        return (
            <section className="mt-10" aria-labelledby="share-night">
                <h2 id="share-night" className="group-heading mb-1">
                    {tr('Someone to watch over this session')}
                </h2>
                <p className={`text-sm ${muted}`}>
                    {tr('A link for someone you trust. They’ll see what you log in this session, how far along each dose is, and whether you’ve checked in. It’s encrypted on this device, and the key is in the link: the server keeps a copy it can’t read for 12 hours.')}
                </p>
                <button type="button" className="btn-primary mt-4" onClick={() => shareTonight(null)}>
                    {tr('Share this session')}
                </button>
            </section>
        );

    const link = shareLink(share);
    return (
        <section className="mt-10" aria-labelledby="share-night">
            <h2 id="share-night" className="group-heading mb-1">
                {tr('Shared until {0}', { 0: clock(share.expires) })}
            </h2>
            <p className={`text-sm ${muted}`}>
                {tr('Anyone with this link can see this session’s doses until then, so it’s meant only for the person watching. They’ll see updates while this site is open on your device.')}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--text)]">{tr('Ask me to check in')}</span>
                <Segmented
                    aria-label={tr('Ask me to check in')}
                    options={EVERY.map(o => ({ id: o.id, label: tr(o.label, undefined, 'every') }))}
                    value={String(share.every) as (typeof EVERY)[number]['id']}
                    onChange={v => setCheckInEvery(Number(v))}
                />
            </div>
            <div className="mt-4 flex justify-center rounded-[var(--radius-lg)] bg-white p-4">
                <QRCodeSVG value={link} size={176} level="M" />
            </div>
            <input className="input-base is-inked mt-3 w-full text-xs" readOnly value={link} aria-label={tr('The link')} onFocus={e => e.currentTarget.select()} />
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-primary btn-sm" onClick={() => shareTonight(share)}>
                    {tr('Send again')}
                </button>
                <button type="button" className="btn-danger btn-sm" onClick={() => void stopShare()}>
                    {tr('Stop sharing')}
                </button>
            </div>
            <p className={`mt-3 text-xs ${muted}`}>
                {share.pending ? tr('Not sent yet. It will be sent once there’s a connection.') : share.sent ? tr('Last sent at {0}.', { 0: clock(share.sent) }) : null}
            </p>
        </section>
    );
}
