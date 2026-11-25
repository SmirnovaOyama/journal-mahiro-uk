import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  GitCompareArrows,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { DoodleBackground } from './components/DoodleBackground';
import {
  DOSAGE_FORM_LABELS,
  FormDoodle,
  type DosageForm,
} from './components/FormDoodle';
import { InteractionCheckerView } from './components/InteractionCheckerView';
import { Segmented } from './components/Segmented';
import { SubstanceDetailPage } from './components/SubstanceDetailPage';
import { Tabs } from './components/Tabs';
import { loadBookmarks, saveBookmarks } from './data/journalStore';
import {
  CATALOG_CATEGORIES,
  fetchSubstanceDetail,
  fetchSubstanceIndex,
  type CatalogCategory,
  type SubstanceDetailData,
  type SubstanceIndexEntry,
} from './data/substanceCatalog';

type TopView = 'directory' | 'checker';

const ALL_FORMS: readonly DosageForm[] = [
  'capsule',
  'tablet',
  'injection',
  'gel',
  'patch',
  'blotter',
  'dropper',
  'spray',
];

const INITIAL_PER_GROUP = 8;

function getInitialSubstanceId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('substance');
  const fromHash = window.location.hash.replace(/^#\/?(substance\/)?/, '').trim();
  const targetId = (fromQuery || fromHash).toLowerCase();
  return targetId || null;
}

