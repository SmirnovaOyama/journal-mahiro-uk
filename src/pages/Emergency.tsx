import { useEffect } from 'react';
import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { rowBleed, settingsSection } from '../components/SettingsListItem';
import { External } from '../components/icons';
import { Link } from '../components/Link';
import { CareLines } from '../components/CareNote';
import { currentLang, isZh, tr, type Lang } from '../lib/i18n';

/* What to do when it goes wrong, until help comes: when to call, the number
   to call, what to do meanwhile, the signs by kind of drug, and what to
   do when someone may harm themselves. Reached
   from a session that's running, a mix's answer, Search and Settings, and
   it opens without a connection like the rest of the page (public/sw.js).

   Nothing here is the site's own advice. Each line puts into plain words
   what one of the sources at the foot of the page says, and a line no
   source there carries doesn't belong: check it against them before
   adding or changing one. They were last read on 2026-11-27. */

/* The number that reaches an ambulance, by place (Wikipedia's list of
   emergency telephone numbers). */
type Place = 'cn' | 'hk' | 'tw' | 'jp' | 'sg' | 'my' | 'eu' | 'uk' | 'us' | 'au' | 'nz';

/** The order they're listed in: the reader's language says which they're
 *  likeliest to need. */
const ORDER: Record<Lang, Place[]> = {
    en: ['eu', 'uk', 'us', 'au', 'nz', 'cn', 'hk', 'tw', 'jp', 'sg', 'my'],
    'zh-Hans': ['cn', 'hk', 'tw', 'sg', 'my', 'jp', 'eu', 'uk', 'us', 'au', 'nz'],
    'zh-Hant': ['tw', 'hk', 'cn', 'sg', 'my', 'jp', 'eu', 'uk', 'us', 'au', 'nz'],
};

/* And the device's clock says where it is, more surely than the language
   does: that place's number goes first. Read on the device and sent
   nowhere. Only zones that are one of the places listed, whole. */
const ZONE: Record<string, Place> = {
    'Asia/Shanghai': 'cn',
    'Asia/Chongqing': 'cn',
    'Asia/Harbin': 'cn',
    'Asia/Urumqi': 'cn',
    'Asia/Hong_Kong': 'hk',
    'Asia/Macau': 'hk',
    'Asia/Taipei': 'tw',
    'Asia/Tokyo': 'jp',
    'Asia/Seoul': 'jp',
    'Asia/Singapore': 'sg',
    'Asia/Kuala_Lumpur': 'my',
    'Asia/Kuching': 'my',
    'Europe/London': 'uk',
    'Pacific/Auckland': 'nz',
    'Pacific/Honolulu': 'us',
    'Asia/Nicosia': 'eu',
};
const EU_CITIES = new Set(
    'Amsterdam Athens Berlin Bratislava Brussels Bucharest Budapest Copenhagen Dublin Helsinki Lisbon Ljubljana Luxembourg Madrid Malta Paris Prague Riga Rome Sofia Stockholm Tallinn Vienna Vilnius Warsaw Zagreb'.split(
        ' ',
    ),
);
const US_CA_CITIES = new Set(
    'New_York Chicago Denver Los_Angeles Phoenix Anchorage Detroit Boise Juneau Toronto Vancouver Edmonton Winnipeg Halifax St_Johns Regina Moncton'.split(' '),
);

function placeHere(): Place | undefined {
    let zone = '';
    try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
        return undefined;
    }
    if (ZONE[zone]) return ZONE[zone];
    const [area, city] = zone.split('/');
    if (area === 'Australia') return 'au';
    if (area === 'Europe' && EU_CITIES.has(city)) return 'eu';
    if (area === 'America' && US_CA_CITIES.has(city)) return 'us';
    return undefined;
}

