/* The little of a browser the site's own code touches when it's loaded:
   storage, the address, and a page to hang a theme on. Imported first by
   every test. */

import fs from 'node:fs';
import path from 'node:path';

declare global {
    // eslint-disable-next-line no-var
    var __ROOT__: string;
}

class MemoryStorage {
    private m = new Map<string, string>();
    get length() {
        return this.m.size;
    }
    key(i: number) {
        return [...this.m.keys()][i] ?? null;
    }
    getItem(k: string) {
        return this.m.get(k) ?? null;
    }
    setItem(k: string, v: string) {
        this.m.set(k, String(v));
    }
    removeItem(k: string) {
        this.m.delete(k);
    }
    clear() {
        this.m.clear();
    }
}

const g = globalThis as Record<string, unknown>;
const noop = () => {};
g.localStorage = new MemoryStorage();
g.location = { pathname: '/', search: '', hash: '', hostname: 'localhost', reload: noop };
g.history = { state: null, replaceState: noop, pushState: noop, back: noop };
g.addEventListener ??= noop;
g.removeEventListener ??= noop;
g.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
g.window = g;
g.document = {
    documentElement: { classList: { toggle: noop, add: noop, remove: noop }, dataset: {}, style: {} },
    addEventListener: noop,
    removeEventListener: noop,
    visibilityState: 'visible',
    title: '',
};

/** A file of the catalogue, as the site would fetch it. */
export function data<T>(file: string): T {
    return JSON.parse(fs.readFileSync(path.join(globalThis.__ROOT__, 'public/data', file), 'utf8')) as T;
}
