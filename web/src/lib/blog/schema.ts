import { z } from 'zod';

import { CATEGORY_SLUGS } from './categories';

export const FaqEntrySchema = z.object({
  question: z.string().min(3).max(200),
  answer: z.string().min(40).max(600),
});

export type FaqEntry = z.infer<typeof FaqEntrySchema>;

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

  // AI citability / AEO fields. All optional during the migration window so
  // the existing 25 posts continue to validate. The WRITING_GUIDE.md treats
  // them as required for new posts; the schema is the safety net, not the
  // discipline.
  tldr: z.string().min(40).max(600).optional(),
  lastReviewed: z.coerce.date().optional(),
  primaryQuestion: z.string().min(5).max(200).optional(),
  secondaryQuestions: z.array(z.string().min(3).max(200)).min(1).max(8).optional(),
  entities: z.array(z.string().min(2).max(80)).min(1).max(5).optional(),
  faq: z.array(FaqEntrySchema).min(1).max(8).optional(),
  citableClaim: z.string().min(10).max(400).optional(),
});

export type PostFrontmatter = z.infer<typeof PostFrontmatterSchema>;

export const AuthorSchema = z.object({
  key: z.string(),
  name: z.string(),
  role: z.string().optional(),
  bio: z.string().optional(),
  avatar: z.string().optional(),
  twitter: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  website: z.string().url().optional(),
});

export type Author = z.infer<typeof AuthorSchema>;

export type Post = PostFrontmatter & {
  authorData: Author;
  readingTimeMinutes: number;
  body: string;
};

export type { CategorySlug } from './categories';