const SOURCES: { name: string; title: string; href: string }[] = [
    { name: 'FRANK', title: 'What to do in an emergency', href: 'https://www.talktofrank.com/get-help/what-to-do-in-an-emergency' },
    { name: 'World Health Organization', title: 'Opioid overdose', href: 'https://www.who.int/news-room/fact-sheets/detail/opioid-overdose' },
    { name: 'St John Ambulance', title: 'The recovery position', href: 'https://www.sja.org.uk/first-aid-advice/recovery-position/' },
    { name: 'St John Ambulance', title: 'CPR', href: 'https://www.sja.org.uk/first-aid-advice/cpr/' },
    { name: 'NHS', title: 'What to do if someone has a seizure (fit)', href: 'https://www.nhs.uk/conditions/what-to-do-if-someone-has-a-seizure-fit/' },
    { name: 'NHS', title: 'Heat exhaustion and heatstroke', href: 'https://www.nhs.uk/conditions/heat-exhaustion-heatstroke/' },
    { name: 'PsychonautWiki', title: 'Serotonin syndrome', href: 'https://psychonautwiki.org/wiki/Serotonin_syndrome' },
    { name: '988 Lifeline', title: 'Help someone else', href: 'https://988lifeline.org/help-someone-else/' },
    {
        name: 'Samaritans',
        title: 'Supporting someone with suicidal thoughts',
        href: 'https://www.samaritans.org/how-we-can-help/if-youre-worried-about-someone-else/supporting-someone-suicidal-thoughts/',
    },
    { name: 'NHS', title: 'Help for suicidal thoughts', href: 'https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/behaviours/help-for-suicidal-thoughts/' },
    {
        name: 'NHS',
        title: 'Self-harm: how to help someone else',
        href: 'https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/behaviours/self-harm/how-to-help-someone-else/',
    },
    { name: 'World Health Organization', title: 'Suicide', href: 'https://www.who.int/news-room/fact-sheets/detail/suicide' },
    { name: 'Wikipedia', title: 'List of emergency telephone numbers', href: 'https://en.wikipedia.org/wiki/List_of_emergency_telephone_numbers' },
];

const muted = 'text-[var(--text-muted)]';
const h2 = 'text-lg font-semibold text-[var(--text)]';
const h3 = 'text-base font-semibold text-[var(--text)]';
const bullets = 'list-disc ps-5 space-y-1.5';
const steps = 'list-decimal ps-5 space-y-1.5';

/** One kind of trouble: what it is, who it happens to, and what to do. */
function Kind({ title, who, lines }: { title: string; who?: string; lines: string[] }) {
    return (
        <div>
            <h3 className={h3}>{title}</h3>
            {who && <p className={`text-sm ${muted} mt-0.5`}>{who}</p>}
            <ul className={`${bullets} mt-2`}>
                {lines.map(l => (
                    <li key={l}>{l}</li>
                ))}
            </ul>
        </div>
    );
}

