import { z } from 'zod';

export const CATEGORIES = ['product', 'safety', 'research', 'company'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  product: 'Product',
  safety: 'Safety',
  research: 'Research',
  company: 'Company',
};

export const PostFrontmatterSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-hyphenated'),
  date: z.coerce.date(),
  author: z.string(),
  tags: z.array(z.string()).default([]),
  category: z.enum(CATEGORIES),
  excerpt: z.string().min(40).max(280),
  coverImage: z.string().optional(),
  draft: z.boolean().default(false),
  canonicalUrl: z.string().url().optional(),
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
