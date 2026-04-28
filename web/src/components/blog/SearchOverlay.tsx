'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePagefindSearch } from '@/lib/pagefind';

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [trackedResultsId, setTrackedResultsId] = useState<unknown>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const { results, loading } = usePagefindSearch(open ? query : '', 10);

  // Reset highlight when the results array reference changes. Using the
  // "adjust state during render" pattern (https://react.dev/learn/you-might-
  // not-need-an-effect#adjusting-some-state-when-a-prop-changes) avoids the
  // setState-in-useEffect anti-pattern.
  if (results !== trackedResultsId) {
    setTrackedResultsId(results);
    setSelectedIndex(0);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac =
        typeof navigator !== 'undefined' &&
        navigator.platform.toLowerCase().includes('mac');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      // Defer focus until after the dialog mounts.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    previouslyFocused.current?.focus();
  }, [open]);

  const onInputKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        window.location.href = results[selectedIndex].url;
      }
    },
    [results, selectedIndex],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Search posts"
      aria-modal="true"
      data-pagefind-ignore="all"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-ink-900/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-2xl rounded-brand bg-surface shadow-warm-lg overflow-hidden">
        <div className="border-b border-ink-100 px-4 py-3 flex items-center gap-3">
          <span className="text-ink-400" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search posts..."
            className="flex-1 bg-transparent outline-none text-ink-900 placeholder:text-ink-400"
            aria-label="Search posts"
            aria-controls="search-results"
            aria-activedescendant={
              results[selectedIndex] ? `search-result-${selectedIndex}` : undefined
            }
          />
          <kbd className="text-xs px-2 py-1 rounded bg-warm-bg text-ink-500">
            esc
          </kbd>
        </div>
        <div
          id="search-results"
          className="max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {loading && (
            <div className="px-4 py-6 text-sm text-ink-500">Searching…</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-6 text-sm text-ink-500">No results.</div>
          )}
          {!loading && !query.trim() && (
            <div className="px-4 py-6 text-sm text-ink-500">
              Type to search posts. <kbd className="mx-1">↑</kbd>
              <kbd className="mx-1">↓</kbd> to navigate,{' '}
              <kbd className="mx-1">⏎</kbd> to open.
            </div>
          )}
          {!loading &&
            results.map((r, i) => (
              <a
                key={r.url}
                id={`search-result-${i}`}
                href={r.url}
                role="option"
                aria-selected={i === selectedIndex}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 border-b border-ink-100 last:border-b-0 transition-colors ${
                  i === selectedIndex ? 'bg-aqua-50' : 'hover:bg-warm-bg'
                }`}
              >
                <div
                  className="font-medium text-ink-900 mb-1"
                  dangerouslySetInnerHTML={{ __html: r.meta.title }}
                />
                <div
                  className="text-sm text-ink-700 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </a>
            ))}
        </div>
      </div>
    </div>
  );
}
