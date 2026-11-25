import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Accounts are the Worker's (worker/api.ts): run `npx wrangler dev` beside
    // `npm run dev` and the app's /api/ requests go to it.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
