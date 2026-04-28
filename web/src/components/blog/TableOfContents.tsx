'use client';

import { useEffect, useState } from 'react';

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Scope to the prose container so the TOC only reflects post-body
    // headings, not in-page chrome like the "Related reading" h2.
    const proseRoot = document.querySelector('article .prose');
    if (!proseRoot) return;
    const headings = Array.from(
      proseRoot.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'),
    );
    const toc: TocItem[] = headings
      .map((h) => ({
        id: h.id,
        text: h.textContent?.trim() ?? '',
        level: h.tagName === 'H2' ? 2 : 3,
      }))
      .filter((item): item is TocItem => Boolean(item.id) && Boolean(item.text));

    // We're subscribing to DOM-rendered headings (rendered by MDX), which is
    // the documented "external system" exception to the synchronous-setState
    // rule. There is no derivable React state to read from at render time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(toc);

    if (toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Table of contents"
      data-pagefind-ignore="all"
      className="hidden md:block sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">
        On this page
      </h2>
      <ol className="space-y-2 text-sm list-none">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
              <a
                href={`#${item.id}`}
                className={`block leading-snug transition-colors ${
                  isActive
                    ? 'text-aqua-700 font-medium'
                    : 'text-ink-600 hover:text-aqua-700'
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
