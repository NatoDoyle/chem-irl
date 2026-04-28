import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';

type CalloutVariant = 'note' | 'warning' | 'quote' | 'aside';

const VARIANT_STYLES: Record<CalloutVariant, string> = {
  note: 'bg-aqua-50 border-l-4 border-aqua-600 text-ink-900',
  warning: 'bg-gold-50 border-l-4 border-coral text-ink-900',
  quote: 'bg-warm-bg border-l-4 border-ink-300 text-ink-700 italic',
  aside: 'bg-warm-bg text-ink-700 text-sm',
};

function Callout({
  variant,
  title,
  children,
}: {
  variant: CalloutVariant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={`my-6 px-5 py-4 rounded-brand not-prose ${VARIANT_STYLES[variant]}`}
    >
      {title && (
        <p className="font-semibold mb-2 not-italic text-ink-900">{title}</p>
      )}
      <div className="space-y-3 leading-relaxed">{children}</div>
    </aside>
  );
}

export const mdxComponents: MDXComponents = {
  Note: ({ title, children }: { title?: string; children: ReactNode }) => (
    <Callout variant="note" title={title}>
      {children}
    </Callout>
  ),
  Warning: ({ title, children }: { title?: string; children: ReactNode }) => (
    <Callout variant="warning" title={title}>
      {children}
    </Callout>
  ),
  Quote: ({ title, children }: { title?: string; children: ReactNode }) => (
    <Callout variant="quote" title={title}>
      {children}
    </Callout>
  ),
  Aside: ({ title, children }: { title?: string; children: ReactNode }) => (
    <Callout variant="aside" title={title}>
      {children}
    </Callout>
  ),
};
