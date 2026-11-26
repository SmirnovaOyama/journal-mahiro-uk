import { saysChinese } from '../lib/care';
import PixelCat from './PixelCat';
import { External, Phone } from './icons';
import { isZh } from '../lib/i18n';

/* What a search for a poison finds: not a warning, a check-in. No box and
   no alarm colours, a cat by it, a few soft sentences with a kaomoji or two, and people to
   talk to. It sits above the results and blocks nothing. In Chinese when the
   search was. */

type Line = { where: string; name: string; number?: string; tel?: string; href?: string; zhOnly?: boolean };

const LINES: Line[] = [
    { where: 'Twitter / X', name: '@lianyiganyu', number: '去私信', href: 'https://x.com/lianyiganyu', zhOnly: true },
    { where: '中国大陆 Mainland China', name: '希望24热线', number: '400-161-9995', tel: '4001619995' },
    { where: '中国大陆 Mainland China', name: '北京心理危机研究与干预中心', number: '010-8295 1332', tel: '+861082951332' },
    { where: '香港 Hong Kong', name: '撒瑪利亞防止自殺會 Samaritan Befrienders', number: '2389 2222', tel: '+85223892222' },
    { where: '台灣 Taiwan', name: '安心專線', number: '1925', tel: '1925' },
    { where: 'US & Canada', name: '988 Suicide & Crisis Lifeline', number: 'Call or text 988', tel: '988' },
    { where: 'UK & Ireland', name: 'Samaritans', number: '116 123', tel: '116123' },
    { where: 'Anywhere else 其他地区', name: 'Find A Helpline', number: 'findahelpline.com', href: 'https://findahelpline.com' },
];

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
            '想先跟你打个招呼。如果你是因为心里很沉、很累才来到这里，真的很高兴你还在，也很心疼你这么难受 (´；ω；`)',
            '找人说说话不需要想好怎么说，也不需要“难受到一定程度”才可以。下面这些人都很温柔，会认真听你说，整晚都在',
            '不管发生了什么，你都很重要，你值得比现在好受一些',
        ],
        urgent: '如果已经吃下了什么，请马上拨打 120。没有人会怪你，越早处理越有机会好起来',
        heading: '随时都有人愿意听你说',
    },
    // The same words for a reader of the site in 正體中文, with Taiwan's and Hong Kong's numbers.
    zhHant: {
        title: '你還好嗎 (っ´ω`c)',
        body: [
            '想先跟你打個招呼。如果你是因為心裡很沉、很累才來到這裡，真的很高興你還在，也很心疼你這麼難受 (´；ω；`)',
            '找人說說話不需要想好怎麼說，也不需要「難受到一定程度」才可以。下面這些人都很溫柔，會認真聽你說，整晚都在',
            '不管發生了什麼，你都很重要，你值得比現在好受一些',
        ],
        urgent: '如果已經吃下了什麼，請馬上叫救護車：台灣 119、香港與澳門 999、中國大陸 120。沒有人會怪你，越早處理越有機會好起來',
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
                    <p className="mt-3 text-sm leading-relaxed font-medium text-[var(--text)]"><Kao text={t.urgent} /></p>
                </div>
            </div>
            <h3 className="group-heading mt-5 mb-1">{t.heading}</h3>
            <ul className="care-lines">
                {LINES.filter(l => zh || !l.zhOnly).map(l => (
                    <li key={l.name}>
                        <a
                            href={l.href ?? `tel:${l.tel}`}
                            {...(l.href ? { target: '_blank', rel: 'noreferrer' } : {})}
                            className="care-line no-underline"
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-[var(--text)]">{l.name}</span>
                                <span className="block text-xs text-[var(--text-muted)]">{l.where}</span>
                            </span>
                            <span className="care-number">
                                {l.number}
                                {l.href ? <External size={13} /> : <Phone size={14} />}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}
