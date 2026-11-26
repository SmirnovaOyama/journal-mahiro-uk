import { Fragment } from 'react';

const ADDRESS = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
/** What ends a sentence, not an address. */
const TRAILING = /[.,;:!?)\]}]+$/;

/** An address as it's read: its host, and its path when that's short. */
function shown(url: URL) {
    const host = url.host.replace(/^www\./, '');
    const path = (url.pathname + url.search).replace(/\/$/, '');
    if (!path) return host;
    return path.length <= 28 ? host + path : `${host}/…`;
}

/** Text as it's written, with every web address in it a link that opens in a
 *  new tab. The data's sentences come from other sites and name addresses in
 *  passing ("See http://dxm.tripsit.me for…"); here they can be followed. */
export function Linked({ text }: { text: string }) {
    const parts: React.ReactNode[] = [];
    let at = 0;
    for (const m of text.matchAll(ADDRESS)) {
        const raw = m[0].replace(TRAILING, '');
        let url: URL;
        try {
            url = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw);
        } catch {
            continue;
        }
        const start = m.index ?? 0;
        if (start > at) parts.push(text.slice(at, start));
        parts.push(
            <a
                key={start}
                href={url.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-[3px] [overflow-wrap:anywhere]"
            >
                {shown(url)}
            </a>,
        );
        at = start + raw.length;
    }
    if (!parts.length) return <>{text}</>;
    if (at < text.length) parts.push(text.slice(at));
    return (
        <>
            {parts.map((p, i) => (
                <Fragment key={i}>{p}</Fragment>
            ))}
        </>
    );
}