export default function App() {
  const [catalog, setCatalog] = useState<SubstanceIndexEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [topView, setTopView] = useState<TopView>('directory');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | CatalogCategory>('All');
  const [formFilter, setFormFilter] = useState<'All' | DosageForm>('All');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(getInitialSubstanceId);
  const [selectedDetail, setSelectedDetail] = useState<SubstanceDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [checkerPair, setCheckerPair] = useState<string[]>(['lsd', 'mdma']);
  const [bookmarks, setBookmarks] = useState<string[]>(loadBookmarks);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const stageColumnRef = useRef<HTMLDivElement>(null);

  // Load 702-substance lightweight index once on startup
  useEffect(() => {
    let active = true;
    fetchSubstanceIndex()
      .then((list) => {
        if (active) {
          setCatalog(list);
          setCatalogLoading(false);
        }
      })
      .catch(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load full detail JSON on demand whenever selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      setDetailLoading(false);
      return;
    }
    let active = true;
    setDetailLoading(true);
    fetchSubstanceDetail(selectedId)
      .then((d) => {
        if (active) {
          setSelectedDetail(d);
          setDetailLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSelectedDetail(null);
          setDetailLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setSelectedId(getInitialSubstanceId());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (selectedDetail) {
      document.title = `${selectedDetail.name} — Journal`;
    } else if (topView === 'checker') {
      document.title = 'Interactions — Journal';
    } else {
      document.title = 'Journal';
    }
  }, [selectedDetail, topView]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      if (!matchesCategory) return false;
      const matchesForm = formFilter === 'All' || item.form === formFilter;
      if (!matchesForm) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.aliases.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.chemicalClass.toLowerCase().includes(q) ||
        item.form.toLowerCase().includes(q)
      );
    });
  }, [catalog, query, category, formFilter]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, category, formFilter]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement !== inputRef.current &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement) &&
        !(document.activeElement instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (stageColumnRef.current && !stageColumnRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const openSubstance = (entry: Pick<SubstanceIndexEntry, 'id'>) => {
    setSelectedId(entry.id);
    setIsOpen(false);
    setQuery('');
    const url = new URL(window.location.href);
    url.searchParams.set('substance', entry.id);
    window.history.pushState({ substance: entry.id }, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHome = (targetView?: TopView) => {
    if (targetView) setTopView(targetView);
    setSelectedId(null);
    setIsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('substance');
    url.hash = '';
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      saveBookmarks(next);
      return next;
    });
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const bookmarkedSubstances = useMemo(
    () =>
      bookmarks
        .map((id) => catalog.find((s) => s.id === id))
        .filter((s): s is SubstanceIndexEntry => Boolean(s)),
    [bookmarks, catalog]
  );

  const directoryGroups = useMemo(() => {
    const groups: { key: string; label: string; items: SubstanceIndexEntry[] }[] = [];
    const browsing = category === 'All' && formFilter === 'All' && !query.trim();

    if (browsing) {
      if (bookmarkedSubstances.length > 0) {
        groups.push({ key: 'saved', label: 'Saved', items: bookmarkedSubstances });
      }
      for (const c of CATALOG_CATEGORIES) {
        if (c.id === 'All') continue;
        const items = filtered.filter((s) => s.category === c.id);
        if (items.length > 0) groups.push({ key: c.id, label: c.label, items });
      }
      return groups;
    }

    const label =
      category !== 'All'
        ? category
        : formFilter !== 'All'
          ? DOSAGE_FORM_LABELS[formFilter].en
          : 'Results';
    return [{ key: 'results', label, items: filtered }];
  }, [category, formFilter, query, filtered, bookmarkedSubstances]);

  const dropdownMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.aliases.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.chemicalClass.toLowerCase().includes(q)
      )
      .slice(0, 18);
  }, [catalog, query]);

  const showDropdown = isOpen && Boolean(selectedId) && query.trim().length > 0;

  const renderSearchField = (
    placeholderText = `Search ${catalog.length || 700}+ substances, aliases, or classes (⌘K)…`
  ) => (
    <div
      ref={stageColumnRef}
      className={selectedId ? 'header-search-column' : 'directory-search-box'}
    >
      <form
        role="search"
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          const list = selectedId ? dropdownMatches : filtered;
          if (list[activeIndex]) {
            openSubstance(list[activeIndex]);
          }
        }}
      >
        <div className="search-field-shell">
          <span className="search-icon" aria-hidden="true">
            <Search size={18} strokeWidth={1.75} />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={placeholderText}
            onFocus={() => {
              if (query.trim().length > 0) {
                setIsOpen(true);
              }
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              const list = selectedId ? dropdownMatches : filtered;
              if (e.key === 'ArrowDown' && list.length > 0) {
                e.preventDefault();
                setIsOpen(true);
                setActiveIndex((i) => (i + 1) % list.length);
              } else if (e.key === 'ArrowUp' && list.length > 0) {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + list.length) % list.length);
              } else if (e.key === 'Escape') {
                if (isOpen) {
                  setIsOpen(false);
                } else if (query) {
                  setQuery('');
                } else {
                  inputRef.current?.blur();
                }
              }
            }}
            className="input-base search-input"
            aria-label="Search substances"
            autoComplete="off"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="btn-ghost btn-icon-circle search-clear tap-target"
              aria-label="Clear search"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div className="search-dropdown" role="listbox" aria-label="Substances">
          <div className="search-results-list scrollbar-hide">
            {dropdownMatches.length === 0 ? (
              <div className="empty-row">
                No matching entry found. Try another substance name or alias.
              </div>
            ) : (
              dropdownMatches.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  data-active={idx === activeIndex}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => openSubstance(item)}
                  className="menu-item"
                >
                  <div className="menu-item-lead">
                    <FormDoodle form={item.form} size={1.85} />
                    <div className="menu-item-text">
                      <div className="menu-item-title">{item.name}</div>
                      <div className="menu-item-sub">
                        {item.category}
                        {item.aliases ? `, ${item.aliases}` : ''}
                      </div>
                    </div>
                  </div>
                  {item.primaryBand && (
                    <div className="menu-item-trail tabular-nums">
                      <span>
                        {item.primaryBand.low}–{item.primaryBand.high} {item.primaryBand.unit}
                      </span>
                      <ChevronRight size={16} strokeWidth={1.75} />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );

  // DETAIL PAGE VIEW
  if (selectedId) {
    return (
      <>
        <DoodleBackground />

        <header className="detail-page-header">
          <div className="detail-page-header-inner">
            <button
              type="button"
              onClick={() => goHome()}
              className="btn-ghost tap-target detail-back-btn"
              aria-label="Back to substances"
            >
              <ArrowLeft size={20} strokeWidth={2.1} />
              <span>Substances</span>
            </button>

            {renderSearchField('Jump to substance (⌘K)…')}

            <button
              type="button"
              onClick={() => setIsDark((v) => !v)}
              className="btn-ghost btn-icon-circle tap-target"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? (
                <Sun size={20} strokeWidth={1.85} />
              ) : (
                <Moon size={20} strokeWidth={1.85} />
              )}
            </button>
          </div>
        </header>

        <main className="detail-page-stage">
          <div className="detail-page-column">
            {detailLoading && !selectedDetail ? (
              <div className="empty-row">Loading substance profile…</div>
            ) : selectedDetail ? (
              <SubstanceDetailPage
                key={selectedDetail.id}
                detail={selectedDetail}
                catalog={catalog}
                isBookmarked={bookmarks.includes(selectedDetail.id)}
                onToggleBookmark={handleToggleBookmark}
                onOpenSubstance={openSubstance}
                onFilterCategory={(cat) => {
                  setCategory(cat);
                  setFormFilter('All');
                  setQuery('');
                  goHome('directory');
                }}
                onFilterForm={(form) => {
                  setFormFilter(form);
                  setCategory('All');
                  setQuery('');
                  goHome('directory');
                }}
                onOpenInteractionChecker={(subId) => {
                  const other = subId === 'lsd' ? 'mdma' : 'lsd';
                  setCheckerPair([subId, other]);
                  goHome('checker');
                }}
                onOpenInteractionPair={(pair) => {
                  setCheckerPair(pair);
                  goHome('checker');
                }}
              />
            ) : (
              <div className="empty-row">
                Substance record not found. Return to the directory to browse all {catalog.length}{' '}
                entries.
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  // TOP-LEVEL WORKSPACE (SUBSTANCES DIRECTORY / INTERACTIONS)
  return (
    <>
      <DoodleBackground />

      <header className="detail-page-header">
        <div className="detail-page-header-inner">
          <Segmented
            options={[
              {
                id: 'directory' as TopView,
                label: `Substances (${catalog.length})`,
              },
              { id: 'checker' as TopView, label: 'Interactions' },
            ]}
            value={topView}
            onChange={setTopView}
            aria-label="Primary workspace navigation"
          />

          <button
            type="button"
            onClick={() => setIsDark((v) => !v)}
            className="btn-ghost btn-icon-circle tap-target"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? (
              <Sun size={20} strokeWidth={1.85} />
            ) : (
              <Moon size={20} strokeWidth={1.85} />
            )}
          </button>
        </div>
      </header>

      <main className="detail-page-stage">
        <div className="detail-page-column">
          {topView === 'checker' ? (
            <InteractionCheckerView
              key={checkerPair.join('|')}
              catalog={catalog}
              initialPair={checkerPair}
              onOpenSubstance={openSubstance}
            />
          ) : (
            <div className="directory-page">
              {renderSearchField()}

              <div className="directory-filters">
                <Tabs tabs={CATALOG_CATEGORIES} value={category} onChange={setCategory} />

                <div className="form-icon-filter" role="group" aria-label="Filter by dosage form">
                  {ALL_FORMS.map((f) => {
                    const active = formFilter === f;
                    const label = DOSAGE_FORM_LABELS[f].en;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormFilter((prev) => (prev === f ? 'All' : f))}
                        className={`form-icon-btn tap-target ${active ? 'form-icon-btn-active' : ''}`}
                        aria-pressed={active}
                        aria-label={`${label} only`}
                        title={label}
                      >
                        <FormDoodle
                          form={f}
                          size={1.6}
                          asleep={formFilter !== 'All' && !active}
                        />
                      </button>
                    );
                  })}
                  {formFilter !== 'All' && (
                    <button
                      type="button"
                      onClick={() => setFormFilter('All')}
                      className="btn-ghost"
                    >
                      Clear {DOSAGE_FORM_LABELS[formFilter].en.toLowerCase()}
                    </button>
                  )}
                </div>
              </div>

              {catalogLoading ? (
                <div className="empty-row">Loading substance catalog…</div>
              ) : filtered.length === 0 ? (
                <div className="empty-row">
                  No matching entry. Try another name, alias, or clear the filters.
                </div>
              ) : (
                directoryGroups.map((group) => {
                  const isBrowsingAll =
                    category === 'All' && formFilter === 'All' && !query.trim();
                  const defaultLimit = isBrowsingAll ? INITIAL_PER_GROUP : 60;
                  const isExpanded = Boolean(expandedGroups[group.key]);
                  const visibleItems =
                    isExpanded || group.key === 'saved'
                      ? group.items
                      : group.items.slice(0, defaultLimit);
                  const hiddenCount = group.items.length - visibleItems.length;

                  return (
                    <section key={group.key} className="directory-group">
                      <div className="directory-group-heading">
                        <h2 className="section-heading">
                          {group.label} ({group.items.length})
                        </h2>
                        {group.items.length > defaultLimit && group.key !== 'saved' && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGroups((prev) => ({
                                ...prev,
                                [group.key]: !prev[group.key],
                              }))
                            }
                            className="btn-ghost"
                          >
                            {isExpanded ? 'Show fewer' : `Show all ${group.items.length}`}
                          </button>
                        )}
                      </div>

                      <div className="settings-section">
                        {visibleItems.map((item, idx) => {
                          const isSaved = bookmarks.includes(item.id);
                          const isKeyActive =
                            Boolean(query.trim()) && group.key === 'results' && idx === activeIndex;
                          const subline =
                            item.aliases || item.chemicalClass || item.status;
                          return (
                            <div
                              key={`${group.key}-${item.id}`}
                              className={`directory-row ${isKeyActive ? 'directory-row-active' : ''}`}
                              onMouseEnter={() => {
                                if (group.key === 'results') setActiveIndex(idx);
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => openSubstance(item)}
                                className="directory-row-main"
                              >
                                <FormDoodle form={item.form} size={2} />
                                <span className="directory-row-text">
                                  <span className="body-strong directory-row-title">
                                    {item.name}
                                  </span>
                                  <span className="caption directory-row-sub">
                                    {subline}
                                  </span>
                                </span>
                                {item.primaryBand && (
                                  <span className="caption tabular-nums directory-row-dose">
                                    {item.primaryBand.low}–{item.primaryBand.high}{' '}
                                    {item.primaryBand.unit}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const other = item.id === 'lsd' ? 'mdma' : 'lsd';
                                  setCheckerPair([item.id, other]);
                                  setTopView('checker');
                                }}
                                className="btn-ghost btn-icon-circle tap-target directory-compare"
                                aria-label={`Compare ${item.name} interactions`}
                                title={`Compare ${item.name}`}
                              >
                                <GitCompareArrows size={15} strokeWidth={1.85} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleBookmark(item.id)}
                                className={`btn-ghost btn-icon-circle tap-target directory-bookmark ${
                                  isSaved ? 'btn-ghost-accent is-saved' : ''
                                }`}
                                aria-pressed={isSaved}
                                aria-label={
                                  isSaved ? `Unsave ${item.name}` : `Save ${item.name}`
                                }
                              >
                                <Bookmark
                                  size={16}
                                  strokeWidth={1.85}
                                  fill={isSaved ? 'currentColor' : 'none'}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGroups((prev) => ({ ...prev, [group.key]: true }))
                          }
                          className="btn-ghost directory-show-more"
                        >
                          Show {hiddenCount} more in {group.label}
                        </button>
                      )}
                    </section>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
