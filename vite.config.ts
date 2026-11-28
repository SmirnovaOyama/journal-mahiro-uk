import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

/* The link preview cards (public/og: three thousand pictures, 140 MB) are
   made from the catalogue and aren't kept in the repository, and the
   sitemap in it is dated the day it was last written. A build that finds no
   cards draws them before public/ is copied into dist/. Cloudflare's build
   starts from a fresh clone on every push, so it draws them every time, and
   writes the sitemap for the day: what it deploys is whole, with no machine
   of ours having to follow it. A build on a machine that has cards from
   before leaves them be; `npm run og` draws them again. */
function cards(): Plugin {
    return {
        name: 'cards',
        apply: 'build',
        buildStart() {
            const ci = !!process.env.CI || !!process.env.WORKERS_CI;
            if (!ci && existsSync(here('public/og/site.png'))) return;
            execFileSync(process.execPath, [here('scripts/og/render.mjs')], { stdio: 'inherit' });
            if (ci) execFileSync(process.execPath, [here('scripts/sitemap.mjs')], { stdio: 'inherit' });
        },
    };
}

export default defineConfig({
  plugins: [react(), cards()],
  build: {
    // The list of every file the build makes, for the service worker
    // (public/sw.js): it keeps them all, so the site opens offline in any of
    // its languages, whose words are files the page only asks for later.
    manifest: 'build.json',
  },
  server: {
    // Accounts are the Worker's (worker/api.ts): run `npx wrangler dev` beside
    // `npm run dev` and the app's /api/ requests go to it.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
