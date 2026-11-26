import { saysChinese } from '../lib/care';
import PixelCat from './PixelCat';
import { External, Phone } from './icons';

/* What a search for a poison finds: not a warning, a check-in. No box and
   no alarm colours, a cat by it, a few plain sentences, and people to talk
   to. It sits above the results and blocks nothing. In Chinese when the
   search was. */

type Line = { where: string; name: string; number?: string; tel?: string; href?: string };

const LINES: Line[] = [
    { where: '中国大陆 Mainland China', name: '希望24热线', number: '400-161-9995', tel: '4001619995' },
    { where: '中国大陆 Mainland China', name: '北京心理危机研究与干预中心', number: '010-8295 1332', tel: '+861082951332' },
    { where: '香港 Hong Kong', name: '撒瑪利亞防止自殺會 Samaritan Befrienders', number: '2389 2222', tel: '+85223892222' },
    { where: '台灣 Taiwan', name: '安心專線', number: '1925', tel: '1925' },
    { where: 'US & Canada', name: '988 Suicide & Crisis Lifeline', number: 'Call or text 988', tel: '988' },
    { where: 'UK & Ireland', name: 'Samaritans', number: '116 123', tel: '116123' },
    { where: 'Anywhere else 其他地区', name: 'Find A Helpline', number: 'findahelpline.com', href: 'https://findahelpline.com' },
];

const COPY = {
    en: {
        title: 'Hey, are you okay?',
        body: [
            'What you searched for isn’t something people take to feel good, so we wanted to stop and check in with you.',
            'If things are really hard right now, that’s allowed, and it can get lighter than it feels tonight. Talking to someone, a friend or one of the people below, often helps more than it seems like it would. You don’t need the right words to call.',
        ],
        urgent: 'If you’ve already taken something, please call an ambulance now: 120 in mainland China, 112, 911 or 999 elsewhere. Poisoning can often be treated when help comes early.',
        heading: 'People you can talk to, any time',
    },
    zh: {
        title: '你还好吗',
        body: [
            '你搜的这个东西，不是人们为了开心而用的，所以想停下来问问你',
            '如果现在真的很难熬，难受是可以的，它也会比今晚感觉到的更轻一些。找个人说说话，朋友，或者下面这些愿意听你说的人，常常比想象中更有用。打过去不需要想好说什么',
        ],
        urgent: '如果已经吃下了什么，请马上拨打 120。中毒越早处理，越有机会好起来',
        heading: '随时可以找人说说话',
    },
};

export function CareNote({ q }: { q: string }) {
    const t = saysChinese(q) ? COPY.zh : COPY.en;
    return (
        <section className="care-note m-appear mt-6" aria-label={t.title}>
            <div className="flex items-start gap-3">
                <span className="shrink-0 -mt-1" aria-hidden="true">
                    <PixelCat pose="loaf" size={44} />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-[var(--text)]">{t.title}</h2>
                    {t.body.map(p => (
                        <p key={p} className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
                            {p}
                        </p>
                    ))}
                    <p className="mt-3 text-sm leading-relaxed font-medium text-[var(--text)]">{t.urgent}</p>
                </div>
            </div>
            <h3 className="group-heading mt-5 mb-1">{t.heading}</h3>
            <ul className="care-lines">
                {LINES.map(l => (
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
