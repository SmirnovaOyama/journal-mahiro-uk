import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { IndexEntry } from '../lib/data';
import { tr } from '../lib/i18n';
import { WatchError, checkIn, dueAt, shareLink, startShare, stopShare, useShare } from '../lib/watch';
import Segmented from './Segmented';
import { useFeature } from '../lib/features';

/* On the Now screen: sharing tonight with someone trusted (lib/watch.ts),
   and answering their check-ins. */

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
                    ? tr('A check-in was due at {0}. Whoever is watching sees it as missed until you tap.', { 0: clock(due) })
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

export function ShareNight(_: { byId: Map<string, IndexEntry> }) {
    const share = useShare();
    const [every, setEvery] = useState<'0' | '30' | '60'>('30');
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const wanted = useFeature('watch');
    useTick(60_000);

    const begin = async () => {
        setBusy(true);
        setError(null);
        try {
            await startShare({ hours: 12, every: Number(every), name });
        } catch (e) {
            setError(
                e instanceof WatchError && e.code === 'OFFLINE'
                    ? tr('Sharing needs a connection, and there is none.')
                    : tr('Couldn’t start sharing. Try again in a moment.'),
            );
        } finally {
            setBusy(false);
        }
    };

    if (!wanted) return null;
    if (!share)
        return (
            <section className="mt-10" aria-labelledby="share-night">
                <h2 id="share-night" className="group-heading mb-1">
                    {tr('Someone to watch over tonight')}
                </h2>
                <p className={`text-sm ${muted}`}>
                    {tr('A link for someone you trust. They see what you log tonight, where it is on its course, and whether you’ve checked in. It’s encrypted on this device and the key is in the link itself: the server keeps a copy it can’t read, for 12 hours.')}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--text)]">{tr('Ask me to check in')}</span>
                    <Segmented aria-label={tr('Ask me to check in')} options={EVERY.map(o => ({ id: o.id, label: tr(o.label, undefined, 'every') }))} value={every} onChange={setEvery} />
                </div>
                <input
                    className={`input-base mt-3 w-full ${name ? 'is-inked' : ''}`}
                    placeholder={tr('What they call you (optional)')}
                    aria-label={tr('What they call you (optional)')}
                    autoComplete="off"
                    maxLength={40}
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <button type="button" className="btn-secondary mt-4" onClick={() => void begin()} disabled={busy}>
                    {busy ? tr('Making the link…') : tr('Make the link')}
                </button>
                {error && (
                    <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
                        {error}
                    </p>
                )}
            </section>
        );

    const link = shareLink(share);
    const canShare = typeof navigator.share === 'function';
    return (
        <section className="mt-10" aria-labelledby="share-night">
            <h2 id="share-night" className="group-heading mb-1">
                {tr('Shared until {0}', { 0: clock(share.expires) })}
            </h2>
            <p className={`text-sm ${muted}`}>
                {tr('Anyone with this link can read tonight’s doses until then, so it is for the person watching and no one else. They see changes while this site is open on your device.')}
            </p>
            <div className="mt-4 flex justify-center rounded-[var(--radius-lg)] bg-white p-4">
                <QRCodeSVG value={link} size={176} level="M" />
            </div>
            <input className="input-base is-inked mt-3 w-full text-xs" readOnly value={link} aria-label={tr('The link')} onFocus={e => e.currentTarget.select()} />
            <div className="mt-3 flex flex-wrap gap-2">
                {canShare && (
                    <button type="button" className="btn-primary btn-sm" onClick={() => void navigator.share({ url: link }).catch(() => {})}>
                        {tr('Send it')}
                    </button>
                )}
                <button
                    type="button"
                    className="btn-secondary btn-sm"
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
                <button type="button" className="btn-danger btn-sm" onClick={() => void stopShare()}>
                    {tr('Stop sharing')}
                </button>
            </div>
            {share.sent && <p className={`mt-3 text-xs ${muted}`}>{tr('Last sent at {0}.', { 0: clock(share.sent) })}</p>}
        </section>
    );
}
