import { saysChinese } from '../lib/care';
import PixelCat from './PixelCat';
import { External, Phone } from './icons';
import { isZh } from '../lib/i18n';

/* What a search for a poison finds: not a warning, a check-in. No box and
   no alarm colours, a cat by it, a few soft sentences with a kaomoji or two, and people to
   talk to. It sits above the results and blocks nothing. In Chinese when the
   search was. */

/* Each line, with what to call it where the two Chinese scripts differ
   (`hant`: the name, where, and what the link says, for a reader in
   正體中文). The ones nearest the reader come first. */
type Line = {
    where: string;
    name: string;
    number?: string;
    tel?: string;
    href?: string;
    zhOnly?: boolean;
    hant?: { where?: string; name?: string; number?: string };
};

const LINES: Line[] = [
    { where: 'Twitter / X', name: '@lianyiganyu', number: '去私信', href: 'https://x.com/lianyiganyu', zhOnly: true, hant: { number: '傳私訊' } },
    { where: '中国大陆 Mainland China', name: '希望24热线', number: '400-161-9995', tel: '4001619995', hant: { where: '中國大陸 Mainland China', name: '希望 24 熱線' } },
    {
        where: '中国大陆 Mainland China',
        name: '北京心理危机研究与干预中心',
        number: '010-8295 1332',
        tel: '+861082951332',
        hant: { where: '中國大陸 Mainland China', name: '北京心理危機研究與干預中心' },
    },
    { where: '香港 Hong Kong', name: '撒瑪利亞防止自殺會 Samaritan Befrienders', number: '2389 2222', tel: '+85223892222' },
    { where: '台灣 Taiwan', name: '安心專線', number: '1925', tel: '1925' },
    { where: 'US & Canada', name: '988 Suicide & Crisis Lifeline', number: 'Call or text 988', tel: '988' },
    { where: 'UK & Ireland', name: 'Samaritans', number: '116 123', tel: '116123' },
    {
        where: 'Anywhere else 其他地区',
        name: 'Find A Helpline',
        number: 'findahelpline.com',
        href: 'https://findahelpline.com',
        hant: { where: '其他地區 Anywhere else' },
    },
];

/** In 正體中文, Taiwan's and Hong Kong's lines first, then the rest in order. */
const NEAR_HANT = ['撒瑪利亞防止自殺會 Samaritan Befrienders', '安心專線'];

/** A sentence, and the kaomoji at its end kept whole on one line. */
function Kao({ text }: { text: string }) {
    const i = text.lastIndexOf(' ');
    if (i < 0 || !text.endsWith(')')) return <>{text}</>;
    return (
        <>
            {text.slice(0, i + 1)}
            <span className="whitespace-nowrap">{text.slice(i + 1)}</span>
        </>
    );
}

const COPY = {
    en: {
        title: 'Hey, are you okay? (っ´ω`c)',
        body: [
            'We just wanted to say hi before anything else. If you came here because things feel really heavy right now, we’re so glad you’re still here, and we’re sorry it hurts this much. (´；ω；`)',
            'You don’t need the right words, or to be “bad enough”, to talk to someone. The people below are kind, they listen, and they’re up all night.',
            'Whatever is going on, you matter, and you deserve to feel better than this.',
        ],
        urgent: 'If you’ve already taken something, please call an ambulance right away: 120 in mainland China, 112, 911 or 999 elsewhere. Nobody will be cross with you, and help that comes early really works.',
        heading: 'People who’d love to hear from you, any time',
    },
    zh: {
        title: '你还好吗 (っ´ω`c)',
        body: [
            '很高兴能在这里与你相遇，也许你已经独自走过了很长一段艰难的路，有许多不曾诉说的委屈，也有许多无人知晓的心事，倘若此刻的你感到疲倦，不妨暂且搁下那些沉重的思绪，寻一处安全的地方歇息片刻，或许今夜漫长，但往后的岁月里，还有未曾看过的风景、未曾读完的故事，以及尚未与你相遇的人',
            '愿你在疲惫时有所依靠，在寒冷时有人与你分享温暖，倘若心事太过沉重，下方也有愿意倾听你的人，愿每一位疲倦的旅人，都不必化作星辰，亦能在人间寻得归处，若你已经服用了任何有毒物质，请立即拨打 120，不要等待症状出现，也不要自行催吐，及时救治仍有机会让一切好起来',
        ],
        // In the words above already.
        urgent: '',
        heading: '随时都有人愿意听你说',
    },
    // The same words for a reader of the site in 正體中文, with Taiwan's and Hong Kong's numbers.
    zhHant: {
        title: '你還好嗎 (っ´ω`c)',
        body: [
            '很高興能在這裡與你相遇，也許你已經獨自走過了很長一段艱難的路，有許多不曾訴說的委屈，也有許多無人知曉的心事，倘若此刻的你感到疲倦，不妨暫且擱下那些沉重的思緒，尋一處安全的地方歇息片刻，或許今夜漫長，但往後的歲月裡，還有未曾看過的風景、未曾讀完的故事，以及尚未與你相遇的人',
            '願你在疲憊時有所依靠，在寒冷時有人與你分享溫暖，倘若心事太過沉重，下方也有願意傾聽你的人，願每一位疲倦的旅人，都不必化作星辰，亦能在人間尋得歸處，若你已經服用了任何有毒物質，請立即撥打 119（台灣）、999（香港與澳門）或 120（中國大陸），不要等待症狀出現，也不要自行催吐，及時救治仍有機會讓一切好起來',
        ],
        // In the words above already.
        urgent: '',
        heading: '隨時都有人願意聽你說',
    },
};

export function CareNote({ q }: { q: string }) {
    // In Chinese when the search is, or the site is: the site's own script
    // for its reader, and the search's own for someone who only typed in it.
    const zh = saysChinese(q) || isZh();
    const t = isZh() ? COPY.zhHant : zh ? COPY.zh : COPY.en;
    return (
        <section className="care-note m-appear mt-6" aria-label={t.title}>
            <div className="flex items-start gap-3">
                <span className="shrink-0 -mt-1" aria-hidden="true">
                    <PixelCat pose="loaf" size={44} />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[var(--text)]"><Kao text={t.title} /></h2>
                    {t.body.map(p => (
                        <p key={p} className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
                            <Kao text={p} />
                        </p>
                    ))}
                    {t.urgent && (
                        <p className="mt-3 text-sm leading-relaxed font-medium text-[var(--text)]"><Kao text={t.urgent} /></p>
                    )}
                </div>
            </div>
            <h3 className="group-heading mt-5 mb-1">{t.heading}</h3>
            <ul className="care-lines">
                {LINES.filter(l => zh || !l.zhOnly)
                    .sort((a, b) => (isZh() ? NEAR_HANT.indexOf(b.name) - NEAR_HANT.indexOf(a.name) : 0))
                    .map(l => (
                    <li key={l.name}>
                        <a
                            href={l.href ?? `tel:${l.tel}`}
                            {...(l.href ? { target: '_blank', rel: 'noreferrer' } : {})}
                            className="care-line no-underline"
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-[var(--text)]">{(isZh() && l.hant?.name) || l.name}</span>
                                <span className="block text-xs text-[var(--text-muted)]">{(isZh() && l.hant?.where) || l.where}</span>
                            </span>
                            <span className="care-number">
                                {(isZh() && l.hant?.number) || l.number}
                                {l.href ? <External size={13} /> : <Phone size={14} />}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}
