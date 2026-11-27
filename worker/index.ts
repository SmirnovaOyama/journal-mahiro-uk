/* The site's Worker. Files (scripts, data, pictures) are served straight
   from the build; this only runs for the pages and for accounts under /api/
   (wrangler.jsonc, run_worker_first). The accounts are in worker/api.ts.
   For the pages, a link shared to a chat app or found by a search engine
   says what that page is: its title, the line under it and its card.
   Link previewers don't run the app's JavaScript, so this is the only way
   they can learn that /s/lsd is about LSD.

   It reads the same data the app does, from the build, and words it with
   the same helpers (src/lib/preview.ts). */

import { categoryInfo, nameOf, type ComboMatrix, type Detail, type IndexEntry } from '../src/lib/data';
import { speak, tr, type Lang } from '../src/lib/i18n';
import zhWords from '../src/lib/zh-Hant';
import zhData, { terms as zhTerms } from '../src/lib/zh-Hant-data';
import hansWords from '../src/lib/zh-Hans';
import hansData, { terms as hansTerms } from '../src/lib/zh-Hans-data';
import { checkPair, worst, type PairResult } from '../src/lib/mix';
import { SITE, essayPreview, kindPreview, mixPreview, pagePreview, sitePreview, substancePreview, type Preview } from '../src/lib/preview';
import { parse } from '../src/lib/routes';
import { XUNXUN_ID } from '../src/lib/xunxun';
import { handleApi, type ApiEnv } from './api';

interface Env extends ApiEnv {
    ASSETS: { fetch(input: Request | string): Promise<Response> };
}

/* HTMLRewriter is the Workers runtime's own; declared here so this file
   type-checks without pulling in all of @cloudflare/workers-types. */
declare class HTMLRewriter {
    on(
        selector: string,
        handlers: { element?(el: { setAttribute(n: string, v: string): void; setInnerContent(c: string): void }): void },
    ): HTMLRewriter;
    transform(res: Response): Response;
}

async function json<T>(env: Env, origin: string, path: string): Promise<T | undefined> {
    const res = await env.ASSETS.fetch(new Request(origin + path));
    if (!res.ok) return undefined;
    try {
        return (await res.json()) as T;
    } catch {
        return undefined;
    }
}

interface Page extends Preview {
    path: string;
    found: boolean;
    /** A page about what's on someone's own device: nothing for a search engine. */
    privatePage?: boolean;
    /** The line under the card when the link is shared, where it isn't the
     *  description a search engine is given. */
    shareDescription?: string;
}

/** The language a link previewer or a search engine asked for. Taiwan, Hong
 *  Kong and Macau read 正體中文, the mainland and Singapore 简体中文, and
 *  Chinese that says nothing of where gets 简体中文, as on the device. The
 *  app itself settles this again there (src/lib/lang.ts). */
function langOf(request: Request): Lang {
    const header = request.headers.get('accept-language') ?? '';
    for (const part of header.split(',')) {
        const tag = part.split(';')[0].trim();
        if (/^zh\b/i.test(tag)) return /\b(Hant|TW|HK|MO)\b/i.test(tag) ? 'zh-Hant' : 'zh-Hans';
        if (/^en\b/i.test(tag)) return 'en';
    }
    return 'en';
}

/** The tag the page is served with, which picks its typeface (index.css). */
const pageTag = (lang: Lang, request: Request) =>
    lang === 'en'
        ? 'en'
        : lang === 'zh-Hans'
          ? 'zh-Hans'
          : /\bzh[\w-]*-(HK|MO)\b/i.test(request.headers.get('accept-language') ?? '')
            ? 'zh-Hant-HK'
            : 'zh-Hant';

/** Every line this Worker words is settled here, with nothing awaited
 *  after it: one request's language can't reach another's. */
function speakFor(lang: Lang) {
    if (lang === 'en') return speak(lang, null, null, null);
    if (lang === 'zh-Hans') return speak(lang, hansWords, hansData, hansTerms);
    speak(lang, zhWords, zhData, zhTerms);
}

