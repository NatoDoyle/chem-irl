import type { MetadataRoute } from 'next';
import { getAllCategories, getAllPosts, getAllTags, POSTS_PER_PAGE } from '@/lib/blog';

export const dynamic = 'force-static';

const SITE = 'https://chemirl.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/safety`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/download`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
  ];

  const posts = getAllPosts();

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const paginationRoutes: MetadataRoute.Sitemap = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    url: `${SITE}/blog/page/${i + 2}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const tagRoutes: MetadataRoute.Sitemap = getAllTags().map((tag) => ({
    url: `${SITE}/blog/tag/${tag}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = getAllCategories().map((category) => ({
    url: `${SITE}/blog/category/${category}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...paginationRoutes, ...tagRoutes, ...categoryRoutes];
}
