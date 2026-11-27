import { useCallback, useSyncExternalStore } from 'react';
import { kv } from './kv';

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
    const raw = key === THEME ? localStorage.getItem(key) : kv.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  // Private mode or full: keep going without it. The theme is needed
  // before a lock's code is typed, so it stays outside the lock (lib/kv.ts).
  if (key !== THEME) return kv.set(key, JSON.stringify(value));
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* as above */
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

/** The ones looked at lately, newest first. */
export const getRecent = () => recent.get();

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

/* Body weight, for reading a dose per kilogram (or a per-kilogram dose as an
   amount) and for estimating blood alcohol. As hrt.mahiro.uk keeps it: one
   number, in kg, 20 to 400, with the unit it's shown in. `kg: null` is a
   weight taken away, kept with when, so it's taken away on every device. */

const WEIGHT = 'journal.weight.v1';
export const WEIGHT_KG_MIN = 20;
export const WEIGHT_KG_MAX = 400;
export const KG_PER_LB = 0.45359237;

export interface BodyWeight {
  kg: number | null;
  unit: 'kg' | 'lb';
  at: number;
}

function readWeight(): BodyWeight | null {
  const w = read<BodyWeight | null>(WEIGHT, null);
  if (!w || typeof w !== 'object' || typeof w.at !== 'number') return null;
  const kg = typeof w.kg === 'number' && w.kg >= WEIGHT_KG_MIN && w.kg <= WEIGHT_KG_MAX ? w.kg : null;
  return { kg, unit: w.unit === 'lb' ? 'lb' : 'kg', at: w.at };
}

let weight = readWeight();
const weightSubs = new Set<() => void>();
const weightLocalSubs = new Set<() => void>();

function setWeightValue(next: BodyWeight | null, merged = false) {
  weight = next;
  write(WEIGHT, next);
  weightSubs.forEach((f) => f());
  if (!merged) weightLocalSubs.forEach((f) => f());
}

export const getWeight = () => weight;
export const applyWeight = (next: BodyWeight | null) => setWeightValue(next, true);
export function onWeightChange(f: () => void): () => void {
  weightLocalSubs.add(f);
  return () => {
    weightLocalSubs.delete(f);
  };
}

/** Two devices' weights: the one set last. */
export function mergeWeight(local: BodyWeight | null | undefined, remote: BodyWeight | null | undefined): BodyWeight | null {
  if (!local) return remote ?? null;
  if (!remote) return local;
  return local.at > remote.at ? local : remote;
}

/** The weight in kg, or null when it isn't set. */
export function useWeight() {
  const w = useSyncExternalStore(
    (f) => {
      weightSubs.add(f);
      return () => {
        weightSubs.delete(f);
      };
    },
    () => weight,
  );
  const save = useCallback((kg: number, unit: 'kg' | 'lb') => setWeightValue({ kg, unit, at: Date.now() }), []);
  const clear = useCallback(() => setWeightValue({ kg: null, unit: weight?.unit ?? 'kg', at: Date.now() }), []);
  return { kg: w?.kg ?? null, unit: w?.unit ?? 'kg', save, clear };
}

/** "62 kg", "137 lb". */
export function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  return unit === 'lb' ? `${Math.round(kg / KG_PER_LB)} lb` : `${Number(kg.toFixed(1))} kg`;
}

/** Changes only the unit weights are shown in, keeping the weight. */
export function setWeightUnit(unit: 'kg' | 'lb') {
  if ((weight?.unit ?? 'kg') === unit) return;
  setWeightValue({ kg: weight?.kg ?? null, unit, at: Date.now() });
}
