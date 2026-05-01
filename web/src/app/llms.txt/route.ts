import { getAllPosts } from '@/lib/blog';
import { CATEGORIES } from '@/lib/blog/categories';
import type { CategorySlug } from '@/lib/blog/categories';

export const dynamic = 'force-static';

const SITE = 'https://chemirl.app';

const SITE_DESCRIPTION =
  'Chem IRL is a dating app optimized for real-world follow-through and reduced time-to-date, not endless in-app engagement. The blog publishes dating tips, diagnostic essays on patterns that run modern dating, honest cultural takes, and product philosophy explaining how the app is built. Posts are written for daters in their late twenties to late thirties who want honest, actionable guidance.';

const STATIC_LINKS = [
  { url: `${SITE}/`, title: 'Home', hint: 'Product overview and waitlist signup.' },
  {
    url: `${SITE}/how-it-works/`,
    title: 'How it works',
    hint: 'The mechanics: matches, proposals (2–3 specific times within 7 days), and 72-hour expiry.',
  },
  {
    url: `${SITE}/about/`,
    title: 'About',
    hint: 'The thesis and the team behind Chem IRL.',
  },
  {
    url: `${SITE}/safety/`,
    title: 'Safety',
    hint: 'Safety features, reporting, and policies.',
  },
  {
    url: `${SITE}/privacy/`,
    title: 'Privacy policy',
    hint: 'How user data is handled.',
  },
  {
    url: `${SITE}/terms/`,
    title: 'Terms of service',
    hint: 'Legal terms.',
  },
  {
    url: `${SITE}/blog/`,
    title: 'Blog index',
    hint: 'All published essays, paginated.',
  },
] as const;

export async function GET(): Promise<Response> {
  const posts = getAllPosts();
  const byCategory = new Map<CategorySlug, typeof posts>();
  for (const p of posts) {
    const arr = byCategory.get(p.category) ?? [];
    arr.push(p);
    byCategory.set(p.category, arr);
  }

  const lines: string[] = [];
  lines.push('# Chem IRL');
  lines.push('');
  lines.push(`> ${SITE_DESCRIPTION}`);
  lines.push('');
  lines.push('## Site');
  lines.push('');
  for (const link of STATIC_LINKS) {
    lines.push(`- [${link.title}](${link.url}): ${link.hint}`);
  }
  lines.push('');

  // Order categories by the canonical CATEGORIES key order so the file is
  // deterministic across builds.
  const orderedCategoryKeys = Object.keys(CATEGORIES) as CategorySlug[];
  for (const slug of orderedCategoryKeys) {
    const categoryPosts = byCategory.get(slug);
    if (!categoryPosts || categoryPosts.length === 0) continue;
    const meta = CATEGORIES[slug];
    lines.push(`## ${meta.label}`);
    lines.push('');
    lines.push(`> ${meta.description}`);
    lines.push('');
    for (const post of categoryPosts) {
      const url = `${SITE}/blog/${post.slug}`;
      const summary = post.tldr ?? post.excerpt;
      lines.push(`- [${post.title}](${url}): ${summary}`);
    }
    lines.push('');
  }

  const body = lines.join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
