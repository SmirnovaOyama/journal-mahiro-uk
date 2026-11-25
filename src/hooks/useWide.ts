import { useEffect, useState } from 'react';

/** A window wide enough for tabs under a page's title (Settings, Account,
 *  Admin), rather than a list of tiles that each open a page. */
export function useWide() {
    const q = '(min-width: 768px)';
    const [wide, setWide] = useState(() => window.matchMedia(q).matches);
    useEffect(() => {
        const mq = window.matchMedia(q);
        const on = () => setWide(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    return wide;
}
