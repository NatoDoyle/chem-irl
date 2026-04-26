export const CATEGORIES = {
  tips: {
    label: 'Dating Tips',
    description: 'Scripts, venues, and tactical moves for real-world dating.',
    path: 'tips',
  },
  advice: {
    label: 'Dating Advice',
    description: 'Naming the patterns that run your dating life — and what to do about them.',
    path: 'advice',
  },
  takes: {
    label: 'Honest Takes',
    description: 'Arguments and essays on the bigger forces shaping how we date.',
    path: 'takes',
  },
  behind: {
    label: 'Behind Chem IRL',
    description: 'The thinking behind how Chem IRL is built.',
    path: 'behind',
  },
} as const;

export type CategorySlug = keyof typeof CATEGORIES;

export const CATEGORY_SLUGS = Object.keys(CATEGORIES) as [CategorySlug, ...CategorySlug[]];

export function getCategoryLabel(slug: CategorySlug): string {
  return CATEGORIES[slug].label;
}

export function getCategoryDescription(slug: CategorySlug): string {
  return CATEGORIES[slug].description;
}
