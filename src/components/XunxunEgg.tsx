import { useEffect, useRef } from 'react';
import { sparkleFrom } from '../lib/eggs';

/* What a search for 寻寻 finds: a picture and the name, under the field.
   Hearts the first time it shows on a visit, and again at a tap on the
   picture. The name is a name: it is the same in every language. */

/** 寻寻, 尋尋 or xunxun as the whole search, in any case, with or without spaces. */
export const isXunxunSearch = (q: string) => /^(寻寻|尋尋|xunxun)$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

let burst = false;

export function XunxunEgg() {
    const picture = useRef<HTMLImageElement>(null);
    useEffect(() => {
        if (burst) return;
        burst = true;
        const id = window.setTimeout(() => sparkleFrom(picture.current), 250);
        return () => window.clearTimeout(id);
    }, []);
    return (
        <figure className="m-appear mt-6">
            <img
                ref={picture}
                src="/xunxun.webp"
                alt=""
                width={160}
                height={160}
                decoding="async"
                draggable={false}
                className="block size-40 rounded-3xl cursor-pointer select-none"
                onClick={e => sparkleFrom(e.currentTarget)}
            />
            <figcaption className="mt-3 text-base font-semibold text-[var(--text)]">寻寻</figcaption>
        </figure>
    );
}
