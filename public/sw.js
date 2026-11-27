/* The site without a connection: at a party, in a basement, on a festival
   field. Registered by src/lib/offline.ts, on the built site only.

   What it keeps on the device:
     the page itself, with every script and stylesheet the build made;
     the search index and the mix table, so search and the mix checker work;
     each substance as it's opened (src/lib/offline.ts adds the ones saved,
       logged or looked at lately, opened here or not);
     pictures and icons as they're shown.
   The journal was never anywhere else: it's in the browser's own storage.

   With a connection nothing changes: every request is answered by the
   network, as before, and what's kept is only what the network last said.
   Kept copies answer when the network doesn't, or when it takes too long
   to. The build's own script and stylesheet are the exception: their names
   change whenever they do, so a kept one is always the right one.

   Accounts (/api/) are never kept and never answered from here. */

const SHELL = 'journal-shell-v1';
/** The catalogue. src/lib/offline.ts writes to it by this name too. */
const DATA = 'journal-data-v1';
const FILES = 'journal-files-v1';
const MINE = [SHELL, DATA, FILES];

/** The one key the page is kept under: every path is the same page, with
 *  that path's own title written in by the Worker (worker/index.ts). */
const PAGE = '/';
/** How long the network gets before a kept copy answers instead. */
const PATIENCE = 4000;

const isHtml = res => (res.headers.get('content-type') || '').includes('text/html');
/** The build's files a page names: /assets/index-87HKLBkb.js and the like. */
const assetsOf = html => [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]))];

/** Every file the build made, by the build's own list (vite.config.ts has
 *  it written to /build.json): the script and stylesheet the page names, and
 *  the ones it asks for later, a language's words among them. Nothing when
 *  the list can't be had. */
async function buildFiles() {
    try {
        const res = await fetch('/build.json', { cache: 'no-store' });
        if (!res.ok || isHtml(res)) return null;
        const files = new Set();
        for (const chunk of Object.values(await res.json()))
            for (const file of [chunk.file, ...(chunk.css || []), ...(chunk.assets || [])]) if (file) files.add(`/${file}`);
        return [...files];
    } catch {
        return null;
    }
}

/** Keeps a page as the one to open offline. When it's from a build this
 *  device hasn't kept, that build's files are kept first, and the ones from
 *  the build before are let go. */
async function keepPage(res) {
    const cache = await caches.open(SHELL);
    const named = assetsOf(await res.clone().text());
    const before = await cache.match(PAGE);
    const had = before ? assetsOf(await before.text()) : [];
    // The same build as the page already kept: only its title is new.
    if (before && named.length === had.length && named.every(url => had.includes(url))) return cache.put(PAGE, res);

    const listed = await buildFiles();
    const files = [...new Set([...named, ...(listed || [])])];
    // The files first: a page kept without them would open to nothing.
    await Promise.all(
        files.map(async url => {
            if (await cache.match(url)) return;
            const got = await fetch(url);
            if (!got.ok || isHtml(got)) throw new Error(`${url}: ${got.status}`);
            await cache.put(url, got);
        }),
    );
    await cache.put(PAGE, res);
    // Without the list there's no telling an old file from one asked for late.
    if (!listed) return;
    for (const key of await cache.keys()) {
        const { pathname } = new URL(key.url);
        if (pathname.startsWith('/assets/') && !files.includes(pathname)) await cache.delete(key);
    }
}

self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            const res = await fetch(PAGE);
            if (!res.ok || !isHtml(res)) throw new Error(`the page: ${res.status}`);
            await keepPage(res);
            // Search and the mix checker. Wanted, but the install doesn't wait
            // on them failing: they're kept the next time they're asked for.
            const data = await caches.open(DATA);
            await Promise.all(['/data/index.json', '/data/combos.json'].map(url => data.add(url).catch(() => {})));
            await self.skipWaiting();
        })(),
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            for (const name of await caches.keys()) if (name.startsWith('journal-') && !MINE.includes(name)) await caches.delete(name);
            // The tab that registered this is served by it from now on.
            await self.clients.claim();
        })(),
    );
});

/** The network's answer, or the kept one when the network fails, is slow or
 *  is broken (a 5xx). `keep` is handed a copy of each answer, to keep it if
 *  it's worth keeping. */
async function fresh(event, cacheName, key, keep) {
    const cache = await caches.open(cacheName);
    const kept = await cache.match(key);
    const net = fetch(event.request);
    // Kept on the side: the answer doesn't wait for it, and it goes on after
    // a kept copy has answered in the network's place.
    event.waitUntil(net.then(res => keep(res.clone(), cache)).catch(() => {}));
    if (!kept) return net;
    return Promise.race([
        net.then(res => (res.status >= 500 ? kept : res)).catch(() => kept),
        new Promise(done => setTimeout(done, PATIENCE, kept)),
    ]);
}

/** A file whose name changes when it does: the kept one, else the network's. */
async function named(event) {
    const cache = await caches.open(SHELL);
    const kept = await cache.match(event.request);
    if (kept) return kept;
    const res = await fetch(event.request);
    if (res.ok && !isHtml(res)) event.waitUntil(cache.put(event.request, res.clone()).catch(() => {}));
    return res;
}

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    const path = url.pathname;
    // Accounts, link-preview cards and what only a search engine reads.
    if (path.startsWith('/api/') || path.startsWith('/og/') || path === '/sw.js' || path === '/build.json' || path === '/sitemap.xml' || path === '/robots.txt') return;

    if (path.startsWith('/assets/')) return event.respondWith(named(event));

    // The catalogue. A missing file is answered with the page (a 404, in
    // HTML): passed on as it is, and never kept in a substance's place.
    if (path.startsWith('/data/'))
        return event.respondWith(
            fresh(event, DATA, request, async (res, cache) => {
                if (res.ok && !isHtml(res)) await cache.put(request, res);
            }),
        );

    // A page of the site, whichever one.
    if (request.mode === 'navigate')
        return event.respondWith(
            fresh(event, SHELL, PAGE, async res => {
                if (res.ok && isHtml(res)) await keepPage(res);
            }),
        );

    // Pictures, icons, the manifest.
    event.respondWith(
        fresh(event, FILES, request, async (res, cache) => {
            if (res.ok && !isHtml(res)) await cache.put(request, res);
        }),
    );
});
