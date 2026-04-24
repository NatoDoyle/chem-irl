import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import {
  AuthorSchema,
  type Author,
  type Category,
  type Post,
  PostFrontmatterSchema,
} from './schema';

const BLOG_DIR = path.resolve(process.cwd(), 'content/blog');
const AUTHORS_DIR = path.resolve(process.cwd(), 'content/authors');

let _allPosts: Post[] | null = null;
let _allAuthors: Record<string, Author> | null = null;

function loadAuthors(): Record<string, Author> {
  if (_allAuthors) return _allAuthors;
  if (!fs.existsSync(AUTHORS_DIR)) {
    _allAuthors = {};
    return _allAuthors;
  }
  const entries: Record<string, Author> = {};
  for (const file of fs.readdirSync(AUTHORS_DIR)) {
    if (!file.endsWith('.json')) continue;
    const key = file.replace(/\.json$/, '');
    const raw = fs.readFileSync(path.join(AUTHORS_DIR, file), 'utf8');
    const parsed = AuthorSchema.parse({ ...JSON.parse(raw), key });
    entries[key] = parsed;
  }
  _allAuthors = entries;
  return entries;
}

function loadAllPosts(): Post[] {
  if (_allPosts) return _allPosts;
  if (!fs.existsSync(BLOG_DIR)) {
    _allPosts = [];
    return _allPosts;
  }
  const authors = loadAuthors();
  const posts: Post[] = [];
  for (const file of fs.readdirSync(BLOG_DIR)) {
    if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
    const fullPath = path.join(BLOG_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(raw);
    const frontmatter = PostFrontmatterSchema.parse(data);
    const authorData = authors[frontmatter.author];
    if (!authorData) {
      throw new Error(
        `Post ${file} references unknown author "${frontmatter.author}". ` +
          `Add content/authors/${frontmatter.author}.json`,
      );
    }
    if (frontmatter.coverImage) {
      const coverPath = path.resolve(process.cwd(), 'public', frontmatter.coverImage.replace(/^\//, ''));
      if (!fs.existsSync(coverPath)) {
        throw new Error(
          `Post ${file} declares coverImage "${frontmatter.coverImage}" but ` +
            `web/public/${frontmatter.coverImage.replace(/^\//, '')} is missing.`,
        );
      }
    }
    const stats = readingTime(content);
    posts.push({
      ...frontmatter,
      authorData,
      readingTimeMinutes: Math.max(1, Math.round(stats.minutes)),
      body: content,
    });
  }
  posts.sort((a, b) => b.date.getTime() - a.date.getTime());
  _allPosts = posts;
  return posts;
}

export function getAllPosts(includeDrafts = false): Post[] {
  const posts = loadAllPosts();
  return includeDrafts ? posts : posts.filter((p) => !p.draft);
}

export function getPostBySlug(slug: string): Post | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter((p) => p.tags.includes(tag));
}

export function getPostsByCategory(category: Category): Post[] {
  return getAllPosts().filter((p) => p.category === category);
}

export function getAllTags(): string[] {
  const set = new Set<string>();
  for (const p of getAllPosts()) for (const t of p.tags) set.add(t);
  return Array.from(set).sort();
}

export function getAllCategories(): Category[] {
  const set = new Set<Category>();
  for (const p of getAllPosts()) set.add(p.category);
  return Array.from(set).sort();
}

export const POSTS_PER_PAGE = 10;

export function paginate<T>(items: T[], page: number, perPage = POSTS_PER_PAGE): { page: number; totalPages: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const clamped = Math.min(Math.max(1, page), totalPages);
  const start = (clamped - 1) * perPage;
  return { page: clamped, totalPages, items: items.slice(start, start + perPage) };
}

export function getRelatedPosts(post: Post, limit = 3): Post[] {
  return getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const sharedTags = p.tags.filter((t) => post.tags.includes(t)).length;
      const sameCategory = p.category === post.category ? 1 : 0;
      return { post: p, score: sharedTags * 2 + sameCategory };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || b.post.date.getTime() - a.post.date.getTime())
    .slice(0, limit)
    .map((e) => e.post);
}
