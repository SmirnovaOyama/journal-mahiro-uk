import { useCallback, useSyncExternalStore } from 'react';

/* Small things remembered on this device only: saved substances, the ones
   looked at lately, and a theme chosen over the system's. Nothing leaves the
   browser. Every read and write survives storage being unavailable. */

const SAVED = 'journal.saved.v2';
const RECENT = 'journal.recent.v2';
const THEME = 'journal.theme.v2';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full: keep going without it */
  }
}

/* A list kept in storage that every component sees change at once. */
function listStore(key: string) {
  let value = read<string[]>(key, []);
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: string[]) {
      value = next;
      write(key, next);
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

const saved = listStore(SAVED);
const recent = listStore(RECENT);

export function useSaved() {
  const ids = useSyncExternalStore(saved.subscribe, saved.get);
  const toggle = useCallback((id: string) => {
    const cur = saved.get();
    saved.set(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]);
  }, []);
  const clear = useCallback(() => saved.set([]), []);
  return { ids, toggle, clear };
}

export function useRecent() {
  const ids = useSyncExternalStore(recent.subscribe, recent.get);
  const clear = useCallback(() => recent.set([]), []);
  return { ids, clear };
}

export function pushRecent(id: string) {
  recent.set([id, ...recent.get().filter((x) => x !== id)].slice(0, 8));
}

export type Theme = 'light' | 'dark';
/** What the visitor picked in Settings: a theme, or to follow the system. */
export type ThemeChoice = Theme | 'system' | 'mono';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* One theme for the whole page, whichever control changes it. */
const themeSubs = new Set<() => void>();
let chosen: ThemeChoice = read<ThemeChoice | null>(THEME, null) ?? 'system';
const resolve = (c: ThemeChoice): Theme => (c === 'system' ? systemTheme() : c === 'mono' ? 'light' : c);
let current: Theme = resolve(chosen);
const snapshot = () => `${chosen}|${current}`;
let snap = snapshot();

function applyTheme() {
  current = resolve(chosen);
  const root = document.documentElement;
  root.classList.toggle('dark', current === 'dark');
  // Black and white is the light theme drawn in grey (html.mono, index.css).
  root.classList.toggle('mono', chosen === 'mono');
  root.dataset.theme = current;
  root.style.colorScheme = current;
  snap = snapshot();
  themeSubs.forEach((f) => f());
}
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

function subscribeTheme(f: () => void) {
  themeSubs.add(f);
  return () => {
    themeSubs.delete(f);
  };
}

export function useTheme() {
  const s = useSyncExternalStore(subscribeTheme, () => snap);
  const [choice, theme] = s.split('|') as [ThemeChoice, Theme];
  const setChoice = useCallback((next: ThemeChoice) => {
    chosen = next;
    write(THEME, next === 'system' ? null : next);
    applyTheme();
  }, []);
  return { theme, choice, setChoice };
}
