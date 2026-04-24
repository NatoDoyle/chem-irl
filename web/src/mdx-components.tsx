import type { MDXComponents } from 'mdx/types';

/**
 * MDX component overrides. Consumed by MDXRemote in the blog detail page.
 * Prose styling lives in @tailwindcss/typography via the .prose class,
 * applied at the PostLayout level — so this is intentionally empty.
 */
export const mdxComponents: MDXComponents = {};
