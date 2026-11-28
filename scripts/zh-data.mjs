// Puts what scripts/fetch-zh.mjs fetched into public/data: each substance's
// name in 正體中文 and in 简体中文, the other names people search for it by
// (in Taiwan's, Hong Kong's and mainland China's writing, so a search in
// either finds it), and the opening of its zh.wikipedia article as
// Wikipedia writes it for each.
//
//   node scripts/zh-data.mjs
//
// index.json entries gain `zh` and `zhHans` (the names) and `zhAliases`; a
// substance's file gains those, `zhOther`/`zhHansOther` (the other names
// its page shows), `summaryZh`/`summaryZhHans` and a link to its
// zh.wikipedia article in each writing.
// Run again after sync-wikidata.mjs, which takes them out.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'public/data');
const SUBS = path.join(DATA, 'substances');
const { byId: qidOf = {}, items, wiki } = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/data/zh-wiki.json'), 'utf8'));
// Taiwan's and the mainland's writing of each name (scripts/fetch-zh-variants.mjs).
let variants = { tw: {}, cn: {} };
try {
    variants = JSON.parse(await fs.readFile(path.join(ROOT, 'scripts/data/zh-variants.json'), 'utf8'));
} catch {
    console.warn('no scripts/data/zh-variants.json: run scripts/fetch-zh-variants.mjs for Taiwan\'s wording');
}
/** A name in Taiwan's writing, in the mainland's, and in both for
 *  searching by, so a search in either writing finds the substance. */
const twForm = n => (n && variants.tw[n]) || n;
const cnForm = n => (n && variants.cn[n]) || n;
const bothForms = n => [n, variants.tw[n], variants.cn[n]].filter(Boolean);

/* What Taiwan actually calls a handful of substances, where Wikipedia's
   converter leaves the mainland's pharmacological name standing (it writes
   氯胺酮 for ketamine in every variant, though Taiwan's own control lists
   and news say 愷他命), or where the botanical or chemical name is not the
   one anybody reading a harm-reduction page is looking for. The name it
   displaces stays searchable, so 氯胺酮 still finds ketamine.

   Each line is a substance's id in public/data/substances. */
const TAIWAN = {
    ketamine: '愷他命',
    methamphetamine: '甲基安非他命',
    amphetamine: '安非他命',
    cannabis: '大麻',
    alcohol: '酒精',
    // "N2O" is the catalogue's name for it; here it is the balloons.
    nitrous: '笑氣',
    nicotine: '尼古丁',
    zolpidem: '佐沛眠',
    methylphenidate: '派醋甲酯',
    buprenorphine: '丁基原啡因',
    water: '水',
    oxygen: '氧氣',
    air: '空氣',
};

/* And what the mainland calls them, where the same holds: Wikidata's label
   is the botanical genus (大麻屬 for cannabis) or the chemical (乙醇 for
   alcohol) rather than the word anybody uses. Its pharmacological names
   (氯胺酮, 甲基苯丙胺, 苯丙胺) are already the ones used there, so they
   are not listed here. */
const MAINLAND = {
    cannabis: '大麻',
    alcohol: '酒精',
    nitrous: '笑气',
    nicotine: '尼古丁',
    water: '水',
    oxygen: '氧气',
    air: '空气',
};

/* The other names, by hand, of an entry Wikidata isn't asked about (one
   written by hand in scripts/sync-substances.mjs): what a search finds it
   by, and what its page names under the one it leads with. */
const HAND_OTHER = {
    oxygen: {
        search: '氧, 醫用氧, 医用氧, 罐裝氧氣, 罐装氧气, 氧氣瓶, 氧气瓶, 製氧機, 制氧机, 吸氧, 氧吧',
        hant: '氧, 醫用氧, 罐裝氧氣',
        hans: '氧, 医用氧, 罐装氧气',
    },
    air: {
        search: '大氣, 大气, 新鮮空氣, 新鲜空气',
        hant: '大氣',
        hans: '大气',
    },
};

const CJK = /[㐀-鿿]/;
const cjkShare = s => [...s].filter(c => CJK.test(c)).length / Math.max(1, [...s].length);
// A title's disambiguation: "鴉片 (藥物)".
const bare = t => t?.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim();

/** A name worth showing: mostly Chinese and short. A systematic name a
 *  line long ("3,4-亞甲二氧基甲基苯丙胺") reads worse than the catalogue's own. */
const showable = n => n && cjkShare(n) >= 0.5 && [...n].length <= 10 && !/[,，]/.test(n);
/** A name worth searching by: has Chinese in it at all. */
const searchable = n => n && CJK.test(n) && [...n].length <= 40;

/** An opening of up to about 160 characters, cut after a full sentence. */
function opening(text) {
    if (!text) return '';
    const para = text.split('\n').map(s => s.trim()).find(s => CJK.test(s)) ?? '';
    const clean = para
        .replace(/[（(][^（()）]*[）)]/g, m => (CJK.test(m) && m.length < 30 ? m : ''))
        .replace(/\s{2,}/g, ' ')
        .trim();
    const sentences = clean.match(/[^。！？]+[。！？]?/g) ?? [clean];
    let out = '';
    for (const s of sentences) {
        if (out && (out + s).length > 160) break;
        out += s;
    }
    return out.trim();
}

