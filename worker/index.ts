/* The site's Worker. Files (scripts, data, pictures) are served straight
   from the build; this only runs for the pages and for accounts under /api/
   (wrangler.jsonc, run_worker_first). The accounts are in worker/api.ts.
   For the pages, a link shared to a chat app or found by a search engine
   says what that page is: its title, the line under it and its card.
   Link previewers don't run the app's JavaScript, so this is the only way
   they can learn that /s/lsd is about LSD.

   It reads the same data the app does, from the build, and words it with
   the same helpers (src/lib/preview.ts). */

import { categoryInfo, type ComboMatrix, type Detail, type IndexEntry } from '../src/lib/data';
import { checkPair, worst, type PairResult } from '../src/lib/mix';
import { SITE, kindPreview, mixPreview, pagePreview, sitePreview, substancePreview, type Preview } from '../src/lib/preview';
import { parse } from '../src/lib/routes';
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
}

async function pageFor(env: Env, url: URL): Promise<Page> {
    const origin = url.origin;
    const route = parse(url.pathname);
    const index = (await json<IndexEntry[]>(env, origin, '/data/index.json')) ?? [];
    const byId = new Map(index.map(e => [e.id, e]));
    const site = sitePreview(index.length || undefined);

    switch (route.page) {
        case 'substance': {
            const detail = await json<Detail>(env, origin, `/data/substances/${encodeURIComponent(route.id)}.json`);
            if (!detail) return { ...site, path: url.pathname, found: false };
            return { ...substancePreview(detail, byId.get(detail.id)), path: `/s/${detail.id}`, found: true };
        }
        case 'mix': {
            const chosen = route.ids.map(id => byId.get(id)).filter((e): e is IndexEntry => !!e);
            if (chosen.length < 2) return { ...mixPreview(chosen.map(e => e.name)), path: url.pathname, found: true };
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
            return {
                ...mixPreview(
                    chosen.map(e => e.name),
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
            return { ...kindPreview(info.id, count), path: `/kind/${info.id}`, found: count > 0 };
        }
        case 'browse':
        case 'saved':
        case 'settings':
            return { ...pagePreview(route.page, index.length || undefined), path: `/${route.page}`, found: true };
        case 'journal':
            return { ...pagePreview('journal', index.length || undefined), path: '/journal', found: true, privatePage: true };
        default:
            return { ...site, path: '/', found: url.pathname === '/' };
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Accounts and their encrypted journals (worker/api.ts).
        if (url.pathname.startsWith('/api/')) return handleApi(request, env);

        // Links from before the paths: ?substance=lsd.
        const legacy = url.searchParams.get('substance');
        if (legacy) return Response.redirect(`${url.origin}/s/${encodeURIComponent(legacy)}`, 301);

        const [shell, page] = await Promise.all([env.ASSETS.fetch(new Request(url.origin + '/')), pageFor(env, url)]);
        const canonical = SITE.origin + page.path;
        // Always https: some previewers won't fetch a picture over http.
        const image = `https://${url.host}${page.image}`;
        const content = (value: string) => ({
            element(el: { setAttribute(n: string, v: string): void }) {
                el.setAttribute('content', value);
            },
        });

        const res = new HTMLRewriter()
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
            .on('meta[property="og:description"]', content(page.description))
            .on('meta[property="og:image"]', content(image))
            .on('meta[property="og:image:alt"]', content(page.imageAlt))
            .on('meta[name="twitter:title"]', content(page.title))
            .on('meta[name="twitter:description"]', content(page.description))
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