async function pageFor(env: Env, url: URL, lang: Lang): Promise<Page> {
    const origin = url.origin;
    const route = parse(url.pathname);
    const index = (await json<IndexEntry[]>(env, origin, '/data/index.json')) ?? [];
    const byId = new Map(index.map(e => [e.id, e]));
    speakFor(lang);
    const site = sitePreview(index.length || undefined);

    switch (route.page) {
        case 'substance': {
            // 寻寻's page is the app's own, with no file behind it: there, and kept out of search engines.
            if (route.id === XUNXUN_ID) return { ...site, path: url.pathname, found: true, privatePage: true };
            const detail = await json<Detail>(env, origin, `/data/substances/${encodeURIComponent(route.id)}.json`);
            if (!detail) return { ...site, path: url.pathname, found: false };
            speakFor(lang);
            return { ...substancePreview(detail, byId.get(detail.id), index), path: `/s/${detail.id}`, found: true };
        }
        case 'report': {
            // The report's own telling in that language, where there is one.
            type Shared = { id: string; title: string; summary: string; closing?: string[][]; picture?: { alt: string }; closingPicture?: { alt: string } };
            const report =
                (lang === 'en' ? undefined : await json<Shared>(env, origin, `/data/reports/${encodeURIComponent(route.id)}.${lang}.json`)) ??
                (await json<Shared>(env, origin, `/data/reports/${encodeURIComponent(route.id)}.json`));
            if (!report) return { ...site, path: url.pathname, found: false };
            const page = { ...site, title: report.title, description: report.summary, path: `/report/${report.id}`, found: true };
            /* A report that closes on a wish is shared as that wish: its own
               card (scripts/og/render.mjs) and the wish under it, in the
               telling's language (the English one keeps the Chinese it was
               written in as its first line). A search engine still gets the
               summary. */
            const wish = report.closing?.[0];
            const picture = report.picture ?? report.closingPicture;
            if (!wish?.length || !picture) return page;
            return {
                ...page,
                /* The number is the card’s drawing: raise it when a card is redrawn, so
                   an app that kept the old picture fetches the new one. */
                image: `/og/report/${report.id}.png?v=3`,
                imageAlt: picture.alt,
                shareDescription: (wish.length > 1 ? wish.slice(1) : wish).join(' '),
            };
        }
        case 'mix': {
            const chosen = route.ids.map(id => byId.get(id)).filter((e): e is IndexEntry => !!e);
            if (chosen.length < 2) {
                speakFor(lang);
                return { ...mixPreview(chosen.map(e => nameOf(e))), path: url.pathname, found: true };
            }
            const [matrix, ...details] = await Promise.all([
                json<ComboMatrix>(env, origin, '/data/combos.json'),
                ...chosen.map(e => json<Detail>(env, origin, `/data/substances/${encodeURIComponent(e.id)}.json`)),
            ]);
            const pairs: PairResult[] = [];
            for (let i = 0; i < chosen.length; i++)
                for (let j = i + 1; j < chosen.length; j++)
                    pairs.push(
                        checkPair(chosen[i], chosen[j], details[i] as Detail | undefined, details[j] as Detail | undefined, matrix as ComboMatrix | undefined),
                    );
            const top = worst(pairs);
            const note = top?.note;
            speakFor(lang);
            return {
                ...mixPreview(
                    chosen.map(e => nameOf(e)),
                    top?.verdict,
                    note && note.length < 140 ? note : undefined,
                ),
                path: `/mix/${chosen.map(e => e.id).join('+')}`,
                found: true,
            };
        }
        case 'kind': {
            const info = categoryInfo(route.category);
            const count = index.filter(e => e.category === info.id).length;
            speakFor(lang);
            return { ...kindPreview(info.id, count), path: `/kind/${info.id}`, found: count > 0 };
        }
        case 'browse':
        case 'saved':
        case 'emergency':
            speakFor(lang);
            return { ...pagePreview(route.page, index.length || undefined), path: `/${route.page}`, found: true };
        case 'settings': {
            // An account's own pages, and the admin's: nothing for a search engine.
            const own = !!route.sub && !['general', 'data', 'about', 'appearance', 'language', 'disclaimer', 'essay', 'credits'].includes(route.sub);
            speakFor(lang);
            if (route.sub === 'essay') return { ...essayPreview(index.length || undefined), path: '/settings/essay', found: true };
            return { ...pagePreview('settings', index.length || undefined), path: '/settings', found: true, privatePage: own };
        }
        case 'journal':
        case 'now':
        case 'log':
            speakFor(lang);
            return { ...pagePreview('journal', index.length || undefined), path: '/journal', found: true, privatePage: true };
        // Someone's night, shared with a link whose key never reaches here.
        case 'watch':
            speakFor(lang);
            return { ...site, path: '/', found: true, privatePage: true };
        default:
            return { ...site, path: '/', found: url.pathname === '/' };
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Accounts and their encrypted journals (worker/api.ts).
        if (url.pathname.startsWith('/api/')) return handleApi(request, env);

        /* The app's manifest: its name and the line under it in the
           visitor's language, so an installed app is named in it. */
        if (url.pathname === '/manifest.webmanifest') {
            const res = await env.ASSETS.fetch(new Request(url.origin + url.pathname));
            /* The plain one (src/lib/quiet.ts): the name the reader chose
               and a grey page for an icon, with nothing of the site's own
               name, line or shortcuts in it. */
            const plain = url.searchParams.get('plain')?.trim().slice(0, 30);
            if (plain && res.ok) {
                const icon = (size: number, purpose: string) => ({ src: `/plain-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose });
                return new Response(
                    JSON.stringify({
                        name: plain,
                        short_name: plain,
                        start_url: '/',
                        scope: '/',
                        display: 'standalone',
                        orientation: 'portrait',
                        background_color: '#ffffff',
                        theme_color: '#ffffff',
                        icons: [icon(192, 'any'), icon(512, 'any'), icon(512, 'maskable')],
                    }),
                    { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-store' } },
                );
            }
            const lang = langOf(request);
            if (lang === 'en' || !res.ok) return res;
            const manifest = (await res.json()) as Record<string, unknown>;
            speakFor(lang);
            const headers = new Headers(res.headers);
            headers.set('content-type', 'application/manifest+json; charset=utf-8');
            return new Response(
                JSON.stringify({
                    ...manifest,
                    lang: pageTag(lang, request),
                    name: tr('Oyama Journal'),
                    short_name: tr('Journal'),
                    shortcuts: (manifest.shortcuts as { name: string }[] | undefined)?.map(s => ({ ...s, name: tr(s.name) })),
                    description: tr('{0}, for {1} psychoactive substances, and a journal kept on your device.', { 0: tr(SITE.tagline), 1: '3,000' }),
                }),
                { headers },
            );
        }

        // Links from before the paths: ?substance=lsd.
        const legacy = url.searchParams.get('substance');
        if (legacy) return Response.redirect(`${url.origin}/s/${encodeURIComponent(legacy)}`, 301);

        const lang = langOf(request);
        const [shell, page] = await Promise.all([env.ASSETS.fetch(new Request(url.origin + '/')), pageFor(env, url, lang)]);
        const canonical = SITE.origin + page.path;
        // Always https: some previewers won't fetch a picture over http.
        const image = `https://${url.host}${page.image}`;
        const content = (value: string) => ({
            element(el: { setAttribute(n: string, v: string): void }) {
                el.setAttribute('content', value);
            },
        });

        const res = new HTMLRewriter()
            .on('html', {
                element(el) {
                    el.setAttribute('lang', pageTag(lang, request));
                },
            })
            // Hong Kong and Macau get zh_HK, as their page gets their typeface.
            .on(
                'meta[property="og:locale"]',
                content(
                    lang === 'zh-Hans'
                        ? 'zh_CN'
                        : lang === 'zh-Hant'
                          ? pageTag(lang, request) === 'zh-Hant-HK'
                              ? 'zh_HK'
                              : 'zh_TW'
                          : 'en_US',
                ),
            )
            .on('title', {
                element(el) {
                    el.setInnerContent(page.title);
                },
            })
            .on('meta[name="description"]', content(page.description))
            .on('link[rel="canonical"]', {
                element(el) {
                    el.setAttribute('href', canonical);
                },
            })
            .on('meta[property="og:url"]', content(canonical))
            .on('meta[property="og:title"]', content(page.title))
            .on('meta[property="og:description"]', content(page.shareDescription ?? page.description))
            .on('meta[property="og:image"]', content(image))
            .on('meta[property="og:image:alt"]', content(page.imageAlt))
            .on('meta[name="twitter:title"]', content(page.title))
            .on('meta[name="twitter:description"]', content(page.shareDescription ?? page.description))
            .on('meta[name="twitter:image"]', content(image))
            .on('meta[name="twitter:image:alt"]', content(page.imageAlt))
            .on('#share-image img', {
                element(el) {
                    el.setAttribute('src', image);
                },
            })
            .transform(shell);

        const headers = new Headers(res.headers);
        headers.set('content-type', 'text/html; charset=utf-8');
        // The page names its data's build; let it be checked each visit.
        headers.set('cache-control', 'public, max-age=0, must-revalidate');
        // A page for something that isn't there says so, for search engines.
        if (!page.found || page.privatePage) headers.set('x-robots-tag', 'noindex');
        return new Response(res.body, { status: page.found ? 200 : 404, headers });
    },
};
