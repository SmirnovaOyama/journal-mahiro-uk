import { useEffect, useRef } from 'react';
import { sparkleFrom } from '../lib/eggs';
import { isZh } from '../lib/i18n';

/* What a search for 寻寻 finds: a picture, the name, and three stanzas under
   the field, in Chinese and then in English. Betelgeuse over red walls and
   green tiles, an ember that is said to be about to become another star;
   Misaka Mikoto's twenty thousand Sisters, two of them a year below at
   school and none of them the writer; Oyama Mahiro, who slept and woke up a
   girl. 寻寻觅觅 is Li Qingzhao's and holds the name; 参商 is Du Fu's, the
   two stars that never share a sky, and in English they are Orion and the
   Scorpion, which are the same two. The last line is the user's own.
   Under the verse, a second picture: asleep under a cherry tree at dusk.
   Hearts the first time it shows on a visit, and again at a tap on the
   picture. The Chinese is in the site's script for a reader of 正體中文;
   the name is a name and stays as it is written. */

/** 寻寻, 尋尋 or xunxun as the whole search, in any case, with or without spaces. */
export const isXunxunSearch = (q: string) => /^(寻寻|尋尋|xunxun)$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

type Verse = { stanzas: string[][]; last: string };

const VERSE: Record<'zh' | 'zhHant' | 'en', Verse> = {
    zh: {
        stanzas: [
            ['红墙绿瓦，冬夜深了。', '参宿四悬在檐上，', '一点将熄未熄的红。', '都说它终将成为别的星辰，', '那光，至今未至。'],
            ['御坂美琴有两万个妹妹，', '两个低我一届，自廊下走过，', '衣角带着很轻的电光。', '两万个编号里，没有我。'],
            ['真寻一梦，醒来已是少女。', '我也入梦，', '梦里寻寻觅觅，', '醒来，我与她仍如参商。'],
        ],
        last: '想要成为，但是始终成为不了的“女孩子”',
    },
    zhHant: {
        stanzas: [
            ['紅牆綠瓦，冬夜深了。', '參宿四懸在簷上，', '一點將熄未熄的紅。', '都說它終將成為別的星辰，', '那光，至今未至。'],
            ['御坂美琴有兩萬個妹妹，', '兩個低我一屆，自廊下走過，', '衣角帶著很輕的電光。', '兩萬個編號裡，沒有我。'],
            ['真尋一夢，醒來已是少女。', '我也入夢，', '夢裡尋尋覓覓，', '醒來，我與她仍如參商。'],
        ],
        last: '想要成為，但是始終成為不了的「女孩子」',
    },
    en: {
        stanzas: [
            ['Red walls, green tiles, deep winter night.', 'Betelgeuse hangs over the eaves,', 'a red ember, almost out, not out.', 'They say it will become another star.', 'That light has not arrived.'],
            ['Misaka Mikoto has twenty thousand sisters.', 'Two, a year below me, passed along the corridor', 'with a faint static at their hems.', 'Twenty thousand serial numbers, and none is mine.'],
            ['Mahiro slept once and woke a girl.', 'I dream as well,', 'seeking, seeking,', 'and wake as far from her', 'as Orion from the Scorpion,', 'never in one sky.'],
        ],
        last: 'The “girl” I want to become, and never can.',
    },
};

function Stanzas({ verse, lang }: { verse: Verse; lang: string }) {
    return (
        <span className="block mt-5 first-of-type:mt-0" lang={lang}>
            {verse.stanzas.map(stanza => (
                <span key={stanza[0]} className="block mt-3 text-sm leading-loose text-[var(--text-muted)]">
                    {stanza.map(l => (
                        <span key={l} className="block">{l}</span>
                    ))}
                </span>
            ))}
            <span className="block mt-4 text-sm font-medium leading-relaxed text-[var(--text)]">{verse.last}</span>
        </span>
    );
}

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
            <figcaption className="mt-3">
                <span className="block text-base font-semibold text-[var(--text)]" lang="zh-Hans">寻寻</span>
                {isZh() ? <Stanzas verse={VERSE.zhHant} lang="zh-Hant" /> : <Stanzas verse={VERSE.zh} lang="zh-Hans" />}
                <Stanzas verse={VERSE.en} lang="en" />
            </figcaption>
            {/* Asleep under the cherry tree, in the light of dusk (graded into the file). */}
            <img
                src="/xunxun-dusk.webp"
                alt=""
                width={960}
                height={536}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="block mt-6 w-full h-auto rounded-3xl select-none"
            />
        </figure>
    );
}
