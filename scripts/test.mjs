// Runs the tests in tests/: each *.test.ts is bundled with esbuild (the one
// Vite brings) into a folder of its own and run by Node's test runner.
//
//   npm test                 every test
//   npm test -- mix          only tests/mix.test.ts
//
// The code under test is the site's own (src/lib), which expects a browser:
// tests/setup.ts stands in for the little of one it touches when loaded.

import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const files = fs
    .readdirSync(path.join(ROOT, 'tests'))
    .filter(f => f.endsWith('.test.ts') && (!only.length || only.some(o => f.includes(o))))
    .map(f => path.join(ROOT, 'tests', f));
if (!files.length) {
    console.error('No tests match.');
    process.exit(1);
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-tests-'));
try {
    await build({
        entryPoints: files,
        outdir: out,
        bundle: true,
        platform: 'node',
        format: 'esm',
        target: 'node20',
        outExtension: { '.js': '.mjs' },
        jsx: 'automatic',
        define: { 'import.meta.env.PROD': 'false', 'import.meta.env.DEV': 'true' },
        logLevel: 'warning',
        // The tests read the catalogue from the repository as it is.
        banner: { js: `globalThis.__ROOT__ = ${JSON.stringify(ROOT)};` },
    });
    const built = fs.readdirSync(out).filter(f => f.endsWith('.mjs')).map(f => path.join(out, f));
    const run = spawnSync(process.execPath, ['--test', ...built], { stdio: 'inherit' });
    process.exitCode = run.status ?? 1;
} finally {
    fs.rmSync(out, { recursive: true, force: true });
}
