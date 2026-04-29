import { z } from 'zod';

import { CATEGORY_SLUGS } from './categories';

export const PostFrontmatterSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-hyphenated'),
  date: z.coerce.date(),
  author: z.string(),
  tags: z.array(z.string()).default([]),
  category: z.enum(CATEGORY_SLUGS),
  excerpt: z.string().min(40).max(280),
  draft: z.boolean().default(false),
  canonicalUrl: z.string().url().optional(),
  image: z.string().optional(),
});

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>;

export const AuthorSchema = z.object({
  key: z.string(),
  name: z.string(),
  role: z.string().optional(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  twitter: z.string().url().optional(),
});

export type Author = z.infer<typeof AuthorSchema>;

export type Post = PostFrontmatter & {
  authorData: Author;
  readingTimeMinutes: number;
  body: string;
};

export type { CategorySlug } from './categories';
