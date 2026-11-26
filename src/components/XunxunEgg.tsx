import { useEffect, useRef } from 'react';
import { sparkleFrom } from '../lib/eggs';
import { isZh } from '../lib/i18n';

/* What a search for 寻寻 finds: a picture, the name, and a few lines of
   verse under the field. Betelgeuse, which is always about to go off and
   hasn't; Misaka Mikoto's coin, which burns up inside fifty metres; Oyama
   Mahiro, who slept and woke up a girl. The last line is the user's own.
   Hearts the first time it shows on a visit, and again at a tap on the
   picture. The verse is Chinese for every reader, in the site's script for
   a reader of 正體中文; the name is a name and stays as it is written. */

/** 寻寻, 尋尋 or xunxun as the whole search, in any case, with or without spaces. */
export const isXunxunSearch = (q: string) => /^(寻寻|尋尋|xunxun)$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

const VERSE = {
    zh: {
        lines: [
            '参宿四红了很久，',
            '都说它要炸开，它始终没有。',
            '光走了几百年，落在红墙绿瓦上。',
            '御坂美琴弹起的硬币，飞不出五十米。',
            '绪山真寻睡了一觉，醒来就是了。',
            '我也睡过很多觉。',
        ],
        last: '想要成为，但是始终成为不了的“女孩子”',
    },
    zhHant: {
        lines: [
            '參宿四紅了很久，',
            '都說它要炸開，它始終沒有。',
            '光走了幾百年，落在紅牆綠瓦上。',
            '御坂美琴彈起的硬幣，飛不出五十米。',
            '緒山真尋睡了一覺，醒來就是了。',
            '我也睡過很多覺。',
        ],
        last: '想要成為，但是始終成為不了的「女孩子」',
    },
};

let burst = false;

export function XunxunEgg() {
    const picture = useRef<HTMLImageElement>(null);
    const verse = isZh() ? VERSE.zhHant : VERSE.zh;
    useEffect(() => {
        if (burst) return;
        burst = true;
        const id = window.setTimeout(() => sparkleFrom(picture.current), 250);
        return () => window.clearTimeout(id);
    }, []);
    return (
        <figure className="m-appear mt-6" lang={isZh() ? 'zh-Hant' : 'zh-Hans'}>
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
            <figcaption className="mt-3">
                <span className="block text-base font-semibold text-[var(--text)]">寻寻</span>
                <span className="block mt-2 text-sm leading-loose text-[var(--text-muted)]">
                    {verse.lines.map(l => (
                        <span key={l} className="block">{l}</span>
                    ))}
                </span>
                <span className="block mt-3 text-sm font-medium leading-relaxed text-[var(--text)]">{verse.last}</span>
            </figcaption>
        </figure>
    );
}
