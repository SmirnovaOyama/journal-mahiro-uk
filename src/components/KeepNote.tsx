import { useState } from 'react';
import { useAccount } from '../lib/account';
import { clearsUnvisited, isInstalled, onTouch } from '../lib/installed';
import { Link } from './Link';
import { tr } from '../lib/i18n';

const SEEN = 'journal.keep-note.v1';

/**
 * In a Safari tab, the journal can be cleared: Safari empties a site's
 * storage after 7 days of use without a visit. Said once, from the first
 * time the journal is opened, while there's still little to move: turn on
 * the encrypted backup, then add the site to the Home Screen and sign in
 * there, since the Home Screen app starts with its own, empty storage.
 * Not shown from the Home Screen, nor in a browser that doesn't clear.
 */
export function KeepNote() {
    const { account } = useAccount();
    const [gone, setGone] = useState(() => {
        try {
            return localStorage.getItem(SEEN) === 'true';
        } catch {
            return true;
        }
    });
    if (gone || isInstalled() || !clearsUnvisited()) return null;
    const dismiss = () => {
        try {
            localStorage.setItem(SEEN, 'true');
        } catch {
            /* private mode: it shows again next time */
        }
        setGone(true);
    };
    const touch = onTouch();
    return (
        <section className="callout mb-8 space-y-2" aria-label={tr('Keeping the journal')}>
            <p className="font-medium text-[var(--text)]">
                {touch ? tr('Add the journal to your Home Screen') : tr('Add the journal to your Dock')}
            </p>
            <p>
                {tr('In a browser tab, Safari deletes what this site keeps after 7 days of use without a visit, the journal included. From the Home Screen it keeps its own count. That app starts empty, though: it doesn’t share this tab’s storage.')}
            </p>
            <ol className="list-decimal ps-5 space-y-1">
                {!account && (
                    <li>
                        <Link to={{ page: 'settings', sub: 'account' }} className="font-medium text-[var(--text)] underline underline-offset-3">
                            {tr('Turn on the encrypted backup')}
                        </Link>
                        {tr(', so the journal can be brought across.')}
                    </li>
                )}
                <li>{touch ? tr('In Safari, tap Share, then Add to Home Screen.') : tr('In Safari, choose File, then Add to Dock.')}</li>
                {!account ? <li>{tr('Open it from there and sign in.')}</li> : <li>{tr('Open it from there and sign in to the same account.')}</li>}
            </ol>
            <button type="button" className="link-button !text-[var(--text)]" onClick={dismiss}>
                {tr('Got it')}
            </button>
        </section>
    );
}