export function Emergency() {
    useEffect(() => {
        document.title = tr('In an emergency');
    }, []);

    const places: Record<Place, { place: string; number: string }> = {
        cn: { place: tr('Mainland China'), number: '120' },
        hk: { place: tr('Hong Kong and Macau'), number: '999' },
        tw: { place: tr('Taiwan'), number: '119' },
        jp: { place: tr('Japan and South Korea'), number: '119' },
        sg: { place: tr('Singapore'), number: '995' },
        my: { place: tr('Malaysia'), number: '999' },
        eu: { place: tr('European Union'), number: '112' },
        uk: { place: tr('United Kingdom'), number: '999' },
        us: { place: tr('United States and Canada'), number: '911' },
        au: { place: tr('Australia'), number: '000' },
        nz: { place: tr('New Zealand'), number: '111' },
    };
    const here = placeHere();
    const order = here ? [here, ...ORDER[currentLang()].filter(p => p !== here)] : ORDER[currentLang()];

    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={tr('In an emergency')} />
            <article className={`${PAGE_COLUMN} mt-3 pb-12 space-y-9 text-base leading-7 text-[var(--text)]`}>
                <section>
                    <p className="font-semibold text-[var(--danger)]">{tr('Call an ambulance now if someone:')}</p>
                    <ul className={`${bullets} mt-2`}>
                        <li>{tr('can’t be woken')}</li>
                        <li>{tr('is struggling to breathe, breathing very slowly, or not breathing')}</li>
                        <li>{tr('has blue or grey lips or fingertips')}</li>
                        <li>{tr('is having a seizure')}</li>
                        <li>{tr('is very hot and confused, or hot with dry skin')}</li>
                        <li>{tr('has hurt themselves badly or taken an overdose on purpose, or is about to')}</li>
                    </ul>
                    <p className="mt-3">{tr('Don’t wait to see whether it passes. Say what was taken: the crew is there to treat, and what you tell them decides how.')}</p>
                </section>

                <section aria-labelledby="emergency-numbers">
                    <h2 id="emergency-numbers" className={h2}>
                        {tr('The number to call')}
                    </h2>
                    <div className={`${settingsSection} mt-1`}>
                        {order.map(p => (
                            <a
                                key={p}
                                href={`tel:${places[p].number}`}
                                className={`w-full min-h-12 flex items-center justify-between gap-4 py-2.5 no-underline ${rowBleed}`}
                            >
                                <span className="min-w-0 text-[var(--text)]">{places[p].place}</span>
                                <span className="shrink-0 text-lg font-semibold tabular-nums text-[var(--accent-ink)]">{places[p].number}</span>
                            </a>
                        ))}
                    </div>
                    <p className="footnote">{tr('Somewhere else, try 112: many mobile networks pass it on to the local emergency line.')}</p>
                </section>

                <section>
                    <h2 className={h2}>{tr('Until help comes')}</h2>
                    <ul className={`${bullets} mt-2`}>
                        <li>{tr('Stay with them. Don’t leave them alone, even for a moment.')}</li>
                        <li>{tr('If they’re awake, keep them calm and sitting up, and keep talking to them. Don’t shout at them or shake them.')}</li>
                        <li>{tr('If they can’t be woken but are breathing, lay them on their side, as below.')}</li>
                        <li>
                            {tr('If they aren’t breathing, say so on the call and start pressing on their chest: the heel of one hand on the middle of the chest, the other hand on top, arms straight, 5 to 6 cm down, about twice a second. Keep going until help takes over. The person on the line will talk you through it.')}
                        </li>
                        <li>
                            {tr('Tell the crew what was taken, how much and when, and hand over whatever is left. If it’s in your journal, show them the session.')}{' '}
                            <Link to={{ page: 'journal' }} className="underline underline-offset-[3px]">
                                {tr('Open the journal')}
                            </Link>
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 className={h2}>{tr('On their side')}</h2>
                    <p className={`text-sm ${muted} mt-0.5`}>{tr('The recovery position, for someone who can’t be woken but is breathing normally.')}</p>
                    <ol className={`${steps} mt-2`}>
                        <li>{tr('Kneel beside them and straighten their legs. Take off their glasses.')}</li>
                        <li>{tr('Lay the arm nearest you out at a right angle to their body, elbow bent, palm up.')}</li>
                        <li>{tr('Bring their other arm across the chest and hold the back of that hand against the cheek nearest you.')}</li>
                        <li>{tr('With your other hand, pull the far knee up until the foot is flat on the floor.')}</li>
                        <li>{tr('Keeping their hand against the cheek, pull on the knee to roll them towards you, onto their side. Leave the top leg bent at a right angle.')}</li>
                        <li>{tr('Tilt the head back gently and lift the chin, so the airway stays open.')}</li>
                        <li>{tr('Keep watching their breathing. After 30 minutes, roll them onto their other side.')}</li>
                    </ol>
                </section>

                <section>
                    <h2 className={h2}>{tr('What not to do')}</h2>
                    <ul className={`${bullets} mt-2`}>
                        <li>{tr('Don’t make them vomit.')}</li>
                        <li>{tr('Don’t give them coffee, or more alcohol.')}</li>
                        <li>{tr('Don’t put them in a cold bath: it wastes time, and they could drown.')}</li>
                        <li>{tr('Don’t give food or drink to someone who has had a seizure until they have fully come round.')}</li>
                        <li>{tr('Don’t leave them to sleep it off alone.')}</li>
                    </ul>
                </section>

                <section className="space-y-6">
                    <h2 className={h2}>{tr('By what was taken')}</h2>
                    <Kind
                        title={tr('Opioids and other depressants')}
                        who={tr('Heroin, fentanyl, oxycodone, tramadol, and with them benzodiazepines, GHB, alcohol and pregabalin.')}
                        lines={[
                            tr('Signs: breathing very slow or stopped, blue or grey lips or fingertips, pinpoint pupils, can’t be woken.'),
                            tr('Call, and start pressing on the chest if they aren’t breathing.'),
                            tr('If you have naloxone, use it now and tell the crew. It reverses opioids, and does almost nothing to someone who hasn’t taken any.'),
                            tr('Naloxone works only for a short time. Stay with them: they may need it again.'),
                        ]}
                    />
                    <Kind
                        title={tr('Stimulants')}
                        who={tr('MDMA, amphetamine, methamphetamine, cocaine, cathinones.')}
                        lines={[
                            tr('Signs: very hot, a fast heartbeat and fast breathing, confused or restless.'),
                            tr('Move them somewhere cool, take off extra clothing, fan them, and sponge them with cool water or lay a cool cloth on them.'),
                            tr('Small sips of water, slowly.'),
                            tr('Call if they don’t cool down, and at once if their skin is hot and dry, they are confused, they have a seizure or they pass out.'),
                        ]}
                    />
                    <Kind
                        title={tr('Serotonin syndrome')}
                        who={tr('From drugs that raise serotonin, taken together: MDMA and other stimulants, antidepressants (MAOIs and SSRIs among them), tramadol, DXM.')}
                        lines={[
                            tr('Signs: agitation, confusion, shivering, twitching or tremors, heavy sweating, a high temperature, a fast heartbeat, diarrhoea. It usually comes on fast, often within minutes.'),
                            tr('It is a medical emergency: call. If they are very hot, cool them as for stimulants while you wait.'),
                        ]}
                    />
                    <Kind
                        title={tr('A seizure')}
                        lines={[
                            tr('Move things away from them. Move them only if they are in danger where they are.'),
                            tr('Cushion their head, and loosen anything tight around the neck.'),
                            tr('Put nothing in their mouth, not even your fingers.'),
                            tr('Note the time it starts and the time it stops.'),
                            tr('When the jerking stops, turn them onto their side, stay, and talk to them calmly.'),
                            tr('After a drug, call for any seizure. Call in any case if it lasts more than 5 minutes, if another follows, or if they don’t come round.'),
                        ]}
                    />
                    <Kind
                        title={tr('A frightening trip')}
                        who={tr('Psychedelics, cannabis, dissociatives: panic or hallucinations, with none of the signs at the top of this page.')}
                        lines={[
                            tr('Take them somewhere quiet and calm, away from bright lights and loud noise.'),
                            tr('Speak softly, breathe slowly and deeply with them, and stay.'),
                            tr('If any of the signs at the top of this page appear, call.'),
                        ]}
                    />
                </section>

                <section>
                    <h2 className={h2}>{tr('If someone may harm themselves')}</h2>
                    <ul className={`${bullets} mt-2`}>
                        <li>{tr('If they have hurt themselves badly or taken an overdose, or are about to, call an ambulance now.')}</li>
                        <li>{tr('Ask them plainly whether they are thinking of suicide. Asking can protect them: it lets them say how they feel.')}</li>
                        <li>{tr('Listen more than you speak. Don’t judge, don’t argue, and don’t call it attention-seeking.')}</li>
                        <li>{tr('Stay with them.')}</li>
                        <li>{tr('Move what they could use out of reach, pills first. Many attempts are made on impulse, in a moment of crisis.')}</li>
                        <li>{tr('Keep alcohol and other drugs away from them.')}</li>
                        <li>{tr('Don’t promise to keep it secret. Bring in someone they trust, or one of the lines below.')}</li>
                    </ul>
                    <h3 className="group-heading mt-5 mb-1">{tr('People to talk to')}</h3>
                    <CareLines zh={isZh()} hant={currentLang() === 'zh-Hant'} />
                    <p className="mt-3">{tr('If the one in danger is you, these lines are for you too. You don’t need the right words to call.')}</p>
                </section>

                <section aria-labelledby="emergency-sources">
                    <h2 id="emergency-sources" className="group-heading">
                        {tr('Where this comes from')}
                    </h2>
                    <p className={`text-sm ${muted} mt-1`}>
                        {tr('This page puts into plain words what the pages below say. It is not medical advice, and whatever the person on the emergency line tells you comes first.')}
                    </p>
                    <div className={`${settingsSection} mt-2`}>
                        {SOURCES.map(s => (
                            <a
                                key={s.href}
                                href={s.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`w-full min-h-14 flex items-center justify-between gap-4 py-3 text-start no-underline ${rowBleed}`}
                            >
                                <span className="min-w-0" lang="en">
                                    <span className="block text-sm text-[var(--text)]">{s.title}</span>
                                    <span className={`mt-0.5 block text-xs ${muted}`}>{s.name}</span>
                                </span>
                                <External size={18} className={`shrink-0 ${muted} opacity-70`} />
                            </a>
                        ))}
                    </div>
                </section>
            </article>
        </div>
    );
}
