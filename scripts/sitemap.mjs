// Writes public/sitemap.xml: every page a search engine should know, on the
// site's one canonical address (the Worker points every domain's pages there).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://journal.mahiro.uk';
const index = JSON.parse(await fs.readFile(path.join(ROOT, 'public/data/index.json'), 'utf8'));
const kinds = [...new Set(index.map(e => e.category))];
const today = new Date().toISOString().slice(0, 10);

const urls = [
    ['/', '1.0'],
    ['/browse', '0.6'],
    ['/mix', '0.6'],
    ['/emergency', '0.7'],
    ...kinds.map(k => [`/kind/${encodeURIComponent(k)}`, '0.5']),
    ...index.map(e => [`/s/${encodeURIComponent(e.id)}`, e.src === 'wd' && !e.primaryBand ? '0.4' : e.status === 'Well-documented' ? '0.8' : '0.7']),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, p]) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>
`;
await fs.writeFile(path.join(ROOT, 'public/sitemap.xml'), xml);
console.log(`sitemap: ${urls.length} pages`);
