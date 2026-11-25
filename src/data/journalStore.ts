const BOOKMARKS_STORAGE_KEY = 'oyama_journal_bookmarks_v1';
const RECENT_STORAGE_KEY = 'oyama_journal_recent_v1';

export function loadBookmarks(): string[] {
  if (typeof window === 'undefined') return ['lsd', 'estradiol-enanthate', 'estradiol-gel'];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) {
      const initial = ['lsd', 'estradiol-enanthate', 'estradiol-gel'];
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return ['lsd', 'estradiol-enanthate', 'estradiol-gel'];
  }
}

export function saveBookmarks(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function loadRecentIds(): string[] {
  if (typeof window === 'undefined') return ['lsd', 'estradiol-enanthate'];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return ['lsd', 'estradiol-enanthate'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentId(id: string): string[] {
  const current = loadRecentIds();
  const next = [id, ...current.filter((x) => x !== id)].slice(0, 6);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}
