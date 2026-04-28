import { useEffect, useState } from 'react';

export type PagefindResultData = {
  url: string;
  excerpt: string;
  meta: { title: string };
};

type PagefindResult = {
  id: string;
  data: () => Promise<PagefindResultData>;
};

type PagefindModule = {
  search: (q: string) => Promise<{ results: PagefindResult[] }>;
};

// Pagefind ships a runtime ESM bundle generated AFTER `next build`. The
// bundler must not try to resolve `/pagefind/pagefind.js` at build time —
// route the dynamic import through a Function so static analysis cannot
// see the specifier.
const dynamicImport = new Function(
  'return import("/pagefind/pagefind.js")',
) as () => Promise<PagefindModule>;

let _loader: Promise<PagefindModule> | null = null;
export function loadPagefind(): Promise<PagefindModule> {
  if (_loader) return _loader;
  _loader = dynamicImport().catch((err) => {
    _loader = null;
    throw err;
  });
  return _loader;
}

export function usePagefindSearch(
  query: string,
  limit = 10,
): { results: PagefindResultData[]; loading: boolean; error: boolean } {
  const [results, setResults] = useState<PagefindResultData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    const t = setTimeout(async () => {
      try {
        const pf = await loadPagefind();
        const search = await pf.search(query);
        if (cancelled) return;
        const data = await Promise.all(
          search.results.slice(0, limit).map((r) => r.data()),
        );
        if (cancelled) return;
        setResults(data);
      } catch {
        if (cancelled) return;
        setError(true);
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, limit]);

  return { results, loading, error };
}
