import type { IndexEntry } from './data';
import { isZh } from './i18n';

/* 寻寻, kept as the catalogue keeps a substance. Not in the catalogue's
   files (it isn't counted, listed by kind, mixed or put in the sitemap): a
   search for the name finds it as a row like any other, and the row opens a
   page set out as a substance's is (pages/Xunxun.tsx), with the picture
   where a structure is drawn.

   What the page says is one poem, under the sections a substance has: what
   it is, how long, mixing, how it works. Betelgeuse over red walls and green
   tiles, said to be about to become another star; Misaka Mikoto's twenty
   thousand Sisters, two of them a year below at school and none of them the
   writer; Oyama Mahiro, who slept and woke up a girl. 尋尋覓覓 is Li
   Qingzhao's and holds the name; 參商 is Du Fu's, the two stars that never
   share a sky, and in English they are Orion and the Scorpion, which are the
   same two. The line that says what it is is the user's own.

   One language to a reader, as the rest of the site: 正體中文 for a reader
   of 正體中文, English for a reader of English. The name is 尋尋 in the
   first and 寻寻, as it is written, in the second. */

export const XUNXUN_ID = 'xunxun';

/** Drawn where a structure would be, at any size. */
export const PICTURES: Record<string, string> = { [XUNXUN_ID]: '/xunxun.webp' };

/** 寻寻, 尋尋 or xunxun as the whole search, in any case, with or without spaces. */
export const isXunxunSearch = (q: string) => /^(寻寻|尋尋|xunxun)$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

type Said<T> = { zhHant: T; en: T };

const NAME: Said<string> = { zhHant: '尋尋', en: '寻寻' };

/** The other names, as a substance lists the ones it goes by. */
const ALIASES: Said<string> = { zhHant: '寻寻, xunxun', en: '尋尋, xunxun' };

const WHAT: Said<string> = {
    zhHant: '想要成為，但是始終成為不了的「女孩子」',
    en: 'The “girl” I want to become, and never can.',
};

/** Each stanza under the section of a substance's page it answers; `title` is said through tr(). */
const SECTIONS: ({ title: string } & Said<string[]>)[] = [
    {
        title: 'How long',
        zhHant: ['紅牆綠瓦，冬夜深了。', '參宿四懸在簷上，', '一點將熄未熄的紅。', '都說它終將成為別的星辰，', '那光，至今未至。'],
        en: ['Red walls, green tiles, deep winter night.', 'Betelgeuse hangs over the eaves,', 'a red ember, almost out, not out.', 'They say it will become another star.', 'That light has not arrived.'],
    },
    {
        title: 'Mixing',
        zhHant: ['御坂美琴有兩萬個妹妹，', '兩個低我一屆，自廊下走過，', '衣角帶著很輕的電光。', '兩萬個編號裡，沒有我。'],
        en: ['Misaka Mikoto has twenty thousand sisters.', 'Two, a year below me, passed along the corridor', 'with a faint static at their hems.', 'Twenty thousand serial numbers, and none is mine.'],
    },
    {
        title: 'How it works',
        zhHant: ['真尋一夢，醒來已是少女。', '我也入夢，', '夢裡尋尋覓覓，', '醒來，我與她仍如參商。'],
        en: ['Mahiro slept once and woke a girl.', 'I dream as well,', 'seeking, seeking,', 'and wake as far from her', 'as Orion from the Scorpion,', 'never in one sky.'],
    },
];

const said = <T,>(x: Said<T>): T => (isZh() ? x.zhHant : x.en);

/** The name, what it is and what else it's called, in the reader's language. */
export const xunxunName = () => said(NAME);
export const xunxunWhat = () => said(WHAT);
export const xunxunAliases = () => said(ALIASES);

/** The sections of the page, each with its stanza. */
export const xunxunSections = () => SECTIONS.map(s => ({ title: s.title, lines: said(s) }));

/** The row a search, Saved and "Looked at lately" show for it. */
export function xunxunEntry(): IndexEntry {
    return {
        id: XUNXUN_ID,
        name: NAME.en,
        zh: NAME.zhHant,
        aliases: ALIASES.en,
        category: 'Other',
        form: 'capsule',
        status: '',
        chemicalClass: '',
        primaryBand: null,
        primaryDuration: null,
        richness: 0,
        says: xunxunWhat(),
    };
}
