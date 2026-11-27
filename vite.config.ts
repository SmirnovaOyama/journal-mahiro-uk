import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
