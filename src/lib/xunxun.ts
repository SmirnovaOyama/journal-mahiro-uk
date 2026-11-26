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
   writer; Oyama Mahiro, who slept and woke up a girl. 寻寻觅觅 is Li
   Qingzhao's and holds the name; 参商 is Du Fu's, the two stars that never
   share a sky, and in English they are Orion and the Scorpion, which are the
   same two. The line that says what it is is the user's own.

   The Chinese is in the site's script for a reader of 正體中文, and the
   English is under it for every reader. The name is a name and stays as it
   is written. */

export const XUNXUN_ID = 'xunxun';
export const XUNXUN_NAME = '寻寻';

/** Drawn where a structure would be, at any size. */
export const PICTURES: Record<string, string> = { [XUNXUN_ID]: '/xunxun.webp' };

/** 寻寻, 尋尋 or xunxun as the whole search, in any case, with or without spaces. */
export const isXunxunSearch = (q: string) => /^(寻寻|尋尋|xunxun)$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

type Said = { zh: string; zhHant: string; en: string };
type Verse = { zh: string[]; zhHant: string[]; en: string[] };

const WHAT: Said = {
    zh: '想要成为，但是始终成为不了的“女孩子”',
    zhHant: '想要成為，但是始終成為不了的「女孩子」',
    en: 'The “girl” I want to become, and never can.',
};

/** Each stanza under the section of a substance's page it answers; `title` is said through tr(). */
const SECTIONS: ({ title: string } & Verse)[] = [
    {
        title: 'How long',
        zh: ['红墙绿瓦，冬夜深了。', '参宿四悬在檐上，', '一点将熄未熄的红。', '都说它终将成为别的星辰，', '那光，至今未至。'],
        zhHant: ['紅牆綠瓦，冬夜深了。', '參宿四懸在簷上，', '一點將熄未熄的紅。', '都說它終將成為別的星辰，', '那光，至今未至。'],
        en: ['Red walls, green tiles, deep winter night.', 'Betelgeuse hangs over the eaves,', 'a red ember, almost out, not out.', 'They say it will become another star.', 'That light has not arrived.'],
    },
    {
        title: 'Mixing',
        zh: ['御坂美琴有两万个妹妹，', '两个低我一届，自廊下走过，', '衣角带着很轻的电光。', '两万个编号里，没有我。'],
        zhHant: ['御坂美琴有兩萬個妹妹，', '兩個低我一屆，自廊下走過，', '衣角帶著很輕的電光。', '兩萬個編號裡，沒有我。'],
        en: ['Misaka Mikoto has twenty thousand sisters.', 'Two, a year below me, passed along the corridor', 'with a faint static at their hems.', 'Twenty thousand serial numbers, and none is mine.'],
    },
    {
        title: 'How it works',
        zh: ['真寻一梦，醒来已是少女。', '我也入梦，', '梦里寻寻觅觅，', '醒来，我与她仍如参商。'],
        zhHant: ['真尋一夢，醒來已是少女。', '我也入夢，', '夢裡尋尋覓覓，', '醒來，我與她仍如參商。'],
        en: ['Mahiro slept once and woke a girl.', 'I dream as well,', 'seeking, seeking,', 'and wake as far from her', 'as Orion from the Scorpion,', 'never in one sky.'],
    },
];

const script = () => (isZh() ? 'zhHant' : 'zh');

/** The tag the Chinese is written in. */
export const xunxunLang = () => (isZh() ? 'zh-Hant' : 'zh-Hans');

/** What it is, in Chinese and in English. */
export const xunxunWhat = () => ({ zh: WHAT[script()], en: WHAT.en });

/** The sections of the page, each with its stanza in Chinese and in English. */
export const xunxunSections = () => SECTIONS.map(s => ({ title: s.title, zh: s[script()], en: s.en }));

/** The other names, as a substance lists the ones it goes by. */
export const XUNXUN_ALIASES = '尋尋, xunxun';

/** The row a search, Saved and "Looked at lately" show for it. */
export function xunxunEntry(): IndexEntry {
    return {
        id: XUNXUN_ID,
        name: XUNXUN_NAME,
        aliases: XUNXUN_ALIASES,
        category: 'Other',
        form: 'capsule',
        status: '',
        chemicalClass: '',
        primaryBand: null,
        primaryDuration: null,
        richness: 0,
        says: WHAT[script()],
    };
}
