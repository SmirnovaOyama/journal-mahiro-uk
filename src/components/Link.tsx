import type { AnchorHTMLAttributes } from 'react';
import { go, href, type Route } from '../lib/router';
import type { ViewMove } from '../motion/viewMove';

/** A real link (it opens in a new tab, it can be copied) that moves within
 *  the site through the router: into a page by default, which slides it in. */
export function Link({
    to,
    move,
    onClick,
    ...rest
}: { to: Route; move?: ViewMove } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
    return (
        <a
            {...rest}
            href={href(to)}
            onClick={e => {
                onClick?.(e);
                if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                go(to, { move });
            }}
        />
    );
}