const index = JSON.parse(await fs.readFile(path.join(DATA, 'index.json'), 'utf8'));
let named = 0;
let summarised = 0;
for (const e of index) {
    delete e.zh;
    delete e.zhHans;
    delete e.zhAliases;
    const file = path.join(SUBS, `${e.id}.json`);
    let d;
    try {
        d = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        continue;
    }
    delete d.zh;
    delete d.zhHans;
    delete d.summaryZh;
    delete d.summaryZhHans;
    delete d.zhOther;
    delete d.zhHansOther;
    d.helpfulLinks = (d.helpfulLinks ?? []).filter(l => !/zh\.wikipedia\.org/.test(l.url));
    const qid = d.wikidata ?? qidOf[e.id];
    const it = qid && items[qid];
    if (it) {
        const w = it.zhwiki ? wiki[it.zhwiki] : undefined;
        const t = w?.titles ?? {};
        const L = it.labels;
        // Taiwan's name first, then Hong Kong's, then any traditional one,
        // then any Chinese name put into Taiwan's writing by Wikipedia's own
        // converter; and the same for the mainland's.
        const hant = [L['zh-tw'], bare(t['zh-tw']), L['zh-hant'], L['zh-hk'], bare(t['zh-hk']), twForm(L['zh']), twForm(bare(t['zh']))].find(showable);
        const hans = [L['zh-cn'], bare(t['zh-cn']), L['zh-hans'], cnForm(L['zh']), cnForm(bare(t['zh'])), cnForm(hant)].find(showable);
        // An acronym or a code ("LSD", "2C-B", "MDMA") is what people call it here too.
        const keepLatin = /^[A-Z0-9αβγ][A-Za-z0-9αβγ,()\-]{0,9}$/.test(e.name) && /[A-Z0-9]{2}/.test(e.name);
        // A hand-kept name stands whatever the converter said; otherwise the
        // writing's own name, unless the catalogue's is what people say.
        const chosen = TAIWAN[e.id] ?? (keepLatin ? '' : hant);
        const chosenHans = MAINLAND[e.id] ?? (keepLatin ? '' : hans) ?? (TAIWAN[e.id] ? cnForm(TAIWAN[e.id]) : '');
        if (chosen) {
            e.zh = d.zh = chosen;
            named++;
        }
        if (chosenHans) e.zhHans = d.zhHans = chosenHans;
        // Searched by any of its Chinese names, in either writing, so
        // 愷他命 and 氯胺酮 both find ketamine whichever one is being read.
        // The names the hand-kept ones displaced are among them.
        const all = new Set(
            [...Object.values(L), ...Object.values(t).map(bare), ...Object.values(it.aliases).flat(), hant, hans]
                .filter(Boolean)
                .flatMap(bothForms)
                .filter(searchable),
        );
        for (const n of [e.zh, e.zhHans]) if (n) all.delete(n);
        if (all.size) e.zhAliases = [...all].join(', ');
        // The few of those a page is worth naming under the one it leads
        // with: short, in that writing, and not the other writing's form of
        // one already named, so 愷他命's page names 氯胺酮 and K他命.
        const others = (own, otherOwn, form, other) => {
            const shown = [];
            // The other writing's own name is one of these, where it reads
            // in this writing too: Taiwan sees 氯胺酮 on a packet as well.
            for (const n of [otherOwn, ...all]) {
                if (!n) continue;
                if (!showable(n) || form(n) !== n || n === own || shown.some(s => other(s) === n)) continue;
                shown.push(n);
                if (shown.length === 4) break;
            }
            return shown.join(', ');
        };
        /* A hand-kept name is written in its own writing by hand, so it
           doesn't belong on the other's page (愷他命 keeps a character
           简体中文 doesn't use); one the converter gave does. */
        if (e.zh) d.zhOther = others(e.zh, MAINLAND[e.id] ? '' : e.zhHans, twForm, cnForm) || undefined;
        if (e.zhHans) d.zhHansOther = others(e.zhHans, TAIWAN[e.id] ? '' : e.zh, cnForm, twForm) || undefined;
        const summary = opening(w?.['zh-tw']);
        if (summary) {
            d.summaryZh = summary;
            summarised++;
        }
        const summaryHans = opening(w?.['zh-cn']);
        if (summaryHans) d.summaryZhHans = summaryHans;
        if (it.zhwiki) {
            // The same article, served in each writing (Substance.tsx shows
            // a reader the one in theirs).
            const title = encodeURIComponent(it.zhwiki.replace(/ /g, '_'));
            d.helpfulLinks.push(
                { title: '維基百科', description: 'zh:Encyclopedia article', url: `https://zh.wikipedia.org/zh-tw/${title}` },
                { title: '维基百科', description: 'zh:Encyclopedia article', url: `https://zh.wikipedia.org/zh-cn/${title}` },
            );
        }
    } else if (TAIWAN[e.id] || MAINLAND[e.id]) {
        // A hand-kept name stands even where Wikidata knows nothing of it.
        if (TAIWAN[e.id]) {
            e.zh = d.zh = TAIWAN[e.id];
            named++;
        }
        const h = MAINLAND[e.id] ?? (TAIWAN[e.id] && cnForm(TAIWAN[e.id]));
        if (h) e.zhHans = d.zhHans = h;
        const other = HAND_OTHER[e.id];
        if (other) {
            e.zhAliases = other.search;
            d.zhOther = other.hant;
            d.zhHansOther = other.hans;
        }
    }
    await fs.writeFile(file, JSON.stringify(d));
}
await fs.writeFile(path.join(DATA, 'index.json'), JSON.stringify(index));
console.log(
    `${named} names in 正體中文 and ${index.filter(e => e.zhHans).length} in 简体中文, ` +
        `${index.filter(e => e.zhAliases).length} with Chinese names to search by, ${summarised} openings`,
);
