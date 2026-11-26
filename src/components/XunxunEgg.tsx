import { useEffect, useRef } from 'react';
import { sparkleFrom } from '../lib/eggs';
import { isZh } from '../lib/i18n';

/* What a search for 寻寻 finds: a picture, the name, and three short stanzas
   under the field. Betelgeuse over red walls and green tiles, always about
   to become something else and never yet; Misaka Mikoto's twenty thousand
   Sisters, two of them a year below at school and none of them the writer;
   Oyama Mahiro, who slept and woke up a girl, and the 寻 of that name
   written twice, still looking. The last line is the user's own.
   Hearts the first time it shows on a visit, and again at a tap on the
   picture. The verse is Chinese for every reader, in the site's script for
   a reader of 正體中文; the name is a name and stays as it is written. */

/** 寻寻, 尋尋 or xunxun as the whole search, in any case, with or without spaces. */
export const isXunxunSearch = (q: string) => /^(寻寻|尋尋|xunxun)$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

const VERSE = {
    zh: {
        stanzas: [
            ['红墙绿瓦上面是冬夜，', '冬夜上面是参宿四，红着。', '都说它就要成为别的什么了，', '它始终没有。'],
            ['御坂美琴有两万个妹妹，', '两个在我的下一届，', '没有一个是我。'],
            ['绪山真寻睡了一觉，醒来就是了。', '我把寻字写了两遍，', '还在寻。'],
        ],
        last: '想要成为，但是始终成为不了的“女孩子”',
    },
    zhHant: {
        stanzas: [
            ['紅牆綠瓦上面是冬夜，', '冬夜上面是參宿四，紅著。', '都說它就要成為別的什麼了，', '它始終沒有。'],
            ['御坂美琴有兩萬個妹妹，', '兩個在我的下一屆，', '沒有一個是我。'],
            ['緒山真尋睡了一覺，醒來就是了。', '我把尋字寫了兩遍，', '還在尋。'],
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
                {verse.stanzas.map(stanza => (
                    <span key={stanza[0]} className="block mt-3 text-sm leading-loose text-[var(--text-muted)]">
                        {stanza.map(l => (
                            <span key={l} className="block">{l}</span>
                        ))}
                    </span>
                ))}
                <span className="block mt-4 text-sm font-medium leading-relaxed text-[var(--text)]">{verse.last}</span>
            </figcaption>
        </figure>
    );
}
