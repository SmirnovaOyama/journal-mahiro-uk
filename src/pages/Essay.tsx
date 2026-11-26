import PageHeader, { PAGE_COLUMN } from '../components/PageHeader';
import { tr } from '../lib/i18n';

/* An essay on using, opened from Settings, About. It is written twice, once
   in each of the site's languages: the 正體中文 (lib/zh-Hant.ts) keeps the
   English paragraph for paragraph, but is its own telling, not a word-for-word
   one. It is in a half-classical register and quotes 莊子, 老子, 駱賓王 and
   龔自珍 in their own words, where the English can only report them.

   A year in four pictures, in the order the year has them: the spring wind
   (why anyone reaches, and what is lent), the cherry blossom (the peak, and
   how often), the cicada (the moment, counting beforehand, the journal,
   company), the autumn leaf (the way back to oneself, stopping, the day
   after, and what the ones who went ahead left behind). The opening and the
   closing have no heading; a short rule sets the closing apart.

   Two pictures the site's owner gave it: the rain one opens the essay, the
   autumn one sits under its season's heading. Both are 1376 by 768. */

const picture = 'block h-auto w-full max-w-prose rounded-2xl';

export function EssayPage() {
    const opening = [
        tr('No hand reaches out for no reason. Some reach from curiosity, some from pain, and most because they are tired: of school, of work, of home, of a mind that will not go quiet. To want the world gentle for one night is nothing to be ashamed of. The wish is as old as we are. Wherever there have been people there has been wine, and smoke, and a leaf somebody chewed.'),
        tr('The world has two ways of speaking about those who use. One says fallen. The other says free. Both are spoken loudly, and neither has ever once looked at you.'),
        tr('Here there is no judging and no praising, only the four seasons. One dose is already a small year: the wind rises, the blossom opens, the cicadas sing, the leaves come down. All that a year holds, a single night holds too.'),
    ];
    const seasons: { heading: string; picture?: { src: string; alt: string }; paragraphs: string[] }[] = [
        {
            heading: tr('Spring wind'),
            paragraphs: [
                tr('A substance comes to a person like a spring wind out of season. Outside the window it is still deep winter, and all at once you are warm.'),
                tr('When that wind first finds someone long tired, a sentence rises in them: so it need not be this heavy. The sentence does not lie, and it matters. It tells you the weight was never a law of nature.'),
                tr('But the warmth is not the substance’s to give. It makes nothing. It only pushes open a window in you, and lends you your own spring ahead of its time. The lender is not the drug. It is you, tomorrow.'),
                tr('So there are two things to keep together. The gentleness was yours all along. And what is borrowed is returned.'),
                tr('And wind has its way: it will not be held. Close your fist, and your palm is empty. Open your hand, and it runs between your fingers. Whoever would keep the spring wind is the first to lose it.'),
            ],
        },
        {
            heading: tr('Cherry blossom'),
            paragraphs: [
                tr('The cherry flowers for a few days in the year, and no one has ever called it a waste. No flower stays red a hundred days. Its beauty is not lessened by its brevity. It is made of it.'),
                tr('Those who go to see the blossom know how to choose: the day, the place, the company. A day when it is raining hard inside you is no day for blossom.'),
                tr('The fault was never in loving the flower. The fault is in asking a tree to bloom every week. The oftener it blooms, the paler the bloom. A forced season leaves the tree no strength for leaves, and in the end none for flowers either: only the forcing remains. By then the hand reaches out not to see the blossom, only to stop the ache.'),
                tr('The days without flowers are not days lost. It is in them that the blossom is made: in sleep, at the table, in an afternoon with the sun on you.'),
                tr('When the petals begin to fall, do not shake the tree. Let the blossom be a blossom. Look, and let it fall.'),
            ],
        },
        {
            heading: tr('Cicada song'),
            paragraphs: [
                tr('Zhuangzi wrote of the cicada that knows neither spring nor autumn. The summer cicada knows only now, and so does anyone inside an effect: no yesterday, no tomorrow, only the brightness in front of them. For one whose yesterday and tomorrow both weigh too much, to have only now is rest. That is its gift, and its danger.'),
                tr('In Chinese the cicada’s name sounds like “I know”, and it cries it all summer. It does not know. Whoever has only now cannot count: how much has gone in, how long ago, whether there is room for more. The self of that hour has no answer. So the counting is done before summer comes, and the deciding is left to the sober self.'),
                tr('And someone must remember autumn on the cicada’s behalf. To write down what was taken, how much, and at what hour, is the sober self keeping watch over the self who has only now.'),
                tr('A cicada waits long years in the earth for one summer. It is no wonder that those who stayed longest in the dark sing loudest when they rise.'),
                tr('But no cicada sings alone; the whole tree is the sound of the others. Do not sing alone. An old poem says that in a high wind a voice is easily drowned. So when you hear that someone has suddenly gone quiet, go and look.'),
            ],
        },
        {
            heading: tr('Autumn leaves'),
            picture: {
                src: '/essay-autumn.jpg',
                alt: tr('A girl rests with her eyes closed on a bench under autumn maples, a fallen leaf in each hand.'),
            },
            paragraphs: [
                tr('When the effect fades, it is a leaf going home to the root. This is not punishment. It is the tree weighing, honestly, how much it can bear. A tree lets go of its leaves not because it is dying, but to come through the winter.'),
                tr('Laozi wrote: the ten thousand things flourish, and each returns to its root; to return to the root is called stillness. After the flourishing you come back to yourself, to this body that is still breathing. That stretch of the road is not called falling. It is called going home.'),
                tr('Letting go is a skill the tree has earned. To know how to stop is harder than to know how to begin, and it matters more. The old books call it knowing when to stop: who knows it meets no danger, and can long endure.'),
                tr('The grey of the day after is weather. It is not a verdict on you. On that day pass no judgment on your life, and decide nothing large. Drink water, eat, sleep, find someone to talk to.'),
                tr('The darkest thought of that day is mostly the sound of leaves coming down, not your own voice. It comes suddenly, and as suddenly it goes. Wait for it to pass, and do not wait alone.'),
                tr('And nothing that falls is wasted. Gong Zizhen wrote that fallen petals are not heartless things: they turn to spring soil, and shelter the flowers. So do leaves. The notes left by those who went ahead, the doses they got wrong, the words they did not finish: we gather them up, one by one, and lay them down as ground for whoever comes after.'),
                tr('Your own worst night is the same. Write it down, and it is no longer only a wound. It is also a map.'),
            ],
        },
    ];
    const closing = [
        tr('Using is not a sin, and it is not a cure. It is weather, and you are the tree.'),
        tr('Wind can sway a tree and loosen it. It cannot grow its roots. The roots are elsewhere: a night of good sleep, a hot meal, a few people who know your name, one thing you still want to do tomorrow.'),
        tr('Less, further apart, with someone beside you. These rules are not there to spoil anything. They are there so that when the next wind comes, you are still standing here.'),
        tr('Some of us have already become wind. They are in every spring wind since.'),
        tr('May we all last long. When the spring wind rises again, may you still be here.'),
    ];

    return (
        <div className="relative md:pb-32">
            <PageHeader backTo title={tr('A Borrowed Spring')} />
            <article className={`${PAGE_COLUMN} mt-3 pb-12 space-y-8 text-base leading-7 text-[var(--text)]`}>
                <img
                    src="/essay-rain.jpg"
                    alt={tr('A girl crouches under an umbrella in the rain and reaches for a small yellow flower growing from a stone wall, a calico cat beside her.')}
                    width={1376}
                    height={768}
                    className={picture}
                />
                <section className="max-w-prose space-y-3">
                    {opening.map((p, i) => (
                        <p key={i}>{p}</p>
                    ))}
                </section>
                {seasons.map(s => (
                    <section key={s.heading} className="max-w-prose space-y-3">
                        <h2 className="font-semibold">{s.heading}</h2>
                        {s.picture && (
                            <img src={s.picture.src} alt={s.picture.alt} width={1376} height={768} loading="lazy" className={picture} />
                        )}
                        {s.paragraphs.map((p, i) => (
                            <p key={i}>{p}</p>
                        ))}
                    </section>
                ))}
                <div aria-hidden="true" className="w-10 border-t-(length:--hairline) border-[var(--border)]" />
                <section className="max-w-prose space-y-3">
                    {closing.map((p, i) => (
                        <p key={i}>{p}</p>
                    ))}
                </section>
            </article>
        </div>
    );
}
