import { useCallback, useSyncExternalStore } from 'react';

/* Small things remembered on this device: saved substances, the ones looked
   at lately, and a theme chosen over the system's. Only the saved list ever
   leaves it, with an account, encrypted (lib/account.ts). Every read and
   write survives storage being unavailable. */

const SAVED = 'journal.saved.v2';
const SAVED_LOG = 'journal.saved.log.v1';
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

const recent = listStore(RECENT);

/* Saved substances, as each one's last save or unsave and when, so the
   lists on two devices merge: the later of the two wins, for each one. The
   list is the ones saved, newest first. */

export type SavedLog = Record<string, { on: boolean; at: number }>;

function firstLog(): SavedLog {
  const log = read<SavedLog | null>(SAVED_LOG, null);
  if (log && typeof log === 'object') return log;
  // From the plain list kept before: in its order, older than any change.
  const ids = read<string[]>(SAVED, []);
  return Object.fromEntries(ids.map((id, i) => [id, { on: true, at: ids.length - i }]));
}

const listOf = (log: SavedLog) =>
  Object.entries(log)
    .filter(([, e]) => e.on)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id]) => id);

let savedLog = firstLog();
let savedIds = listOf(savedLog);
const savedSubs = new Set<() => void>();
const savedLocalSubs = new Set<() => void>();

function setSaved(next: SavedLog, merged = false) {
  savedLog = next;
  savedIds = listOf(next);
  write(SAVED_LOG, next);
  savedSubs.forEach((f) => f());
  if (!merged) savedLocalSubs.forEach((f) => f());
}

const subscribeSaved = (f: () => void) => {
  savedSubs.add(f);
  return () => {
    savedSubs.delete(f);
  };
};

export const getSavedLog = () => savedLog;
export const applySavedLog = (next: SavedLog) => setSaved(next, true);
export function onSavedChange(f: () => void): () => void {
  savedLocalSubs.add(f);
  return () => {
    savedLocalSubs.delete(f);
  };
}

/** Two devices' saved lists as one: for each substance, the later change
 *  (the account's on a tie). */
export function mergeSaved(local: SavedLog, remote: SavedLog): SavedLog {
  const out: SavedLog = { ...remote };
  for (const [id, e] of Object.entries(local)) if (!out[id] || e.at > out[id].at) out[id] = e;
  return out;
}

export function useSaved() {
  const ids = useSyncExternalStore(subscribeSaved, () => savedIds);
  const toggle = useCallback((id: string) => {
    const on = !savedIds.includes(id);
    setSaved({ ...savedLog, [id]: { on, at: Date.now() } });
  }, []);
  const clear = useCallback(() => {
    const t = Date.now();
    setSaved(Object.fromEntries(Object.keys(savedLog).map((id) => [id, { on: false, at: t }])));
  }, []);
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

/* The unit weights are shown and typed in. They're always kept in kg. */
export type WeightUnit = 'kg' | 'lb';
const WEIGHT_UNIT = 'journal.weight.unit.v1';
export const LB_PER_KG = 2.20462262;
const unitSubs = new Set<() => void>();
let weightUnit: WeightUnit = read<WeightUnit>(WEIGHT_UNIT, 'kg') === 'lb' ? 'lb' : 'kg';

export function useWeightUnit() {
    const unit = useSyncExternalStore(
        (f: () => void) => {
            unitSubs.add(f);
            return () => {
                unitSubs.delete(f);
            };
        },
        () => weightUnit,
    );
    const setUnit = useCallback((u: WeightUnit) => {
        weightUnit = u;
        write(WEIGHT_UNIT, u);
        unitSubs.forEach((f) => f());
    }, []);
    return { unit, setUnit };
}
